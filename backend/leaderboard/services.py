"""
Leaderboard service — rebuilds LeaderboardSnapshot for one or all students.
Called automatically after every assessment calculation.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.db.models import F, Q
from assessments.models import AssessmentSession
from students.models import Student
from .models import LeaderboardSnapshot

logger = logging.getLogger(__name__)


def recompute_ranks() -> None:
    """
    Assign board positions across every snapshot, ordered by rating.

    Rank is global, so one student's new score can move everyone below them —
    it cannot be derived per student. Each snapshot's prior rank is kept in
    previous_rank so clients can show movement; a snapshot with no rating yet
    sorts last rather than first, which is what a plain DESC would do with
    NULLs on Postgres.
    """
    snapshots = list(
        LeaderboardSnapshot.objects.order_by(
            F('current_rating').desc(nulls_last=True), F('rating_change').desc(nulls_last=True)
        )
    )
    for position, snapshot in enumerate(snapshots, start=1):
        snapshot.previous_rank = snapshot.rank
        snapshot.rank = position

    if snapshots:
        LeaderboardSnapshot.objects.bulk_update(snapshots, ['rank', 'previous_rank'])


def refresh_student(student: Student, recompute: bool = True) -> None:
    """
    Rebuild the leaderboard snapshot for a single student.

    `recompute=False` lets a bulk caller skip the global rank pass per student
    and run it once at the end instead.
    """
    sessions = list(
        AssessmentSession.objects
        .filter(Q(overall_score__isnull=False) | Q(net_delta__isnull=False), student=student)
        .order_by('-assessment_date')
        .only('id', 'overall_score', 'grade_percentage', 'net_delta', 'rating_before', 'rating_after')
    )

    if not sessions:
        LeaderboardSnapshot.objects.filter(student=student).delete()
        if recompute:
            recompute_ranks()
        return

    latest = sessions[0]
    previous = sessions[1] if len(sessions) > 1 else None

    current_rating = Decimal(str(latest.rating_after)) if latest.rating_after is not None else None
    prev_rating = Decimal(str(latest.rating_before)) if latest.rating_before is not None else None
    rating_change = (
        round(current_rating - prev_rating, 1)
        if current_rating is not None and prev_rating is not None
        else None
    )

    with transaction.atomic():
        LeaderboardSnapshot.objects.update_or_create(
            student=student,
            defaults={
                'latest_session': latest,
                'previous_session': previous,
                'current_rating': current_rating,
                'previous_rating': prev_rating,
                'rating_change': rating_change,
                'total_assessments': len(sessions),
            },
        )

    if recompute:
        recompute_ranks()

    logger.debug(
        'Leaderboard refreshed: student=%s rating=%s change=%s',
        student.student_id, current_rating, rating_change,
    )


def refresh_all() -> None:
    """Rebuild snapshots for every active student. Used after bulk sync."""
    students = Student.objects.filter(is_active=True).select_related('user')
    for student in students:
        try:
            refresh_student(student, recompute=False)
        except Exception:
            logger.exception('Leaderboard refresh failed for student=%s', student.student_id)
    # One global pass once every snapshot is current, rather than per student.
    recompute_ranks()
    logger.info('Leaderboard refresh complete: %d students processed', students.count())


def get_leaderboard(
    branch_id: str = None,
    sport: str = None,
    limit: int = 50,
) -> list:
    """
    Return ranked leaderboard entries.
    Primary sort: highest current rating. Secondary: biggest recent rating change.
    """
    qs = (
        LeaderboardSnapshot.objects
        .select_related('student__user', 'student__branch')
        .order_by('-current_rating', '-rating_change')
    )

    if branch_id:
        qs = qs.filter(student__branch_id=branch_id)
    if sport:
        qs = qs.filter(student__sport=sport)

    return list(qs[:limit])
