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

RATING_START = Decimal('1000')
PROVISIONAL_ASSESSMENTS = 5


def _round(value: Decimal) -> Decimal:
    return value.quantize(TWO_DP, rounding=ROUND_HALF_UP)


def _round_rating(value: Decimal) -> Decimal:
    return value.quantize(RATING_DP, rounding=ROUND_HALF_UP)


# ── Points-based rating formula (current) ────────────────────────────────────
# Coaches nudge each criterion +/- a few points per assessment instead of
# giving it an absolute score. A session's net_delta (sum of every pillar's
# delta) moves the rating directly by that amount, scaled by k — new
# students move fast, established ones move steadier. Same open-ended
# philosophy as the rating itself: no fixed scale, retune via the two
# constants below.
RATING_POINTS_PER_DELTA_PROVISIONAL = Decimal('10')  # first few assessments: converge fast
RATING_POINTS_PER_DELTA_ESTABLISHED = Decimal('4')   # afterwards: steadier movements


def k_factor_points(prior_assessment_count: int) -> Decimal:
    """New students' ratings move fast; established students' move steadier."""
    return (
        RATING_POINTS_PER_DELTA_PROVISIONAL
        if prior_assessment_count < PROVISIONAL_ASSESSMENTS
        else RATING_POINTS_PER_DELTA_ESTABLISHED
    )


def update_rating_from_points(
    current_rating: Decimal,
    net_delta: Decimal,
    prior_assessment_count: int,
) -> Decimal:
    """Moves the rating directly by this session's net point change, scaled by k."""
    k = k_factor_points(prior_assessment_count)
    return _round_rating(current_rating + net_delta * k)


@dataclass(frozen=True)
class PillarResult:
    pillar_id: str
    pillar_name: str
    delta: Decimal


@dataclass(frozen=True)
class AssessmentResult:
    pillar_results: list
    net_delta: Decimal


def process_session(raw_criterion_deltas: list[dict], pillars: list[dict]) -> AssessmentResult:
    """
    Entry point for the points-based engine.

    raw_criterion_deltas: list of dicts with keys:
        criterion_id, pillar_id, pillar_name, delta
    Every criterion should be present each session — an untouched criterion
    carries delta=0 ("no change" is an explicit fact, not missing data).

    pillars: list of dicts with keys: id, name

    Returns a fully computed AssessmentResult: each pillar's summed delta,
    and the session's net_delta (sum of all pillar deltas).
    """
    deltas_by_pillar: dict[str, list] = {p['id']: [] for p in pillars}
    pillar_names: dict[str, str] = {p['id']: p['name'] for p in pillars}

    for raw in raw_criterion_deltas:
        delta = Decimal(str(raw['delta'])) if raw['delta'] is not None else Decimal('0')
        deltas_by_pillar[raw['pillar_id']].append(delta)

    pillar_results: list[PillarResult] = []
    for p in pillars:
        pid = p['id']
        pillar_delta = _round(sum(deltas_by_pillar[pid])) if deltas_by_pillar[pid] else Decimal('0')
        pillar_results.append(PillarResult(pillar_id=pid, pillar_name=pillar_names[pid], delta=pillar_delta))

    net_delta = _round(sum(pr.delta for pr in pillar_results)) if pillar_results else Decimal('0')

    return AssessmentResult(pillar_results=pillar_results, net_delta=net_delta)


# ── Legacy grade%-based formula ───────────────────────────────────────────────
# Kept only to (a) replay historical assessments that were scored 0-10 per
# criterion before coaches switched to +/- point deltas, and (b) support the
# dormant Google-Sheets sync path (assessments.services.calculate_and_store /
# google_sync.importer), which still writes absolute scores. Nothing new
# should call anything below this line — see the points-based formula above.
LEGACY_RATING_SCALE = Decimal('250')        # higher = flatter curve = easier to keep climbing at high ratings
LEGACY_K_PROVISIONAL = Decimal('80')        # first few assessments: converge fast to a student's true level
LEGACY_K_ESTABLISHED = Decimal('24')        # afterwards: smaller, steadier movements


@dataclass(frozen=True)
class CriterionResultLegacy:
    criterion_id: str
    boxing_score: Optional[Decimal]
    kickboxing_score: Optional[Decimal]
    effective_score: Optional[Decimal]


@dataclass(frozen=True)
class PillarResultLegacy:
    pillar_id: str
    pillar_name: str
    score: Optional[Decimal]
    criterion_results: list


@dataclass(frozen=True)
class AssessmentResultLegacy:
    pillar_results: list
    overall_score: Optional[Decimal]
    grade_percentage: Optional[Decimal]


def expected_grade_pct(rating: Decimal) -> Decimal:
    """
    Legacy only. The grade % a student at this rating was 'expected' to
    produce — a logistic curve centered on RATING_START (50%) that
    saturates toward 100% without ever reaching it.
    """
    exponent = -(rating - RATING_START) / LEGACY_RATING_SCALE
    denom = Decimal('1') + Decimal(math.exp(float(exponent)))
    return _round(Decimal('100') / denom)


def legacy_k_factor(prior_assessment_count: int) -> Decimal:
    """Legacy only."""
    return LEGACY_K_PROVISIONAL if prior_assessment_count < PROVISIONAL_ASSESSMENTS else LEGACY_K_ESTABLISHED


def update_rating_legacy(
    current_rating: Decimal,
    actual_grade_pct: Decimal,
    prior_assessment_count: int,
) -> Decimal:
    """Legacy only — replays a historical grade%-based assessment's rating update."""
    expected = expected_grade_pct(current_rating)
    k = legacy_k_factor(prior_assessment_count)
    delta = k * (actual_grade_pct - expected) / Decimal('100')
    return _round_rating(current_rating + delta)


def effective_criterion_score(
    boxing: Optional[Decimal],
    kickboxing: Optional[Decimal],
) -> Optional[Decimal]:
    """Legacy only. Average of whichever scores are provided. None if both empty."""
    filled = [s for s in (boxing, kickboxing) if s is not None]
    if not filled:
        return None
    return _round(sum(filled) / len(filled))


def pillar_score_legacy(effective_scores: list) -> Optional[Decimal]:
    """Legacy only. Average of non-null effective criterion scores within a pillar."""
    filled = [s for s in effective_scores if s is not None]
    if not filled:
        return None
    return _round(sum(filled) / len(filled))


def overall_score_legacy(pillar_scores: list) -> Optional[Decimal]:
    """Legacy only. Equal-weight average of all pillar scores."""
    filled = [s for s in pillar_scores if s is not None]
    if not filled:
        return None
    return _round(sum(filled) / len(filled))


def grade_percentage_legacy(score: Optional[Decimal]) -> Optional[Decimal]:
    """Legacy only. Convert /10 score to percentage."""
    if score is None:
        return None
    return _round((score / Decimal('10')) * Decimal('100'))


def process_session_legacy(raw_criterion_scores: list[dict], pillars: list[dict]) -> AssessmentResultLegacy:
    """
    Legacy entry point — absolute 0-10 scores. Used only by the dormant
    Google-Sheets sync path (see module docstring above).

    raw_criterion_scores: list of dicts with keys:
        criterion_id, pillar_id, pillar_name, boxing_score, kickboxing_score
    pillars: list of dicts with keys: id, name
    """
    scores_by_pillar: dict[str, list] = {p['id']: [] for p in pillars}
    pillar_names: dict[str, str] = {p['id']: p['name'] for p in pillars}

    criterion_results: list[CriterionResultLegacy] = []
    for raw in raw_criterion_scores:
        boxing = Decimal(str(raw['boxing_score'])) if raw['boxing_score'] is not None else None
        kickboxing = Decimal(str(raw['kickboxing_score'])) if raw['kickboxing_score'] is not None else None
        eff = effective_criterion_score(boxing, kickboxing)
        result = CriterionResultLegacy(
            criterion_id=raw['criterion_id'],
            boxing_score=boxing,
            kickboxing_score=kickboxing,
            effective_score=eff,
        )
        criterion_results.append(result)
        scores_by_pillar[raw['pillar_id']].append(result)

    pillar_results: list[PillarResultLegacy] = []
    for p in pillars:
        pid = p['id']
        crit_results = scores_by_pillar[pid]
        p_score = pillar_score_legacy([c.effective_score for c in crit_results])
        pillar_results.append(PillarResultLegacy(
            pillar_id=pid,
            pillar_name=pillar_names[pid],
            score=p_score,
            criterion_results=crit_results,
        ))

    o_score = overall_score_legacy([pr.score for pr in pillar_results])
    g_pct = grade_percentage_legacy(o_score)

    return AssessmentResultLegacy(
        pillar_results=pillar_results,
        overall_score=o_score,
        grade_percentage=g_pct,
    )
