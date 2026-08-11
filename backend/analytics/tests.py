import datetime
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User
from students.models import Branch, Student
from assessments.models import AssessmentTemplate, Pillar, Criterion, AssessmentSession
from leaderboard.models import LeaderboardSnapshot


def make_admin():
    u = User(email='admin@goat.com', full_name='Admin', role='admin', is_active=True)
    u.set_password('Admin123!')
    u.save()
    return u


def make_branch():
    return Branch.objects.create(name='Main', location='Cairo', is_active=True)


_student_counter = 0

def make_student(branch, email, sport='boxing'):
    global _student_counter
    _student_counter += 1
    u = User(email=email, full_name=email.split('@')[0], role='student', is_active=True)
    u.set_password('Pass123!')
    u.save()
    return Student.objects.create(
        user=u, branch=branch, sport=sport,
        student_id=f'TEST-{_student_counter:03d}',
        join_date=datetime.date(2026, 1, 1), is_active=True,
    )


def make_template():
    t = AssessmentTemplate.objects.create(name='v1', version=1, is_active=True)
    p = Pillar.objects.create(template=t, name='Cardio', order=1)
    Criterion.objects.create(pillar=p, name='C1', order=1, is_sport_specific=False)
    return t


def make_session(student, template, score=70.0):
    return AssessmentSession.objects.create(
        student=student, template=template,
        assessment_date=datetime.date(2026, 6, 1),
        overall_score=score, grade_percentage=score,
        martial_art=student.sport,
    )


def auth_admin(client):
    resp = client.post('/api/v1/auth/login/', {'email': 'admin@goat.com', 'password': 'Admin123!'}, format='json')
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["data"]["access"]}')


class AdminSummaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_admin()
        auth_admin(self.client)
        branch = make_branch()
        t = make_template()
        s1 = make_student(branch, 'a@goat.com', 'boxing', 'beginner')
        s2 = make_student(branch, 'b@goat.com', 'kickboxing', 'intermediate')
        make_session(s1, t, 60.0)
        make_session(s2, t, 80.0)

    def test_summary_returns_200(self):
        resp = self.client.get('/api/v1/analytics/summary/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['success'])

    def test_summary_fields_present(self):
        resp = self.client.get('/api/v1/analytics/summary/')
        data = resp.data['data']
        for field in ['total_students', 'active_students', 'weekly_assessments',
                      'average_score', 'highest_score', 'lowest_score',
                      'grade_distribution', 'weekly_trend']:
            self.assertIn(field, data)

    def test_summary_counts_correct(self):
        resp = self.client.get('/api/v1/analytics/summary/')
        data = resp.data['data']
        self.assertEqual(data['total_students'], 2)
        self.assertEqual(data['active_students'], 2)

    def test_summary_score_stats(self):
        resp = self.client.get('/api/v1/analytics/summary/')
        data = resp.data['data']
        self.assertEqual(float(data['average_score']), 70.0)
        self.assertEqual(float(data['highest_score']), 80.0)
        self.assertEqual(float(data['lowest_score']), 60.0)

    def test_summary_requires_admin(self):
        su = User(email='s@goat.com', full_name='S', role='student', is_active=True)
        su.set_password('Pass123!')
        su.save()
        resp2 = self.client.post('/api/v1/auth/login/', {'email': 's@goat.com', 'password': 'Pass123!'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp2.data["data"]["access"]}')
        resp = self.client.get('/api/v1/analytics/summary/')
        self.assertEqual(resp.status_code, 403)

    def test_weekly_trend_length(self):
        resp = self.client.get('/api/v1/analytics/summary/')
        trend = resp.data['data']['weekly_trend']
        self.assertEqual(len(trend), 8)


class SportBreakdownTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_admin()
        auth_admin(self.client)
        branch = make_branch()
        t = make_template()
        make_session(make_student(branch, 'box@goat.com', 'boxing'), t, 70.0)
        make_session(make_student(branch, 'kick@goat.com', 'kickboxing'), t, 80.0)

    def test_returns_both_sports(self):
        resp = self.client.get('/api/v1/analytics/sport-breakdown/')
        self.assertEqual(resp.status_code, 200)
        sports = [s['sport'] for s in resp.data['data']]
        self.assertIn('boxing', sports)
        self.assertIn('kickboxing', sports)

    def test_sport_fields_present(self):
        resp = self.client.get('/api/v1/analytics/sport-breakdown/')
        entry = resp.data['data'][0]
        for field in ['sport', 'total_students', 'active_students', 'average_score', 'level_distribution']:
            self.assertIn(field, entry)


class TopPerformersTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_admin()
        auth_admin(self.client)
        branch = make_branch()
        t = make_template()
        for i, (email, score) in enumerate([
            ('a@goat.com', 90), ('b@goat.com', 70), ('c@goat.com', 80),
        ]):
            s = make_student(branch, email)
            sess = make_session(s, t, float(score))
            LeaderboardSnapshot.objects.create(
                student=s, latest_session=sess,
                current_score=score, improvement=score - 50,
                total_assessments=1,
            )

    def test_top_performers_by_score(self):
        resp = self.client.get('/api/v1/analytics/top-performers/')
        self.assertEqual(resp.status_code, 200)
        by_score = resp.data['data']['by_score']
        scores = [e['current_score'] for e in by_score]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_top_performers_by_improvement(self):
        resp = self.client.get('/api/v1/analytics/top-performers/')
        by_imp = resp.data['data']['by_improvement']
        improvements = [e['improvement'] for e in by_imp]
        self.assertEqual(improvements, sorted(improvements, reverse=True))


class ScoreDistributionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_admin()
        auth_admin(self.client)
        branch = make_branch()
        t = make_template()
        for email, score in [('a@goat.com', 30), ('b@goat.com', 65), ('c@goat.com', 90)]:
            make_session(make_student(branch, email), t, float(score))

    def test_returns_5_buckets(self):
        resp = self.client.get('/api/v1/analytics/score-distribution/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['data']), 5)

    def test_bucket_labels(self):
        resp = self.client.get('/api/v1/analytics/score-distribution/')
        labels = [b['range'] for b in resp.data['data']]
        self.assertIn('0-20', labels)
        self.assertIn('81-100', labels)

    def test_bucket_counts_sum_correctly(self):
        resp = self.client.get('/api/v1/analytics/score-distribution/')
        total = sum(b['count'] for b in resp.data['data'])
        self.assertEqual(total, 3)
