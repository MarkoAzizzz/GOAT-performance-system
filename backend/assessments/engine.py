"""
Assessment Engine — all scoring calculations live here.
No database access. No Django imports. Pure functions only.
Swap the formula by changing this file alone.
"""
import math
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional


TWO_DP = Decimal('0.01')
RATING_DP = Decimal('1')

# Tier thresholds (grade %) — used for the per-session snapshot only.
LEVEL_THRESHOLDS = [
    (Decimal('80'), 'advanced'),
    (Decimal('50'), 'intermediate'),
    (Decimal('0'),  'beginner'),
]

# ── Rating system ────────────────────────────────────────────────────────────
# Open-ended, ELO-style rating layered on top of the bounded per-session grade.
# A student's rating implies an "expected" grade % via a saturating curve
# centered on RATING_START. Beating that expectation raises the rating,
# missing it lowers it — and because the curve approaches (never reaches)
# 100%, there's no rating high enough to make further gains impossible, only
# harder to earn. Change RATING_SCALE/K_* here to retune; nothing else in the
# codebase encodes the formula.
RATING_START = Decimal('1000')
RATING_SCALE = Decimal('250')        # higher = flatter curve = easier to keep climbing at high ratings
K_PROVISIONAL = Decimal('80')        # first few assessments: converge fast to a student's true level
K_ESTABLISHED = Decimal('24')        # afterwards: smaller, steadier movements
PROVISIONAL_ASSESSMENTS = 5

# Rating bands — no upper bound on the top tier, and more tiers can be added
# above 'advanced' later without this function needing a ceiling.
RATING_LEVEL_THRESHOLDS = [
    (Decimal('1100'), 'advanced'),
    (Decimal('1000'), 'intermediate'),
    (Decimal('0'),    'beginner'),
]


@dataclass(frozen=True)
class CriterionResult:
    criterion_id: str
    boxing_score: Optional[Decimal]
    kickboxing_score: Optional[Decimal]
    effective_score: Optional[Decimal]


@dataclass(frozen=True)
class PillarResult:
    pillar_id: str
    pillar_name: str
    score: Optional[Decimal]
    criterion_results: list


@dataclass(frozen=True)
class AssessmentResult:
    pillar_results: list
    overall_score: Optional[Decimal]
    grade_percentage: Optional[Decimal]
    level: str


def _round(value: Decimal) -> Decimal:
    return value.quantize(TWO_DP, rounding=ROUND_HALF_UP)


def _round_rating(value: Decimal) -> Decimal:
    return value.quantize(RATING_DP, rounding=ROUND_HALF_UP)


def expected_grade_pct(rating: Decimal) -> Decimal:
    """
    The grade % a student at this rating is 'expected' to produce this
    assessment — a logistic curve centered on RATING_START (50%) that
    saturates toward 100% without ever reaching it.
    """
    exponent = -(rating - RATING_START) / RATING_SCALE
    denom = Decimal('1') + Decimal(math.exp(float(exponent)))
    return _round(Decimal('100') / denom)


def k_factor(prior_assessment_count: int) -> Decimal:
    """New students' ratings move fast to find their true level; established
    students' ratings move in smaller, steadier increments."""
    return K_PROVISIONAL if prior_assessment_count < PROVISIONAL_ASSESSMENTS else K_ESTABLISHED


def update_rating(
    current_rating: Decimal,
    actual_grade_pct: Decimal,
    prior_assessment_count: int,
) -> Decimal:
    """
    ELO-style update: moves the rating toward or away from its current value
    based on whether this assessment beat or missed the grade % that rating
    implied. Beating your own expectation raises it; missing it lowers it.
    """
    expected = expected_grade_pct(current_rating)
    k = k_factor(prior_assessment_count)
    delta = k * (actual_grade_pct - expected) / Decimal('100')
    return _round_rating(current_rating + delta)


def assign_level_from_rating(rating: Optional[Decimal]) -> str:
    """Map rating to Beginner / Intermediate / Advanced — the student-facing
    level, now open-ended at the top instead of grade-% capped."""
    if rating is None:
        return 'beginner'
    for threshold, level in RATING_LEVEL_THRESHOLDS:
        if rating >= threshold:
            return level
    return 'beginner'


def effective_criterion_score(
    boxing: Optional[Decimal],
    kickboxing: Optional[Decimal],
) -> Optional[Decimal]:
    """Average of whichever scores are provided. Returns None if both empty."""
    filled = [s for s in (boxing, kickboxing) if s is not None]
    if not filled:
        return None
    return _round(sum(filled) / len(filled))


def pillar_score(effective_scores: list[Optional[Decimal]]) -> Optional[Decimal]:
    """Average of non-null effective criterion scores within a pillar."""
    filled = [s for s in effective_scores if s is not None]
    if not filled:
        return None
    return _round(sum(filled) / len(filled))


def overall_score(pillar_scores: list[Optional[Decimal]]) -> Optional[Decimal]:
    """
    Equal-weight average of all pillar scores.
    Formula is intentionally isolated here so weights can be injected later.
    """
    filled = [s for s in pillar_scores if s is not None]
    if not filled:
        return None
    return _round(sum(filled) / len(filled))


def grade_percentage(score: Optional[Decimal]) -> Optional[Decimal]:
    """Convert /10 score to percentage."""
    if score is None:
        return None
    return _round((score / Decimal('10')) * Decimal('100'))


def assign_level(percentage: Optional[Decimal]) -> str:
    """Map grade % to Beginner / Intermediate / Advanced."""
    if percentage is None:
        return 'beginner'
    for threshold, level in LEVEL_THRESHOLDS:
        if percentage >= threshold:
            return level
    return 'beginner'


def improvement(
    current: Optional[Decimal],
    previous: Optional[Decimal],
) -> Optional[Decimal]:
    """Signed difference: current - previous. None if either is missing."""
    if current is None or previous is None:
        return None
    return _round(current - previous)


def process_session(raw_criterion_scores: list[dict], pillars: list[dict]) -> AssessmentResult:
    """
    Entry point for the engine.

    raw_criterion_scores: list of dicts with keys:
        criterion_id, pillar_id, pillar_name, boxing_score, kickboxing_score

    pillars: list of dicts with keys:
        id, name

    Returns a fully computed AssessmentResult.
    """
    scores_by_pillar: dict[str, list] = {p['id']: [] for p in pillars}
    pillar_names: dict[str, str] = {p['id']: p['name'] for p in pillars}

    criterion_results: list[CriterionResult] = []
    for raw in raw_criterion_scores:
        boxing = Decimal(str(raw['boxing_score'])) if raw['boxing_score'] is not None else None
        kickboxing = Decimal(str(raw['kickboxing_score'])) if raw['kickboxing_score'] is not None else None
        eff = effective_criterion_score(boxing, kickboxing)
        result = CriterionResult(
            criterion_id=raw['criterion_id'],
            boxing_score=boxing,
            kickboxing_score=kickboxing,
            effective_score=eff,
        )
        criterion_results.append(result)
        scores_by_pillar[raw['pillar_id']].append(result)

    pillar_results: list[PillarResult] = []
    for p in pillars:
        pid = p['id']
        crit_results = scores_by_pillar[pid]
        p_score = pillar_score([c.effective_score for c in crit_results])
        pillar_results.append(PillarResult(
            pillar_id=pid,
            pillar_name=pillar_names[pid],
            score=p_score,
            criterion_results=crit_results,
        ))

    o_score = overall_score([pr.score for pr in pillar_results])
    g_pct = grade_percentage(o_score)
    level = assign_level(g_pct)

    return AssessmentResult(
        pillar_results=pillar_results,
        overall_score=o_score,
        grade_percentage=g_pct,
        level=level,
    )
