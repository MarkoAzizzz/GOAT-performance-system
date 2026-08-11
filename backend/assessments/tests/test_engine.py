from decimal import Decimal
from django.test import TestCase
from assessments.engine import (
    effective_criterion_score,
    pillar_score,
    overall_score,
    grade_percentage,
    improvement,
    process_session,
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


class TestPillarScore(TestCase):
    def test_full_pillar(self):
        scores = [D('8'), D('7'), D('9'), D('6'), D('10')]
        self.assertEqual(pillar_score(scores), D('8.00'))

    def test_skips_none(self):
        scores = [D('8'), None, D('6')]
        self.assertEqual(pillar_score(scores), D('7.00'))

    def test_all_none_returns_none(self):
        self.assertIsNone(pillar_score([None, None]))

    def test_single_score(self):
        self.assertEqual(pillar_score([D('7.50')]), D('7.50'))


class TestOverallScore(TestCase):
    def test_five_equal_pillars(self):
        scores = [D('8'), D('8'), D('8'), D('8'), D('8')]
        self.assertEqual(overall_score(scores), D('8.00'))

    def test_mixed_pillars(self):
        scores = [D('10'), D('6'), D('8'), D('4'), D('7')]
        self.assertEqual(overall_score(scores), D('7.00'))

    def test_skips_none(self):
        scores = [D('8'), None, D('6')]
        self.assertEqual(overall_score(scores), D('7.00'))

    def test_all_none_returns_none(self):
        self.assertIsNone(overall_score([None, None, None]))


class TestGradePercentage(TestCase):
    def test_perfect_score(self):
        self.assertEqual(grade_percentage(D('10')), D('100.00'))

    def test_zero(self):
        self.assertEqual(grade_percentage(D('0')), D('0.00'))

    def test_midrange(self):
        self.assertEqual(grade_percentage(D('7.5')), D('75.00'))

    def test_none_returns_none(self):
        self.assertIsNone(grade_percentage(None))


class TestImprovement(TestCase):
    def test_positive(self):
        self.assertEqual(improvement(D('75'), D('60')), D('15.00'))

    def test_negative(self):
        self.assertEqual(improvement(D('55'), D('70')), D('-15.00'))

    def test_no_change(self):
        self.assertEqual(improvement(D('70'), D('70')), D('0.00'))

    def test_current_none(self):
        self.assertIsNone(improvement(None, D('70')))

    def test_previous_none(self):
        self.assertIsNone(improvement(D('70'), None))


class TestProcessSession(TestCase):
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

        result = process_session(raw, pillars)

        self.assertEqual(result.overall_score, D('10.00'))
        self.assertEqual(result.grade_percentage, D('100.00'))

    def test_beginner_scores(self):
        pillars = self._make_pillars()
        raw = []
        for p in pillars:
            raw += self._make_scores(p['id'], [3, 3, 3, 3, 3])

        result = process_session(raw, pillars)

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
        result = process_session(raw, [pillar])
        scores = [cr.effective_score for pr in result.pillar_results for cr in pr.criterion_results]
        self.assertIn(D('8.00'), scores)
        self.assertIn(D('6.00'), scores)

    def test_empty_session_returns_none_overall(self):
        pillars = self._make_pillars()
        raw = [
            {
                'criterion_id': f'p1_c1', 'pillar_id': 'p1', 'pillar_name': 'Cardio',
                'boxing_score': None, 'kickboxing_score': None,
            }
        ]
        result = process_session(raw, pillars)
        self.assertIsNone(result.overall_score)
