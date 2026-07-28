from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),

    # API v1
    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/students/', include('students.urls')),
    path('api/v1/assessments/', include('assessments.urls')),
    path('api/v1/analytics/', include('analytics.urls')),
    path('api/v1/sync/', include('google_sync.urls')),
    path('api/v1/leaderboard/', include('leaderboard.urls')),
    path('api/v1/chat/', include('chat.urls')),

    # API Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
