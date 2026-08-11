from django.db.models import Avg, Max, Min, Count
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsAdmin
from core.responses import success_response
from assessments.models import AssessmentSession, PillarScore, Pillar
from students.models import Student
from leaderboard.models import LeaderboardSnapshot
from leaderboard.services import get_leaderboard


class AdminSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        total_students = Student.objects.count()
        active_students = Student.objects.filter(is_active=True).count()

        week_ago = timezone.now().date() - timedelta(days=7)
        weekly_assessments = AssessmentSession.objects.filter(
            assessment_date__gte=week_ago
        ).count()

        rating_stats = Student.objects.filter(is_active=True).aggregate(
            avg=Avg('rating'),
            highest=Max('rating'),
            lowest=Min('rating'),
        )

        biggest_improvement = (
            LeaderboardSnapshot.objects
            .filter(rating_change__isnull=False)
            .order_by('-rating_change')
            .select_related('student__user')
            .first()
        )

        weekly_trend = _weekly_trend()

        return success_response(data={
            'total_students': total_students,
            'active_students': active_students,
            'weekly_assessments': weekly_assessments,
            'average_rating': round(rating_stats['avg'] or 0, 1),
            'highest_rating': round(rating_stats['highest'] or 0, 1),
            'lowest_rating': round(rating_stats['lowest'] or 0, 1),
            'biggest_improvement': {
                'student_name': biggest_improvement.student.full_name if biggest_improvement else None,
                'student_id': biggest_improvement.student.student_id if biggest_improvement else None,
                'rating_change': float(biggest_improvement.rating_change) if biggest_improvement else None,
            },
            'weekly_trend': weekly_trend,
        })


class SportBreakdownView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        sports = ['boxing', 'kickboxing']
        result = []
        for sport in sports:
            students = Student.objects.filter(sport=sport)
            total_sessions = AssessmentSession.objects.filter(
                student__sport=sport, grade_percentage__isnull=False
            ).count()
            rating_stats = students.filter(is_active=True).aggregate(
                avg=Avg('rating'),
                highest=Max('rating'),
                lowest=Min('rating'),
            )

            result.append({
                'sport': sport,
                'total_students': students.count(),
                'active_students': students.filter(is_active=True).count(),
                'total_sessions': total_sessions,
                'average_rating': round(rating_stats['avg'] or 0, 1),
                'highest_rating': round(rating_stats['highest'] or 0, 1),
                'lowest_rating': round(rating_stats['lowest'] or 0, 1),
            })
        return success_response(data=result)


class PillarAnalyticsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        sport = request.query_params.get('sport')

        qs = PillarScore.objects.filter(score__isnull=False)
        if sport:
            qs = qs.filter(session__student__sport=sport)

        pillars = (
            qs
            .values('pillar__name')
            .annotate(
                avg=Avg('score'),
                highest=Max('score'),
                lowest=Min('score'),
                count=Count('id'),
            )
            .order_by('pillar__name')
        )

        result = [
            {
                'pillar': p['pillar__name'],
                'average': round(p['avg'] or 0, 2),
                'highest': round(p['highest'] or 0, 2),
                'lowest': round(p['lowest'] or 0, 2),
                'sessions': p['count'],
            }
            for p in pillars
        ]
        return success_response(data=result)


class TopPerformersView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        sport = request.query_params.get('sport')
        limit = int(request.query_params.get('limit', 10))

        qs = LeaderboardSnapshot.objects.filter(
            current_rating__isnull=False
        ).select_related('student__user')

        if sport:
            qs = qs.filter(student__sport=sport)

        by_rating = list(
            qs.order_by('-current_rating')[:limit]
            .values(
                'student__student_id', 'student__user__full_name',
                'student__sport',
                'current_rating', 'rating_change', 'total_assessments',
            )
        )

        by_improvement = list(
            qs.filter(rating_change__isnull=False)
            .order_by('-rating_change')[:limit]
            .values(
                'student__student_id', 'student__user__full_name',
                'student__sport',
                'current_rating', 'rating_change', 'total_assessments',
            )
        )

        def fmt(rows):
            return [
                {
                    'student_id': r['student__student_id'],
                    'student_name': r['student__user__full_name'],
                    'sport': r['student__sport'],
                    'current_rating': float(r['current_rating'] or 0),
                    'rating_change': float(r['rating_change'] or 0) if r['rating_change'] else None,
                    'total_assessments': r['total_assessments'],
                }
                for r in rows
            ]

        return success_response(data={
            'by_rating': fmt(by_rating),
            'by_improvement': fmt(by_improvement),
        })


class ScoreDistributionView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        sport = request.query_params.get('sport')
        qs = AssessmentSession.objects.filter(grade_percentage__isnull=False)
        if sport:
            qs = qs.filter(student__sport=sport)

        buckets = [
            ('0-20', 0, 20), ('21-40', 21, 40), ('41-60', 41, 60),
            ('61-80', 61, 80), ('81-100', 81, 100),
        ]
        result = []
        for label, lo, hi in buckets:
            result.append({
                'range': label,
                'count': qs.filter(grade_percentage__gte=lo, grade_percentage__lte=hi).count(),
            })
        return success_response(data=result)


def _weekly_trend():
    today = timezone.now().date()
    trend = []
    for i in range(7, -1, -1):
        day = today - timedelta(weeks=i)
        week_end = day + timedelta(days=6)
        stats = AssessmentSession.objects.filter(
            assessment_date__range=(day, week_end),
            grade_percentage__isnull=False,
        ).aggregate(avg=Avg('grade_percentage'), count=Count('id'))
        trend.append({
            'week': day.strftime('%b %d'),
            'average_score': round(stats['avg'] or 0, 2),
            'assessment_count': stats['count'],
        })
    return trend
