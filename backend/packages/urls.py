from django.urls import path

from .views import (
    AssignPackageView,
    CheckInListView,
    CheckInView,
    MyPackageView,
    RegisterPushTokenView,
    UndoCheckInView,
)

urlpatterns = [
    path('check-in/', CheckInListView.as_view(), name='check-in-list'),
    path('me/', MyPackageView.as_view(), name='my-package'),
    path('push-token/', RegisterPushTokenView.as_view(), name='register-push-token'),
    path('<uuid:pk>/assign/', AssignPackageView.as_view(), name='assign-package'),
    path('<uuid:pk>/check-in/', CheckInView.as_view(), name='student-check-in'),
    path('<uuid:pk>/check-in/<uuid:check_in_id>/', UndoCheckInView.as_view(), name='undo-check-in'),
]
