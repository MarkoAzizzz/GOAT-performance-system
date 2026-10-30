"""
Assessment service — orchestrates DB reads/writes around the engine.
Business logic only. No HTTP, no serializers.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from students.models import Student
from .engine import process_session_legacy
from .models import AssessmentSession, AssessmentTemplate, CriterionScore, PillarScore, Criterion, Pillar
from .coach_service import recompute_standings

# Every student starts here — "lifetime gain" is current rating minus this.
BASE_RATING = 1000

logger = logging.getLogger(__name__)


def calculate_and_store(session: AssessmentSession) -> AssessmentSession:
    """
    Run the assessment engine on a session and persist all calculated values.
    Always runs inside a transaction — partial writes are rolled back.
    """
    with transaction.atomic():
        pillars = list(
            Pillar.objects.filter(template=session.template).order_by('order')
            .values('id', 'name')
        )
        pillar_id_map = {str(p['id']): p for p in pillars}

        raw_scores = list(
            CriterionScore.objects
            .filter(session=session)
            .select_related('criterion__pillar')
            .values(
                'id',
                'criterion_id',
                'criterion__pillar_id',
                'criterion__pillar__name',
                'boxing_score',
                'kickboxing_score',
            )
        )

        engine_input = [
            {
                'criterion_id': str(r['criterion_id']),
                'pillar_id': str(r['criterion__pillar_id']),
                'pillar_name': r['criterion__pillar__name'],
                'boxing_score': r['boxing_score'],
                'kickboxing_score': r['kickboxing_score'],
            }
            for r in raw_scores
        ]

        result = process_session_legacy(engine_input, pillars=[
            {'id': str(p['id']), 'name': p['name']} for p in pillars
        ])

        # Persist effective scores on each CriterionScore row
        score_map = {cr.criterion_id: cr for cr in result.pillar_results
                     for cr in cr.criterion_results}

        for raw in raw_scores:
            crit_id = str(raw['criterion_id'])
            if crit_id in score_map:
                CriterionScore.objects.filter(
                    session=session, criterion_id=raw['criterion_id']
                ).update(effective_score=score_map[crit_id].effective_score)

        # Persist pillar scores
        PillarScore.objects.filter(session=session).delete()
        for pr in result.pillar_results:
            if pr.score is not None:
                PillarScore.objects.create(
                    session=session,
                    pillar_id=pr.pillar_id,
                    score=pr.score,
                )

        # Persist session-level calculated fields
        session.overall_score = result.overall_score
        session.grade_percentage = result.grade_percentage
        session.save(update_fields=['overall_score', 'grade_percentage'])

        logger.info(
            'Assessment calculated: session=%s score=%s grade=%s%%',
            session.id, result.overall_score, result.grade_percentage,
        )

    recompute_standings(session.student)
    return session


def get_student_progress(student_id: str) -> dict:
    """
    Return a progress summary for a student across all their assessments.
    The headline metric is the open-ended rating (see assessments.engine) —
    grade_percentage/overall_score (legacy) or net_delta (points-based) still
    ride along per-session in `history` since they're the "how did this one
    test go" numbers, but they are not aggregated into a top-line score here.
    """
    sessions = list(
        AssessmentSession.objects
        .filter(Q(overall_score__isnull=False) | Q(net_delta__isnull=False), student_id=student_id)
        .order_by('assessment_date')
        .values('id', 'assessment_date', 'overall_score', 'grade_percentage', 'net_delta',
                'coach_notes', 'action_plan', 'sessions_completed',
                'rating_before', 'rating_after')
    )

    if not sessions:
        return _empty_progress()

    ratings = [Decimal(str(s['rating_after'])) for s in sessions if s['rating_after'] is not None]
    latest = sessions[-1]

    current_rating = Decimal(str(latest['rating_after'])) if latest['rating_after'] is not None else None
    rating_change = (
        Decimal(str(latest['rating_after'])) - Decimal(str(latest['rating_before']))
        if latest['rating_after'] is not None and latest['rating_before'] is not None
        else None
    )

    # Include pillar scores for the latest session (for radar chart) — pillar
    # breakdown stays 0-10/percentage, it's about relative strengths within
    # one assessment, not the lifetime rating.
    latest_pillar_scores = list(
        PillarScore.objects
        .filter(session_id=latest['id'])
        .select_related('pillar')
        .values('pillar__name', 'pillar__order', 'score', 'delta', 'standing_before', 'standing_after')
        .order_by('pillar__order')
    )

    return {
        'current_rating': float(current_rating) if current_rating is not None else None,
        'rating_change': float(rating_change) if rating_change is not None else None,
        'highest_rating': float(max(ratings)) if ratings else None,
        'lowest_rating': float(min(ratings)) if ratings else None,
        'average_rating': float(round(sum(ratings) / len(ratings), 1)) if ratings else None,
        'total_assessments': len(sessions),
        'latest_pillar_scores': latest_pillar_scores,
        'history': sessions,
    }


def _empty_progress() -> dict:
    return {
        'current_rating': None,
        'rating_change': None,
        'highest_rating': None,
        'lowest_rating': None,
        'average_rating': None,
        'total_assessments': 0,
        'latest_pillar_scores': [],
        'history': [],
    }


def get_sport_analytics() -> dict:
    """
    Coach-facing roster analytics, split by sport: roster size, how many
    have been assessed this month, average rating and average lifetime gain
    (current rating - the 1000 baseline), a short most-improved list, and
    average pillar standing across each sport's latest assessments — the
    one number here that actually points at what to train next.

    Deliberately simple (one query per active student rather than a single
    aggregate query) — this gym's roster is a few dozen students, not
    thousands, so the straightforward version is worth more than the fast
    one.
    """
    month_start = timezone.localdate().replace(day=1)
    template = AssessmentTemplate.objects.filter(is_active=True).first()
    pillars = list(template.pillars.all()) if template else []

    result = {}
    for sport in [s[0] for s in Student.Sport.choices]:
        students = list(
            Student.objects.filter(is_active=True, sport=sport).select_related('user')
        )

        latest_session_by_student = {}
        assessed_this_month = 0
        for student in students:
            latest = (
                AssessmentSession.objects
                .filter(student=student)
                .order_by('-assessment_date')
                .first()
            )
            if latest:
                latest_session_by_student[student.id] = latest
                if latest.assessment_date >= month_start:
                    assessed_this_month += 1

        rated = [s for s in students if s.id in latest_session_by_student]
        ratings = [float(s.rating) for s in rated]
        average_rating = round(sum(ratings) / len(ratings), 1) if ratings else None
        average_lifetime_gain = (
            round(sum(r - BASE_RATING for r in ratings) / len(ratings), 1) if ratings else None
        )

        most_improved = sorted(rated, key=lambda s: float(s.rating), reverse=True)[:3]

        pillar_totals: dict = {p.id: [] for p in pillars}
        latest_session_ids = [s.id for s in latest_session_by_student.values()]
        for row in PillarScore.objects.filter(
            session_id__in=latest_session_ids, standing_after__isnull=False
        ).values('pillar_id', 'standing_after'):
            if row['pillar_id'] in pillar_totals:
                pillar_totals[row['pillar_id']].append(float(row['standing_after']))

        result[sport] = {
            'total_members': len(students),
            'assessed_this_month': assessed_this_month,
            'average_rating': average_rating,
            'average_lifetime_gain': average_lifetime_gain,
            'most_improved': [
                {
                    'student_id': s.student_id,
                    'student_name': s.user.full_name,
                    'gain': round(float(s.rating) - BASE_RATING, 1),
                }
                for s in most_improved
            ],
            'pillar_strength': [
                {
                    'pillar_name': p.name,
                    'average': round(sum(pillar_totals[p.id]) / len(pillar_totals[p.id]), 1)
                    if pillar_totals[p.id] else None,
                }
                for p in pillars
            ],
        }

    return result
