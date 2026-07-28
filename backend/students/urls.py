from django.urls import path
from .views import (
    BranchListView, StudentListView, StudentDetailView, StudentProgressView,
    StudentMeView, StudentHardDeleteView, StudentResetPasswordView,
)

urlpatterns = [
    path('', StudentListView.as_view(), name='student-list'),
    path('me/', StudentMeView.as_view(), name='student-me'),
    path('branches/', BranchListView.as_view(), name='branch-list'),
    path('<uuid:pk>/', StudentDetailView.as_view(), name='student-detail'),
    path('<uuid:pk>/progress/', StudentProgressView.as_view(), name='student-progress'),
    path('<uuid:pk>/delete/', StudentHardDeleteView.as_view(), name='student-hard-delete'),
    path('<uuid:pk>/reset-password/', StudentResetPasswordView.as_view(), name='student-reset-password'),
]
