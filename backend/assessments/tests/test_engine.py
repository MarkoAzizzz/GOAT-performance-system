from decimal import Decimal
from django.test import TestCase
from assessments.engine import (
    effective_criterion_score,
    pillar_score_legacy,
    overall_score_legacy,
    grade_percentage_legacy,
    process_session_legacy,
    process_session,
    k_factor_points,
    update_rating_from_points,
    RATING_START,
)

D = Decimal


class TestEffectiveCriterionScore(TestCase):
    def test_both_scores_averages(self):
        self.assertEqual(effective_criterion_score(D('8'), D('6')), D('7.00'))

    def test_boxing_only(self):
        self.assertEqual(effective_criterion_score(D('9'), None), D('9.00'))

    def test_kickboxing_only(self):
        self.assertEqual(effective_criterion_score(None, D('7')), D('7.00'))

    def test_both_none_returns_none(self):
        self.assertIsNone(effective_criterion_score(None, None))

    def test_rounds_half_up(self):
        self.assertEqual(effective_criterion_score(D('7'), D('8')), D('7.50'))

    def test_max_score(self):
        self.assertEqual(effective_criterion_score(D('10'), D('10')), D('10.00'))

    def test_zero_scores(self):
        self.assertEqual(effective_criterion_score(D('0'), D('0')), D('0.00'))


class TestPillarScoreLegacy(TestCase):
    def test_full_pillar(self):
        scores = [D('8'), D('7'), D('9'), D('6'), D('10')]
        self.assertEqual(pillar_score_legacy(scores), D('8.00'))

    def test_skips_none(self):
        scores = [D('8'), None, D('6')]
        self.assertEqual(pillar_score_legacy(scores), D('7.00'))

    def test_all_none_returns_none(self):
        self.assertIsNone(pillar_score_legacy([None, None]))

    def test_single_score(self):
        self.assertEqual(pillar_score_legacy([D('7.50')]), D('7.50'))


class TestOverallScoreLegacy(TestCase):
    def test_five_equal_pillars(self):
        scores = [D('8'), D('8'), D('8'), D('8'), D('8')]
        self.assertEqual(overall_score_legacy(scores), D('8.00'))

    def test_mixed_pillars(self):
        scores = [D('10'), D('6'), D('8'), D('4'), D('7')]
        self.assertEqual(overall_score_legacy(scores), D('7.00'))

    def test_skips_none(self):
        scores = [D('8'), None, D('6')]
        self.assertEqual(overall_score_legacy(scores), D('7.00'))

    def test_all_none_returns_none(self):
        self.assertIsNone(overall_score_legacy([None, None, None]))


class TestGradePercentageLegacy(TestCase):
    def test_perfect_score(self):
        self.assertEqual(grade_percentage_legacy(D('10')), D('100.00'))

    def test_zero(self):
        self.assertEqual(grade_percentage_legacy(D('0')), D('0.00'))

    def test_midrange(self):
        self.assertEqual(grade_percentage_legacy(D('7.5')), D('75.00'))

    def test_none_returns_none(self):
        self.assertIsNone(grade_percentage_legacy(None))


class TestProcessSessionLegacy(TestCase):
    def _make_pillars(self):
        return [
            {'id': 'p1', 'name': 'Cardio'},
            {'id': 'p2', 'name': 'Technical'},
            {'id': 'p3', 'name': 'Sparring'},
            {'id': 'p4', 'name': 'Mental'},
            {'id': 'p5', 'name': 'Discipline'},
        ]

    def _make_scores(self, pillar_id, scores):
        return [
            {
                'criterion_id': f'{pillar_id}_c{i}',
                'pillar_id': pillar_id,
                'pillar_name': pillar_id,
                'boxing_score': s,
                'kickboxing_score': None,
            }
            for i, s in enumerate(scores, 1)
        ]

    def test_full_assessment_all_tens(self):
        pillars = self._make_pillars()
        raw = []
        for p in pillars:
            raw += self._make_scores(p['id'], [10, 10, 10, 10, 10])

        result = process_session_legacy(raw, pillars)

        self.assertEqual(result.overall_score, D('10.00'))
        self.assertEqual(result.grade_percentage, D('100.00'))

    def test_beginner_scores(self):
        pillars = self._make_pillars()
        raw = []
        for p in pillars:
            raw += self._make_scores(p['id'], [3, 3, 3, 3, 3])

        result = process_session_legacy(raw, pillars)

        self.assertEqual(result.overall_score, D('3.00'))
        self.assertEqual(result.grade_percentage, D('30.00'))

    def test_mixed_boxing_kickboxing(self):
        pillar = {'id': 'p1', 'name': 'Technical'}
        raw = [
            {'criterion_id': 'c1', 'pillar_id': 'p1', 'pillar_name': 'Technical',
             'boxing_score': 8, 'kickboxing_score': None},
            {'criterion_id': 'c2', 'pillar_id': 'p1', 'pillar_name': 'Technical',
             'boxing_score': None, 'kickboxing_score': 6},
        ]
        result = process_session_legacy(raw, [pillar])
        scores = [cr.effective_score for pr in result.pillar_results for cr in pr.criterion_results]
        self.assertIn(D('8.00'), scores)
        self.assertIn(D('6.00'), scores)

    def test_empty_session_returns_none_overall(self):
        pillars = self._make_pillars()
        raw = [
            {
                'criterion_id': 'p1_c1', 'pillar_id': 'p1', 'pillar_name': 'Cardio',
                'boxing_score': None, 'kickboxing_score': None,
            }
        ]
        result = process_session_legacy(raw, pillars)
        self.assertIsNone(result.overall_score)


class TestProcessSessionPoints(TestCase):
    def _make_pillars(self):
        return [
            {'id': 'p1', 'name': 'Cardio'},
            {'id': 'p2', 'name': 'Technical'},
        ]

    def test_sums_deltas_per_pillar_and_net(self):
        pillars = self._make_pillars()
        raw = [
            {'criterion_id': 'c1', 'pillar_id': 'p1', 'pillar_name': 'Cardio', 'delta': D('1')},
            {'criterion_id': 'c2', 'pillar_id': 'p1', 'pillar_name': 'Cardio', 'delta': D('-2')},
            {'criterion_id': 'c3', 'pillar_id': 'p2', 'pillar_name': 'Technical', 'delta': D('3')},
        ]
        result = process_session(raw, pillars)

        by_id = {pr.pillar_id: pr.delta for pr in result.pillar_results}
        self.assertEqual(by_id['p1'], D('-1.00'))
        self.assertEqual(by_id['p2'], D('3.00'))
        self.assertEqual(result.net_delta, D('2.00'))

    def test_untouched_criterion_defaults_to_zero(self):
        pillars = self._make_pillars()
        raw = [
            {'criterion_id': 'c1', 'pillar_id': 'p1', 'pillar_name': 'Cardio', 'delta': None},
        ]
        result = process_session(raw, pillars)
        by_id = {pr.pillar_id: pr.delta for pr in result.pillar_results}
        self.assertEqual(by_id['p1'], D('0.00'))
        self.assertEqual(by_id['p2'], D('0.00'))
        self.assertEqual(result.net_delta, D('0.00'))

    def test_no_criteria_returns_zero(self):
        pillars = self._make_pillars()
        result = process_session([], pillars)
        self.assertEqual(result.net_delta, D('0.00'))


class TestUpdateRatingFromPoints(TestCase):
    def test_provisional_k_used_for_new_students(self):
        rating = update_rating_from_points(RATING_START, D('2'), prior_assessment_count=0)
        expected_k = k_factor_points(0)
        self.assertEqual(rating, RATING_START + D('2') * expected_k)

    def test_established_k_used_after_provisional_period(self):
        rating = update_rating_from_points(RATING_START, D('2'), prior_assessment_count=10)
        expected_k = k_factor_points(10)
        self.assertEqual(rating, RATING_START + D('2') * expected_k)
        self.assertLess(k_factor_points(10), k_factor_points(0))

    def test_negative_delta_lowers_rating(self):
        rating = update_rating_from_points(RATING_START, D('-3'), prior_assessment_count=10)
        self.assertLess(rating, RATING_START)

    def test_zero_delta_leaves_rating_unchanged(self):
        rating = update_rating_from_points(RATING_START, D('0'), prior_assessment_count=10)
        self.assertEqual(rating, RATING_START)
