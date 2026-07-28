import logging
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError

from core.responses import success_response, error_response, created_response
from .permissions import IsAdmin
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer, ChangePasswordSerializer
from .services import generate_tokens, blacklist_token

logger = logging.getLogger(__name__)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid credentials.', serializer.errors)

        user = serializer.validated_data['user']
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        tokens = generate_tokens(user)
        logger.info('Login: %s', user.email)

        return success_response(
            data={**tokens, 'user': UserSerializer(user).data},
            message='Login successful.',
        )


class RegisterView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Registration failed.', serializer.errors)

        user = serializer.save()
        return created_response(
            data=UserSerializer(user).data,
            message='User created successfully.',
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return error_response('Refresh token is required.')
        try:
            blacklist_token(refresh_token)
            logger.info('Logout: %s', request.user.email)
            return success_response(message='Logged out successfully.')
        except TokenError:
            return error_response('Invalid or expired token.')


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return success_response(data=UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response('Update failed.', serializer.errors)
        serializer.save()
        return success_response(data=serializer.data, message='Profile updated.')


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return error_response('Password change failed.', serializer.errors)

        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        logger.info('Password changed: %s', request.user.email)
        return success_response(message='Password changed successfully.')
