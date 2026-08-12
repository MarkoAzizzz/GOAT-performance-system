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
from .engine import process_session, update_rating_from_points, update_rating_legacy, RATING_START
from leaderboard.services import refresh_student


def recompute_standings(student):
    """
    Recomputes rating_before/rating_after and every pillar's running
    standing_before/standing_after for this student's assessment sessions in
    chronological order, then syncs Student.rating to the result.

    Runs the full history every time (not just the newest session) so that
    editing an old assessment correctly ripples forward through everything
    after it. Sessions scored the old way (grade_percentage, no net_delta)
    replay through the legacy rating formula and simply reset each pillar's
    running standing to that session's absolute score — legacy scores are
    snapshots, not cumulative. The first points-based session for a pillar
    then naturally inherits whatever standing the legacy chain left behind
    (0 if the student has no legacy history at all).
    """
    sessions = list(
        AssessmentSession.objects.filter(student=student)
        .order_by('assessment_date')
        .prefetch_related('pillar_scores')
    )
    rating = RATING_START
    pillar_running = {}  # pillar_id -> Decimal running standing

    for i, session in enumerate(sessions):
        session.rating_before = rating

        for ps in session.pillar_scores.all():
            if ps.delta is not None:
                standing_before = pillar_running.get(ps.pillar_id, Decimal('0'))
                standing_after = standing_before + ps.delta
                ps.standing_before = standing_before
                ps.standing_after = standing_after
                ps.save(update_fields=['standing_before', 'standing_after'])
                pillar_running[ps.pillar_id] = standing_after
            elif ps.score is not None:
                pillar_running[ps.pillar_id] = ps.score

        if session.net_delta is not None:
            rating = update_rating_from_points(rating, session.net_delta, i)
        elif session.grade_percentage is not None:
            rating = update_rating_legacy(rating, session.grade_percentage, i)
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

    # Average point deltas per criterion across all coach entries for the day
    averaged = {}  # criterion_id → Decimal avg delta
    for criterion in all_criteria:
        deltas = []
        for entry in entries:
            cs = next((s for s in entry.scores.all() if s.criterion_id == criterion.id), None)
            if cs and cs.delta is not None:
                deltas.append(cs.delta)
        if deltas:
            averaged[str(criterion.id)] = sum(deltas) / len(deltas)

    # Build raw_criterion_deltas for engine
    raw = []
    for criterion in all_criteria:
        raw.append({
            'criterion_id': str(criterion.id),
            'pillar_id': str(criterion.pillar_id),
            'delta': averaged.get(str(criterion.id)),
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
        session.net_delta = result.net_delta
        session.coach_notes = combined_notes
        session.action_plan = combined_plan
        session.sessions_completed = avg_sessions
        session.save()

        # Rebuild criterion scores (points-based: delta only, no absolute score)
        CriterionScore.objects.filter(session=session).delete()
        for criterion in all_criteria:
            CriterionScore.objects.create(
                session=session,
                criterion=criterion,
                delta=averaged.get(str(criterion.id), Decimal('0')),
            )

        # Rebuild pillar scores (delta only — standing_before/standing_after
        # are filled in by recompute_standings' chronological replay below)
        PillarScore.objects.filter(session=session).delete()
        for pr in result.pillar_results:
            pillar = next(p for p in pillars if str(p.id) == pr.pillar_id)
            PillarScore.objects.create(session=session, pillar=pillar, delta=pr.delta)

    # Recompute the student's open-ended rating chain and pillar standings
    recompute_standings(student)

    refresh_student(student)
