from accounts.permissions import IsAdmin
from core.responses import created_response, error_response, success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from students.models import Student

from .models import PushToken, SessionPackage
from .serializers import (
    AssignPackageSerializer,
    PackageSerializer,
    PushTokenSerializer,
    StudentPackageRowSerializer,
)
from .services import PackageError, active_package, assign_package, check_in, undo_check_in


def _get_student(pk):
    return Student.objects.select_related('user').filter(pk=pk).first()


class CheckInListView(APIView):
    """The admin check-in roster: every active student and their balance."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        students = (
            Student.objects
            .filter(is_active=True)
            .select_related('user')
            .order_by('user__full_name')
        )
        # One query for the open packages rather than per student.
        packages = {
            p.student_id: p
            for p in SessionPackage.objects
            .filter(closed_at__isnull=True)
            .prefetch_related('check_ins')
        }

        rows = []
        for student in students:
            package = packages.get(student.id)
            latest = package.check_ins.first() if package else None
            rows.append({
                'student_uuid': student.id,
                'student_id': student.student_id,
                'student_name': student.user.full_name,
                'sport': student.sport,
                'has_package': package is not None,
                'total_sessions': package.total_sessions if package else None,
                'remaining_sessions': package.remaining_sessions if package else None,
                'last_check_in_at': latest.checked_in_at if latest else None,
            })

        return success_response(data=StudentPackageRowSerializer(rows, many=True).data)


class AssignPackageView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        student = _get_student(pk)
        if student is None:
            return error_response('Student not found.', status_code=404)

        serializer = AssignPackageSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid package.', serializer.errors)

        try:
            package = assign_package(
                student, serializer.validated_data['total_sessions'], assigned_by=request.user
            )
        except PackageError as exc:
            return error_response(str(exc))

        return created_response(data=PackageSerializer(package).data)


class CheckInView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        student = _get_student(pk)
        if student is None:
            return error_response('Student not found.', status_code=404)

        try:
            check_in(student, checked_in_by=request.user)
        except PackageError as exc:
            return error_response(str(exc))

        return success_response(data=PackageSerializer(active_package(student)).data)


class UndoCheckInView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def delete(self, request, pk, check_in_id):
        student = _get_student(pk)
        if student is None:
            return error_response('Student not found.', status_code=404)

        try:
            undo_check_in(check_in_id, student)
        except PackageError as exc:
            return error_response(str(exc))

        return success_response(data=PackageSerializer(active_package(student)).data)


class MyPackageView(APIView):
    """The signed-in student's own balance, for the in-app banner."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'student_profile'):
            return error_response('No student profile for this user.', status_code=404)

        package = active_package(request.user.student_profile)
        if package is None:
            return success_response(data=None)
        return success_response(data=PackageSerializer(package).data)


class StudentPackageHistoryView(APIView):
    """Every package a given student has ever had — admin lookup, unlike
    MyPackageHistoryView. Works for deactivated students too: leaving the
    roster doesn't erase their attendance/package record."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, pk):
        student = _get_student(pk)
        if student is None:
            return error_response('Student not found.', status_code=404)

        packages = SessionPackage.objects.filter(student=student).prefetch_related('check_ins')
        return success_response(data=PackageSerializer(packages, many=True).data)


class MyPackageHistoryView(APIView):
    """Every package the signed-in student has ever had, newest first."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'student_profile'):
            return error_response('No student profile for this user.', status_code=404)

        packages = (
            SessionPackage.objects
            .filter(student=request.user.student_profile)
            .prefetch_related('check_ins')
        )
        return success_response(data=PackageSerializer(packages, many=True).data)


class RegisterPushTokenView(APIView):
    """Devices call this on launch; re-registering the same token is a no-op."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PushTokenSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid token.', serializer.errors)

        token = serializer.validated_data['token']
        # A device can change hands, so the token belongs to whoever
        # registered it last rather than being rejected as a duplicate.
        PushToken.objects.update_or_create(token=token, defaults={'user': request.user})
        return success_response(message='Push token registered.')
