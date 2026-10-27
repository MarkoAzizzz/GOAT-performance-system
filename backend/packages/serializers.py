from rest_framework import serializers

from .models import PushToken, SessionCheckIn, SessionPackage


class CheckInSerializer(serializers.ModelSerializer):
    checked_in_by_name = serializers.CharField(
        source='checked_in_by.full_name', read_only=True, default=None
    )

    class Meta:
        model = SessionCheckIn
        fields = ['id', 'checked_in_at', 'checked_in_by_name']


class PackageSerializer(serializers.ModelSerializer):
    # Derived rather than stored, so an undone check-in is reflected here too.
    used_sessions = serializers.IntegerField(read_only=True)
    remaining_sessions = serializers.IntegerField(read_only=True)
    check_ins = CheckInSerializer(many=True, read_only=True)

    class Meta:
        model = SessionPackage
        fields = [
            'id', 'total_sessions', 'used_sessions', 'remaining_sessions',
            'assigned_at', 'closed_at', 'check_ins',
        ]


class StudentPackageRowSerializer(serializers.Serializer):
    """One row of the admin check-in list: who they are and where they stand."""

    student_uuid = serializers.UUIDField()
    student_id = serializers.CharField()
    student_name = serializers.CharField()
    sport = serializers.CharField()
    has_package = serializers.BooleanField()
    total_sessions = serializers.IntegerField(allow_null=True)
    remaining_sessions = serializers.IntegerField(allow_null=True)
    last_check_in_at = serializers.DateTimeField(allow_null=True)


class AssignPackageSerializer(serializers.Serializer):
    total_sessions = serializers.ChoiceField(choices=SessionPackage.Size.choices)


class PushTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushToken
        fields = ['token']
