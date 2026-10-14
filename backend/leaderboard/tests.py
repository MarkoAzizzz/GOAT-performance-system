import datetime
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User
from students.models import Branch, Student
from assessments.models import AssessmentTemplate, Pillar, Criterion, AssessmentSession
from .models import LeaderboardSnapshot
from .services import recompute_ranks


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


def make_session(student, template, date, rating_after, rating_before=None):
    return AssessmentSession.objects.create(
        student=student, template=template,
        assessment_date=date,
        rating_before=rating_before,
        rating_after=rating_after,
        net_delta=(rating_after - rating_before) if rating_before is not None else None,
        martial_art=student.sport,
    )


def make_snapshot(student, current, previous=None, change=None, total=1):
    s1 = make_session(
        student, AssessmentTemplate.objects.first(),
        datetime.date(2026, 6, 1), rating_after=current, rating_before=previous,
    )
    snap = LeaderboardSnapshot(
        student=student,
        latest_session=s1,
        current_rating=current,
        previous_rating=previous,
        rating_change=change,
        total_assessments=total,
    )
    snap.save()
    return snap


def auth_admin(client):
    resp = client.post('/api/v1/auth/login/', {'email': 'admin@goat.com', 'password': 'Admin123!'}, format='json')
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["data"]["access"]}')


class LeaderboardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_admin()
        auth_admin(self.client)
        branch = make_branch()
        make_template()
        self.s1 = make_student(branch, 'ali@goat.com', 'boxing')
        self.s2 = make_student(branch, 'sara@goat.com', 'kickboxing')
        self.s3 = make_student(branch, 'omar@goat.com', 'boxing')
        make_snapshot(self.s1, current=80, previous=60, change=20, total=2)
        make_snapshot(self.s2, current=75, previous=70, change=5, total=2)
        make_snapshot(self.s3, current=90, previous=50, change=40, total=2)

    def test_leaderboard_returns_all(self):
        resp = self.client.get('/api/v1/leaderboard/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['data']), 3)

    def test_ordered_by_rating_desc(self):
        resp = self.client.get('/api/v1/leaderboard/')
        ratings = [float(e['current_rating']) for e in resp.data['data']]
        self.assertEqual(ratings, sorted(ratings, reverse=True))

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


class RankTests(TestCase):
    def setUp(self):
        branch = make_branch()
        make_template()
        self.s1 = make_student(branch, 'ali@goat.com', 'boxing')
        self.s2 = make_student(branch, 'sara@goat.com', 'boxing')
        self.s3 = make_student(branch, 'omar@goat.com', 'boxing')

    def test_ranks_assigned_by_rating(self):
        make_snapshot(self.s1, current=1100, previous=1090, change=10)
        make_snapshot(self.s2, current=1200, previous=1180, change=20)
        make_snapshot(self.s3, current=1000, previous=1000, change=0)
        recompute_ranks()

        self.assertEqual(LeaderboardSnapshot.objects.get(student=self.s2).rank, 1)
        self.assertEqual(LeaderboardSnapshot.objects.get(student=self.s1).rank, 2)
        self.assertEqual(LeaderboardSnapshot.objects.get(student=self.s3).rank, 3)

    def test_previous_rank_captures_movement(self):
        make_snapshot(self.s1, current=1100, previous=1090, change=10)
        make_snapshot(self.s2, current=1200, previous=1180, change=20)
        recompute_ranks()

        # s1 overtakes s2, so its previous_rank must still read 2 for the UI
        # to render a climb rather than silently showing no movement.
        snap = LeaderboardSnapshot.objects.get(student=self.s1)
        snap.current_rating = 1300
        snap.save(update_fields=['current_rating'])
        recompute_ranks()

        s1 = LeaderboardSnapshot.objects.get(student=self.s1)
        self.assertEqual((s1.previous_rank, s1.rank), (2, 1))

    def test_snapshot_without_rating_sorts_last(self):
        make_snapshot(self.s1, current=1100, previous=1090, change=10)
        unrated = make_snapshot(self.s2, current=1000, previous=None, change=None)
        LeaderboardSnapshot.objects.filter(pk=unrated.pk).update(current_rating=None)
        recompute_ranks()

        self.assertEqual(LeaderboardSnapshot.objects.get(student=self.s1).rank, 1)
        self.assertEqual(LeaderboardSnapshot.objects.get(student=self.s2).rank, 2)
