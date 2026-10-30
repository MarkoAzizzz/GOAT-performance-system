import datetime
from unittest.mock import patch

from accounts.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from students.models import Branch, Student

from .models import SessionCheckIn, SessionPackage
from .services import PackageError, assign_package, check_in, undo_check_in


def make_admin():
    u = User(email='admin@goat.com', full_name='Admin', role='admin', is_active=True)
    u.set_password('Admin123!')
    u.save()
    return u


def make_student(branch, email='ali@goat.com', code='PKG-001'):
    u = User(email=email, full_name='Ali', role='student', is_active=True)
    u.set_password('Pass123!')
    u.save()
    return Student.objects.create(
        user=u, branch=branch, sport='boxing', student_id=code,
        join_date=datetime.date(2026, 1, 1), is_active=True,
    )


class PackageServiceTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name='Main', location='Cairo', is_active=True)
        self.student = make_student(self.branch)

    def test_check_in_decrements_remaining(self):
        package = assign_package(self.student, 8)
        check_in(self.student)
        package.refresh_from_db()
        self.assertEqual(package.remaining_sessions, 7)

    def test_check_in_without_package_is_refused(self):
        with self.assertRaises(PackageError):
            check_in(self.student)

    def test_check_in_past_zero_is_refused(self):
        assign_package(self.student, 8)
        for _ in range(8):
            check_in(self.student)
        with self.assertRaises(PackageError):
            check_in(self.student)

    def test_undo_returns_the_session(self):
        package = assign_package(self.student, 8)
        entry = check_in(self.student)
        undo_check_in(entry.id, self.student)
        package.refresh_from_db()
        self.assertEqual(package.remaining_sessions, 8)

    def test_renewal_closes_the_previous_package(self):
        first = assign_package(self.student, 8)
        check_in(self.student)
        second = assign_package(self.student, 12)

        first.refresh_from_db()
        self.assertIsNotNone(first.closed_at)
        # Leftovers are not carried into the renewal.
        self.assertEqual(second.remaining_sessions, 12)

    def test_check_ins_land_on_the_current_package_only(self):
        first = assign_package(self.student, 8)
        second = assign_package(self.student, 12)
        check_in(self.student)

        self.assertEqual(first.check_ins.count(), 0)
        self.assertEqual(second.check_ins.count(), 1)

    def test_rejects_unsupported_sizes(self):
        with self.assertRaises(PackageError):
            assign_package(self.student, 10)


class PackageNotificationTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name='Main', location='Cairo', is_active=True)
        self.student = make_student(self.branch)

    @patch('packages.services.send_to_user')
    def test_warns_once_at_one_remaining(self, mock_send):
        assign_package(self.student, 8)
        # Assigning notifies too; this test is only about the check-in path.
        mock_send.reset_mock()
        for _ in range(7):
            check_in(self.student)

        self.assertEqual(mock_send.call_count, 1)
        self.assertIn('1 session', mock_send.call_args.kwargs['title'])

    @patch('packages.services.send_to_user')
    def test_notifies_when_package_is_finished(self, mock_send):
        assign_package(self.student, 8)
        mock_send.reset_mock()
        for _ in range(8):
            check_in(self.student)

        # One at 1 remaining, one at 0 — not on every check-in.
        self.assertEqual(mock_send.call_count, 2)
        self.assertEqual(mock_send.call_args.kwargs['data']['type'], 'package_exhausted')

    @patch('packages.services.send_to_user')
    def test_first_package_is_welcomed(self, mock_send):
        assign_package(self.student, 12)

        self.assertEqual(mock_send.call_count, 1)
        self.assertEqual(mock_send.call_args.kwargs['title'], 'Welcome to GOAT')
        self.assertIn('12 sessions', mock_send.call_args.kwargs['body'])

    @patch('packages.services.send_to_user')
    def test_second_package_reads_as_a_renewal(self, mock_send):
        assign_package(self.student, 8)
        mock_send.reset_mock()
        assign_package(self.student, 12)

        self.assertEqual(mock_send.call_args.kwargs['title'], 'Package renewed')
        self.assertIn('12 sessions', mock_send.call_args.kwargs['body'])

    @patch('packages.services.send_to_user')
    def test_renewal_is_detected_from_history_not_open_packages(self, mock_send):
        # The first package is closed by the renewal, so "has any package"
        # must be checked against history or every renewal looks like a first.
        assign_package(self.student, 8)
        for _ in range(8):
            check_in(self.student)
        mock_send.reset_mock()
        assign_package(self.student, 8)

        self.assertEqual(mock_send.call_args.kwargs['title'], 'Package renewed')

    @patch('packages.services.send_to_user')
    def test_quiet_while_the_package_is_healthy(self, mock_send):
        assign_package(self.student, 12)
        mock_send.reset_mock()
        for _ in range(5):
            check_in(self.student)
        mock_send.assert_not_called()


class PackageApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_admin()
        resp = self.client.post(
            '/api/v1/auth/login/',
            {'email': 'admin@goat.com', 'password': 'Admin123!'},
            format='json',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["data"]["access"]}')
        self.branch = Branch.objects.create(name='Main', location='Cairo', is_active=True)
        self.student = make_student(self.branch)

    def test_roster_lists_students_without_a_package(self):
        resp = self.client.get('/api/v1/packages/check-in/')
        self.assertEqual(resp.status_code, 200)
        row = resp.data['data'][0]
        self.assertFalse(row['has_package'])
        self.assertIsNone(row['remaining_sessions'])

    def test_assign_then_check_in(self):
        assign = self.client.post(
            f'/api/v1/packages/{self.student.id}/assign/',
            {'total_sessions': 8}, format='json',
        )
        self.assertEqual(assign.status_code, 201)

        resp = self.client.post(f'/api/v1/packages/{self.student.id}/check-in/', format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['data']['remaining_sessions'], 7)

    def test_check_in_without_package_returns_400(self):
        resp = self.client.post(f'/api/v1/packages/{self.student.id}/check-in/', format='json')
        self.assertEqual(resp.status_code, 400)

    def test_students_cannot_see_the_roster(self):
        self.client.credentials()
        login = self.client.post(
            '/api/v1/auth/login/',
            {'email': 'ali@goat.com', 'password': 'Pass123!'},
            format='json',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["data"]["access"]}')
        resp = self.client.get('/api/v1/packages/check-in/')
        self.assertEqual(resp.status_code, 403)

    def test_student_sees_their_own_balance(self):
        assign_package(self.student, 12)
        self.client.credentials()
        login = self.client.post(
            '/api/v1/auth/login/',
            {'email': 'ali@goat.com', 'password': 'Pass123!'},
            format='json',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["data"]["access"]}')
        resp = self.client.get('/api/v1/packages/me/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['data']['remaining_sessions'], 12)

    def test_student_sees_full_package_history_newest_first(self):
        assign_package(self.student, 8)
        check_in(self.student)
        assign_package(self.student, 12)
        self.client.credentials()
        login = self.client.post(
            '/api/v1/auth/login/',
            {'email': 'ali@goat.com', 'password': 'Pass123!'},
            format='json',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["data"]["access"]}')
        resp = self.client.get('/api/v1/packages/me/history/')
        self.assertEqual(resp.status_code, 200)
        rows = resp.data['data']
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['total_sessions'], 12)
        self.assertEqual(rows[1]['total_sessions'], 8)
        self.assertEqual(len(rows[1]['check_ins']), 1)

    def test_admin_sees_any_students_full_history(self):
        assign_package(self.student, 8)
        check_in(self.student)
        assign_package(self.student, 12)
        resp = self.client.get(f'/api/v1/packages/{self.student.id}/history/')
        self.assertEqual(resp.status_code, 200)
        rows = resp.data['data']
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['total_sessions'], 12)
        self.assertEqual(len(rows[1]['check_ins']), 1)

    def test_admin_sees_history_for_a_deactivated_student(self):
        assign_package(self.student, 8)
        check_in(self.student)
        self.student.is_active = False
        self.student.save(update_fields=['is_active'])
        resp = self.client.get(f'/api/v1/packages/{self.student.id}/history/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['data']), 1)

    def test_students_cannot_see_another_students_history(self):
        self.client.credentials()
        login = self.client.post(
            '/api/v1/auth/login/',
            {'email': 'ali@goat.com', 'password': 'Pass123!'},
            format='json',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["data"]["access"]}')
        resp = self.client.get(f'/api/v1/packages/{self.student.id}/history/')
        self.assertEqual(resp.status_code, 403)
