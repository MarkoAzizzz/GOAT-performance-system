import datetime
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User
from students.models import Branch, Student
from assessments.models import AssessmentTemplate, Pillar, Criterion, AssessmentSession
from .models import LeaderboardSnapshot
from .services import refresh_student


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


def give_rating(student, rating_before, rating_after, date=datetime.date(2026, 6, 1)):
    """
    Writes an AssessmentSession with the rating already resolved, bypassing
    the coach-entry pipeline — refresh_student only reads rating_before/
    rating_after off the latest session, so this is enough to drive the
    leaderboard without re-deriving the full scoring engine in every test.
    """
    AssessmentSession.objects.create(
        student=student, template=AssessmentTemplate.objects.first(),
        martial_art=student.sport, assessment_date=date,
        rating_before=rating_before, rating_after=rating_after,
        # refresh_student only picks up sessions where this (or overall_score)
        # is set — it's what marks a session as "scored" versus a draft row.
        net_delta=rating_after - rating_before,
    )
    refresh_student(student)


def auth_admin(client):
    resp = client.post('/api/v1/auth/login/', {'email': 'admin@goat.com', 'password': 'Admin123!'}, format='json')
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["data"]["access"]}')


class LeaderboardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_admin()
        auth_admin(self.client)
        self.branch = make_branch()
        make_template()
        self.s1 = make_student(self.branch, 'ali@goat.com', 'boxing')
        self.s2 = make_student(self.branch, 'sara@goat.com', 'kickboxing')
        self.s3 = make_student(self.branch, 'omar@goat.com', 'boxing')
        give_rating(self.s1, 1000, 1080)
        give_rating(self.s2, 1000, 1075)
        give_rating(self.s3, 1000, 1090)

    def test_leaderboard_returns_all(self):
        resp = self.client.get('/api/v1/leaderboard/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['data']), 3)

    def test_ordered_by_rating_desc(self):
        resp = self.client.get('/api/v1/leaderboard/')
        ratings = [float(e['current_rating']) for e in resp.data['data']]
        self.assertEqual(ratings, sorted(ratings, reverse=True))

    def test_rank_matches_order_and_is_contiguous(self):
        resp = self.client.get('/api/v1/leaderboard/')
        ranks = [e['rank'] for e in resp.data['data']]
        self.assertEqual(ranks, [1, 2, 3])

    def test_deactivated_student_is_excluded_and_ranks_stay_contiguous(self):
        self.s3.is_active = False
        self.s3.save(update_fields=['is_active'])
        refresh_student(self.s1)  # any refresh re-ranks everyone
        resp = self.client.get('/api/v1/leaderboard/')
        ids = [e['student_id'] for e in resp.data['data']]
        self.assertNotIn(self.s3.student_id, ids)
        ranks = [e['rank'] for e in resp.data['data']]
        self.assertEqual(ranks, [1, 2])

    def test_higher_rating_never_ranks_below_a_lower_one(self):
        # Regression guard for the comparator bug: every entry's rank must
        # agree with its position in the rating-sorted order, not just look
        # plausible in isolation.
        resp = self.client.get('/api/v1/leaderboard/')
        by_rank = sorted(resp.data['data'], key=lambda e: e['rank'])
        ratings_by_rank = [float(e['current_rating']) for e in by_rank]
        self.assertEqual(ratings_by_rank, sorted(ratings_by_rank, reverse=True))

    def test_rank_movement_tracked_on_recompute(self):
        # s2 starts in 3rd (1075 is lowest of the three) and jumps to 1st.
        give_rating(self.s2, 1075, 1200, date=datetime.date(2026, 6, 8))
        resp = self.client.get('/api/v1/leaderboard/')
        s2_row = next(e for e in resp.data['data'] if e['student_id'] == self.s2.student_id)
        self.assertEqual(s2_row['rank'], 1)
        self.assertEqual(s2_row['previous_rank'], 3)

    def test_filter_by_sport(self):
        resp = self.client.get('/api/v1/leaderboard/?sport=boxing')
        sports = [e['sport'] for e in resp.data['data']]
        self.assertTrue(all(s == 'boxing' for s in sports))

    def test_requires_auth(self):
        self.client.credentials()
        resp = self.client.get('/api/v1/leaderboard/')
        self.assertEqual(resp.status_code, 401)

    def test_response_shape(self):
        resp = self.client.get('/api/v1/leaderboard/')
        entry = resp.data['data'][0]
        for field in [
            'student_uuid', 'student_id', 'student_name', 'sport',
            'current_rating', 'rating_change', 'rank', 'previous_rank',
        ]:
            self.assertIn(field, entry)

    def test_student_uuid_matches_the_real_student_id(self):
        resp = self.client.get('/api/v1/leaderboard/')
        row = next(e for e in resp.data['data'] if e['student_id'] == self.s1.student_id)
        self.assertEqual(row['student_uuid'], str(self.s1.id))
