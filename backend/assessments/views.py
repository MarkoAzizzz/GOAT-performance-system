from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsAdmin
from core.responses import success_response, error_response
from .models import AssessmentSession, AssessmentTemplate, CoachEntry
from .serializers import (
    AssessmentListSerializer, AssessmentDetailSerializer,
    TemplateSerializer, CoachEntrySerializer,
)
from .coach_service import recalculate
from .services import get_sport_analytics


class AssessmentListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = (
            AssessmentSession.objects
            .select_related('student__user')
            .order_by('-assessment_date')
        )
        student_id = request.query_params.get('student')
        if student_id:
            qs = qs.filter(student_id=student_id)
        martial_art = request.query_params.get('martial_art')
        if martial_art:
            qs = qs.filter(martial_art=martial_art)
        date = request.query_params.get('date')
        if date:
            qs = qs.filter(assessment_date=date)
        return success_response(data=AssessmentListSerializer(qs[:50], many=True).data)


class AssessmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            session = (
                AssessmentSession.objects
                .select_related('student__user')
                .prefetch_related(
                    'pillar_scores__pillar',
                    'criterion_scores__criterion__pillar',
                )
                .get(pk=pk)
            )
        except AssessmentSession.DoesNotExist:
            return error_response('Assessment not found.', status_code=404)

        if not request.user.is_admin:
            if not hasattr(request.user, 'student_profile'):
                return error_response('Forbidden.', status_code=403)
            if session.student != request.user.student_profile:
                return error_response('Forbidden.', status_code=403)

        return success_response(data=AssessmentDetailSerializer(session).data)


class AssessmentTemplateView(APIView):
    """Return the active template with all pillars and criteria."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        template = AssessmentTemplate.objects.filter(is_active=True).order_by('-version').first()
        if not template:
            return error_response('No active template found.', status_code=404)
        return success_response(data=TemplateSerializer(template).data)


class SportAnalyticsView(APIView):
    """Coach-facing roster analytics, split by sport. See services.get_sport_analytics."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        return success_response(data=get_sport_analytics())


class CoachEntryListCreateView(APIView):
    """List all entries for a student+date, or submit a new entry."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        student_id = request.query_params.get('student')
        date = request.query_params.get('date')
        if not student_id or not date:
            return error_response('student and date params required.', status_code=400)

        entries = (
            CoachEntry.objects
            .filter(student_id=student_id, assessment_date=date)
            .prefetch_related('scores__criterion')
            .select_related('coach')
        )
        return success_response(data=CoachEntrySerializer(entries, many=True).data)

    def post(self, request):
        serializer = CoachEntrySerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return error_response(str(serializer.errors), status_code=400)

        entry = serializer.save()
        recalculate(entry.student, entry.assessment_date)
        return success_response(data=CoachEntrySerializer(entry).data, status_code=201)


class CoachEntryDetailView(APIView):
    """Get or update a specific coach entry."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, pk):
        try:
            entry = CoachEntry.objects.prefetch_related('scores__criterion').select_related('coach').get(pk=pk)
        except CoachEntry.DoesNotExist:
            return error_response('Entry not found.', status_code=404)
        return success_response(data=CoachEntrySerializer(entry).data)
