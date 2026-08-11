"""
Recalculates the final AssessmentSession from all CoachEntry records
for a given (student, date). Called every time a coach submits or updates.
"""
from decimal import Decimal
from django.db import transaction
from .models import (
    AssessmentSession, AssessmentTemplate,
    CriterionScore, PillarScore,
    CoachEntry, CoachCriterionScore,
    Criterion, Pillar,
)
from .engine import process_session, update_rating, RATING_START
from leaderboard.services import refresh_student


def recompute_ratings(student):
    """
    Recomputes rating_before/rating_after for every one of this student's
    assessment sessions in chronological order, then syncs Student.rating
    to the result.

    Runs the full history every time (not just the newest session) so that
    editing an old assessment correctly ripples the rating change forward
    through everything after it, rather than leaving the chain inconsistent.
    """
    sessions = list(AssessmentSession.objects.filter(student=student).order_by('assessment_date'))
    rating = RATING_START
    for i, session in enumerate(sessions):
        session.rating_before = rating
        if session.grade_percentage is not None:
            rating = update_rating(rating, session.grade_percentage, i)
        session.rating_after = rating
        session.save(update_fields=['rating_before', 'rating_after'])

    student.rating = rating
    student.save(update_fields=['rating'])


def recalculate(student, assessment_date):
    """Average all coach entries for (student, date) → update AssessmentSession."""
    entries = list(CoachEntry.objects.filter(student=student, assessment_date=assessment_date)
                   .prefetch_related('scores__criterion__pillar'))

    if not entries:
        return

    template = AssessmentTemplate.objects.filter(is_active=True).order_by('-version').first()
    if not template:
        return

    pillars = list(Pillar.objects.filter(template=template).prefetch_related('criteria').order_by('order'))
    all_criteria = [c for p in pillars for c in p.criteria.all()]

    # Average scores per criterion across all coach entries
    averaged = {}  # criterion_id → Decimal avg
    for criterion in all_criteria:
        scores = []
        for entry in entries:
            cs = next((s for s in entry.scores.all() if s.criterion_id == criterion.id), None)
            if cs and cs.score is not None:
                scores.append(cs.score)
        if scores:
            averaged[str(criterion.id)] = sum(scores) / len(scores)

    # Build raw_criterion_scores for engine
    raw = []
    for criterion in all_criteria:
        avg = averaged.get(str(criterion.id))
        raw.append({
            'criterion_id': str(criterion.id),
            'pillar_id': str(criterion.pillar_id),
            'boxing_score': avg,
            'kickboxing_score': None,
        })

    pillar_dicts = [{'id': str(p.id), 'name': p.name} for p in pillars]
    result = process_session(raw, pillar_dicts)

    # Aggregate notes from all coaches
    combined_notes = '\n---\n'.join(
        f'[{e.coach.full_name if e.coach else "Coach"}]: {e.notes}' for e in entries if e.notes
    )
    combined_plan = '\n---\n'.join(
        f'[{e.coach.full_name if e.coach else "Coach"}]: {e.action_plan}' for e in entries if e.action_plan
    )
    avg_sessions = round(sum(e.sessions_completed for e in entries) / len(entries))

    martial_art = student.sport

    with transaction.atomic():
        session, _ = AssessmentSession.objects.get_or_create(
            student=student,
            assessment_date=assessment_date,
            defaults={'template': template, 'martial_art': martial_art},
        )
        session.overall_score = result.overall_score
        session.grade_percentage = result.grade_percentage
        session.coach_notes = combined_notes
        session.action_plan = combined_plan
        session.sessions_completed = avg_sessions
        session.save()

        # Rebuild criterion scores
        CriterionScore.objects.filter(session=session).delete()
        for criterion in all_criteria:
            avg = averaged.get(str(criterion.id))
            CriterionScore.objects.create(
                session=session,
                criterion=criterion,
                boxing_score=avg if martial_art == 'boxing' else None,
                kickboxing_score=avg if martial_art == 'kickboxing' else None,
                effective_score=avg,
            )

        # Rebuild pillar scores
        PillarScore.objects.filter(session=session).delete()
        for pr in result.pillar_results:
            pillar = next(p for p in pillars if str(p.id) == pr.pillar_id)
            if pr.score is not None:
                PillarScore.objects.create(session=session, pillar=pillar, score=pr.score)

    # Recompute the student's open-ended rating chain and sync level to it
    recompute_ratings(student)

    refresh_student(student)
