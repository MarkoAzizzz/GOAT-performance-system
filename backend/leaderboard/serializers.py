from rest_framework import serializers
from .models import LeaderboardSnapshot


class LeaderboardSerializer(serializers.ModelSerializer):
    student_uuid = serializers.UUIDField(source='student.id', read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    sport = serializers.CharField(source='student.sport', read_only=True)
    profile_photo = serializers.ImageField(source='student.profile_photo', read_only=True)

    class Meta:
        model = LeaderboardSnapshot
        fields = [
            'student_uuid', 'student_id', 'student_name', 'sport', 'profile_photo',
            'current_rating', 'previous_rating', 'rating_change', 'total_assessments',
            'rank', 'previous_rank',
        ]
