import datetime
from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User
from students.models import Branch, Student
from assessments.models import AssessmentTemplate, Pillar, Criterion, AssessmentSession, PillarScore
from assessments.coach_service import recompute_standings


def make_admin():
    u = User(email='admin@goat.com', full_name='Admin', role='admin', is_active=True)
    u.set_password('Admin123!')
    u.save()
    return u


def make_branch():
    return Branch.objects.create(name='Main', location='Cairo', is_active=True)


_student_counter = 0

def make_student(branch, sport='boxing'):
    global _student_counter
    _student_counter += 1
    u = User(email=f'{sport}{_student_counter}@goat.com', full_name=f'{sport.title()} Fighter', role='student', is_active=True)
    u.set_password('Pass123!')
    u.save()
    return Student.objects.create(
        user=u, branch=branch, sport=sport,
        student_id=f'TEST-{_student_counter:03d}',
        join_date=datetime.date(2026, 1, 1), is_active=True,
    )


def make_template():
    t = AssessmentTemplate.objects.create(name='GOAT v1', version=1, is_active=True)
    pillar_names = ['Cardio', 'Technical', 'Sparring', 'Mental', 'Discipline']
    for i, pname in enumerate(pillar_names):
        p = Pillar.objects.create(template=t, name=pname, order=i + 1)
        for j in range(5):
            Criterion.objects.create(
                pillar=p, name=f'{pname} Criterion {j+1}', order=j + 1,
                is_sport_specific=False,
            )
    return t


def make_session(student, template, date=None, score=70.0):
    return AssessmentSession.objects.create(
        student=student,
        template=template,
        assessment_date=date or datetime.date(2026, 6, 1),
        overall_score=score,
        grade_percentage=score,
        martial_art=student.sport,
    )


def auth_admin(client):
    resp = client.post('/api/v1/auth/login/', {
        'email': 'admin@goat.com', 'password': 'Admin123!'
    }, format='json')
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["data"]["access"]}')


class AssessmentListTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_admin()
        auth_admin(self.client)
        branch = make_branch()
        self.template = make_template()
        self.boxer = make_student(branch, 'boxing')
        self.kicker = make_student(branch, 'kickboxing')
        make_session(self.boxer, self.template)
        make_session(self.kicker, self.template)

    def test_list_all_assessments(self):
        resp = self.client.get('/api/v1/assessments/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['data']), 2)

    def test_filter_by_martial_art(self):
        resp = self.client.get('/api/v1/assessments/?martial_art=boxing')
        self.assertEqual(len(resp.data['data']), 1)
        self.assertEqual(resp.data['data'][0]['martial_art'], 'boxing')

    def test_filter_by_student(self):
        resp = self.client.get(f'/api/v1/assessments/?student={self.boxer.id}')
        self.assertEqual(len(resp.data['data']), 1)

    def test_requires_auth(self):
        self.client.credentials()
        resp = self.client.get('/api/v1/assessments/')
        self.assertEqual(resp.status_code, 401)


class AssessmentDetailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_admin()
        auth_admin(self.client)
        branch = make_branch()
        t = make_template()
        student = make_student(branch)
        self.session = make_session(student, t)

    def test_get_detail(self):
        resp = self.client.get(f'/api/v1/assessments/{self.session.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(str(resp.data['data']['id']), str(self.session.id))

    def test_get_nonexistent_404(self):
        import uuid
        resp = self.client.get(f'/api/v1/assessments/{uuid.uuid4()}/')
        self.assertEqual(resp.status_code, 404)


class StudentProgressTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_admin()
        auth_admin(self.client)
        branch = make_branch()
        t = make_template()
        self.student = make_student(branch)
        make_session(self.student, t, datetime.date(2026, 5, 1), score=60.0)
        make_session(self.student, t, datetime.date(2026, 6, 1), score=75.0)

    def test_progress_returns_sessions(self):
        resp = self.client.get(f'/api/v1/students/{self.student.id}/progress/')
        self.assertEqual(resp.status_code, 200)
        data = resp.data['data']
        self.assertIn('history', data)
        self.assertEqual(len(data['history']), 2)

    def test_progress_current_score(self):
        resp = self.client.get(f'/api/v1/students/{self.student.id}/progress/')
        data = resp.data['data']
        self.assertEqual(float(data['current_score']), 75.0)

    def test_progress_nonexistent_student(self):
        import uuid
        resp = self.client.get(f'/api/v1/students/{uuid.uuid4()}/progress/')
        self.assertEqual(resp.status_code, 404)


class PillarStandingReplayTests(TestCase):
    """A points-based (new-style) session's pillar standing must seed from
    whatever the student's last legacy (absolute 0-10) session recorded for
    that pillar, not from zero — see coach_service.recompute_standings."""

    def setUp(self):
        branch = make_branch()
        self.template = make_template()
        self.pillar = Pillar.objects.filter(template=self.template).order_by('order').first()
        self.student = make_student(branch)

        self.legacy_session = make_session(
            self.student, self.template, datetime.date(2026, 5, 1), score=75.0,
        )
        PillarScore.objects.create(session=self.legacy_session, pillar=self.pillar, score=Decimal('7.50'))

        self.points_session = AssessmentSession.objects.create(
            student=self.student, template=self.template,
            assessment_date=datetime.date(2026, 6, 1), martial_art=self.student.sport,
            net_delta=Decimal('2.0'),
        )
        PillarScore.objects.create(session=self.points_session, pillar=self.pillar, delta=Decimal('2.0'))

    def test_new_session_standing_seeds_from_legacy_score(self):
        recompute_standings(self.student)

        ps = PillarScore.objects.get(session=self.points_session, pillar=self.pillar)
        self.assertEqual(ps.standing_before, Decimal('7.50'))
        self.assertEqual(ps.standing_after, Decimal('9.50'))

    def test_rating_continues_from_legacy_chain(self):
        recompute_standings(self.student)

        self.legacy_session.refresh_from_db()
        self.points_session.refresh_from_db()
        self.student.refresh_from_db()

        # The points-based session's rating_before must equal the legacy
        # session's rating_after — no discontinuity at the switchover.
        self.assertEqual(self.points_session.rating_before, self.legacy_session.rating_after)
        self.assertEqual(self.student.rating, self.points_session.rating_after)
