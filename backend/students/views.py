from django.db import transaction
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsAdmin, IsAdminOrOwner
from core.responses import success_response, error_response, created_response
from assessments.models import AssessmentSession, CriterionScore, PillarScore, CoachEntry
from assessments.services import get_student_progress
from .models import Branch, Student
from .serializers import BranchSerializer, StudentSerializer, CreateStudentSerializer, UpdateStudentSerializer, ResetPasswordSerializer
from .services import create_student, deactivate_student


class BranchListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        branches = Branch.objects.filter(is_active=True)
        return success_response(data=BranchSerializer(branches, many=True).data)


class StudentListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = Student.objects.select_related('user', 'branch').all()

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(student_id__icontains=search) |
                Q(user__full_name__icontains=search) |
                Q(user__email__icontains=search)
            )

        sport = request.query_params.get('sport')
        if sport:
            qs = qs.filter(sport=sport)

        level = request.query_params.get('level')
        if level:
            qs = qs.filter(level=level)

        is_active = request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')

        return success_response(data=StudentSerializer(qs, many=True).data)

    def post(self, request):
        serializer = CreateStudentSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Validation failed.', serializer.errors)

        d = serializer.validated_data
        student = create_student(
            full_name=d['full_name'],
            email=d['email'],
            password=d['password'],
            sport=d['sport'],
            branch=d['branch'],
            join_date=d['join_date'],
        )
        return created_response(
            data=StudentSerializer(student).data,
            message=f'Student {student.student_id} created.',
        )


class StudentDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def _get_student(self, pk):
        try:
            return Student.objects.select_related('user', 'branch').get(pk=pk)
        except Student.DoesNotExist:
            return None

    def get(self, request, pk):
        student = self._get_student(pk)
        if not student:
            return error_response('Student not found.', status_code=404)
        return success_response(data=StudentSerializer(student).data)

    def patch(self, request, pk):
        student = self._get_student(pk)
        if not student:
            return error_response('Student not found.', status_code=404)
        serializer = UpdateStudentSerializer(student, data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response('Validation failed.', serializer.errors)
        serializer.save()
        return success_response(
            data=StudentSerializer(student).data,
            message='Student updated.',
        )

    def delete(self, request, pk):
        student = self._get_student(pk)
        if not student:
            return error_response('Student not found.', status_code=404)
        deactivate_student(student)
        return success_response(message=f'Student {student.student_id} deactivated.')


class StudentHardDeleteView(APIView):
    """Permanently delete a student and all their assessment history."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def delete(self, request, pk):
        try:
            student = Student.objects.select_related('user').get(pk=pk)
        except Student.DoesNotExist:
            return error_response('Student not found.', status_code=404)

        user = student.user
        with transaction.atomic():
            sessions = AssessmentSession.objects.filter(student=student)
            CriterionScore.objects.filter(session__in=sessions).delete()
            PillarScore.objects.filter(session__in=sessions).delete()
            sessions.delete()
            CoachEntry.objects.filter(student=student).delete()
            student.delete()
            user.delete()
        return success_response(message='Student permanently deleted.')


class StudentResetPasswordView(APIView):
    """Admin resets a student's password directly (e.g. when the student forgot it)."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            student = Student.objects.select_related('user').get(pk=pk)
        except Student.DoesNotExist:
            return error_response('Student not found.', status_code=404)

        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Validation failed.', serializer.errors)

        student.user.set_password(serializer.validated_data['new_password'])
        student.user.save()
        return success_response(message=f'Password reset for {student.student_id}.')


class StudentMeView(APIView):
    """Return the logged-in student's own profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'student_profile'):
            return error_response('No student profile for this user.', status_code=404)
        student = request.user.student_profile
        return success_response(data=StudentSerializer(student).data)


class StudentProgressView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            student = Student.objects.get(pk=pk)
        except Student.DoesNotExist:
            return error_response('Student not found.', status_code=404)

        if not request.user.is_admin and not hasattr(request.user, 'student_profile'):
            return error_response('Forbidden.', status_code=403)
        if not request.user.is_admin and request.user.student_profile.id != student.id:
            return error_response('Forbidden.', status_code=403)

        progress = get_student_progress(str(student.id))
        return success_response(data=progress)
