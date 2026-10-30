from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from accounts.models import User
from accounts.serializers import UserSerializer
from .models import Branch, Student


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['id', 'name', 'location', 'is_active']


class CreateBranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['name', 'location']


class StudentSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    email = serializers.ReadOnlyField()
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    last_assessment_date = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'student_id', 'full_name', 'email',
            'sport', 'rating', 'branch', 'branch_name',
            'join_date', 'is_active', 'profile_photo',
            'last_assessment_date', 'created_at',
        ]
        read_only_fields = ['id', 'student_id', 'rating', 'created_at']

    def get_last_assessment_date(self, obj):
        return (
            obj.assessments.order_by('-assessment_date')
            .values_list('assessment_date', flat=True)
            .first()
        )


class CreateStudentSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    sport = serializers.ChoiceField(choices=Student.Sport.choices)
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all())
    join_date = serializers.DateField()

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value


class UpdateStudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        # is_active is deliberately excluded — it's handled by
        # deactivate_student/reactivate_student in the view, which also
        # flips the login account's is_active, not just the Student row.
        fields = ['sport', 'branch', 'join_date', 'profile_photo']


class ResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
