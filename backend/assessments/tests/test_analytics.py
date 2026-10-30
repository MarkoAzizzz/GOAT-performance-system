import datetime
from django.test import TestCase
from rest_framework.test import APIClient
from assessments.models import AssessmentSession, PillarScore
from .test_api import make_admin, make_branch, make_student, make_template, auth_admin


def give_rating(student, template, rating_after, pillar_standings=None, date=None):
    """
    Writes a session with rating_after (and optional per-pillar
    standing_after rows) set directly — get_sport_analytics only reads
    those two things, so there's no need to run the full scoring engine.
    """
    session = AssessmentSession.objects.create(
        student=student, template=template, martial_art=student.sport,
        assessment_date=date or datetime.date(2026, 6, 1),
        rating_before=1000, rating_after=rating_after, net_delta=rating_after - 1000,
    )
    for pillar, standing in (pillar_standings or {}).items():
        PillarScore.objects.create(session=session, pillar=pillar, standing_after=standing)
    # get_sport_analytics reads Student.rating, which coach_service keeps in
    # sync with the latest session's rating_after in production.
    student.rating = rating_after
    student.save(update_fields=['rating'])
    return session


class SportAnalyticsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_admin()
        auth_admin(self.client)
        branch = make_branch()
        self.template = make_template()
        self.pillars = list(self.template.pillars.all())

        self.boxer1 = make_student(branch, 'boxing')
        self.boxer2 = make_student(branch, 'boxing')
        self.kickboxer = make_student(branch, 'kickboxing')  # never assessed

        give_rating(self.boxer1, self.template, 1050, {self.pillars[0]: 80, self.pillars[1]: 60})
        give_rating(self.boxer2, self.template, 1020, {self.pillars[0]: 40})

    def test_requires_admin(self):
        self.client.credentials()
        resp = self.client.get('/api/v1/assessments/analytics/')
        self.assertEqual(resp.status_code, 401)

    def test_roster_counts_and_averages_per_sport(self):
        resp = self.client.get('/api/v1/assessments/analytics/')
        self.assertEqual(resp.status_code, 200)
        boxing = resp.data['data']['boxing']
        self.assertEqual(boxing['total_members'], 2)
        self.assertEqual(boxing['average_rating'], 1035.0)
        self.assertEqual(boxing['average_lifetime_gain'], 35.0)

    def test_never_assessed_student_excluded_from_averages_not_roster(self):
        resp = self.client.get('/api/v1/assessments/analytics/')
        kickboxing = resp.data['data']['kickboxing']
        self.assertEqual(kickboxing['total_members'], 1)
        self.assertIsNone(kickboxing['average_rating'])
        self.assertEqual(kickboxing['most_improved'], [])

    def test_most_improved_ranked_highest_first(self):
        resp = self.client.get('/api/v1/assessments/analytics/')
        names = [m['student_id'] for m in resp.data['data']['boxing']['most_improved']]
        self.assertEqual(names, [self.boxer1.student_id, self.boxer2.student_id])

    def test_pillar_strength_averages_latest_standings(self):
        resp = self.client.get('/api/v1/assessments/analytics/')
        by_name = {p['pillar_name']: p['average'] for p in resp.data['data']['boxing']['pillar_strength']}
        # Pillar 0 (Cardio): boxer1=80, boxer2=40 -> avg 60. Pillar 1 (Technical):
        # only boxer1=60 touched it, boxer2 never scored it.
        self.assertEqual(by_name['Cardio'], 60.0)
        self.assertEqual(by_name['Technical'], 60.0)
        self.assertIsNone(by_name['Sparring'])
