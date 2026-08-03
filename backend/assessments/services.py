"""
Assessment service — orchestrates DB reads/writes around the engine.
Business logic only. No HTTP, no serializers.
"""
import logging
from decimal import Decimal
from django.db import transaction
from .engine import process_session
from .models import AssessmentSession, CriterionScore, PillarScore, Criterion, Pillar
from .coach_service import recompute_ratings

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

        result = process_session(engine_input, pillars=[
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
        session.level_at_assessment = result.level
        session.save(update_fields=['overall_score', 'grade_percentage', 'level_at_assessment'])

        logger.info(
            'Assessment calculated: session=%s score=%s grade=%s%% level=%s',
            session.id, result.overall_score, result.grade_percentage, result.level,
        )

    recompute_ratings(session.student)
    return session


def get_student_progress(student_id: str) -> dict:
    """
    Return a progress summary for a student across all their assessments.
    The headline metric is the open-ended rating (see assessments.engine) —
    grade_percentage/overall_score still ride along per-session in `history`
    since they're the bounded "how did this one test go" numbers, but they
    are not aggregated into a top-line score here.
    """
    sessions = list(
        AssessmentSession.objects
        .filter(student_id=student_id, overall_score__isnull=False)
        .order_by('assessment_date')
        .values('id', 'assessment_date', 'overall_score', 'grade_percentage',
                'level_at_assessment', 'coach_notes', 'action_plan', 'sessions_completed',
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
        .values('pillar__name', 'pillar__order', 'score')
        .order_by('pillar__order')
    )

    return {
        'current_rating': float(current_rating) if current_rating is not None else None,
        'rating_change': float(rating_change) if rating_change is not None else None,
        'highest_rating': float(max(ratings)) if ratings else None,
        'lowest_rating': float(min(ratings)) if ratings else None,
        'average_rating': float(round(sum(ratings) / len(ratings), 1)) if ratings else None,
        'total_assessments': len(sessions),
        'latest_level': latest['level_at_assessment'],
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
        'latest_level': None,
        'latest_pillar_scores': [],
        'history': [],
    }
