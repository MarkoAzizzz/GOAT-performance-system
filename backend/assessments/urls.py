from django.urls import path
from .views import (
    AssessmentListView, AssessmentDetailView,
    AssessmentTemplateView, SportAnalyticsView,
    CoachEntryListCreateView, CoachEntryDetailView,
)

urlpatterns = [
    path('', AssessmentListView.as_view(), name='assessment-list'),
    path('template/', AssessmentTemplateView.as_view(), name='assessment-template'),
    path('analytics/', SportAnalyticsView.as_view(), name='sport-analytics'),
    path('coach-entries/', CoachEntryListCreateView.as_view(), name='coach-entry-list'),
    path('coach-entries/<uuid:pk>/', CoachEntryDetailView.as_view(), name='coach-entry-detail'),
    path('<uuid:pk>/', AssessmentDetailView.as_view(), name='assessment-detail'),
]
