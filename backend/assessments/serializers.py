from rest_framework import serializers
from .models import AssessmentSession, CriterionScore, PillarScore, CoachEntry, CoachCriterionScore, Pillar, Criterion, AssessmentTemplate


class CriterionScoreSerializer(serializers.ModelSerializer):
    criterion_name = serializers.CharField(source='criterion.name', read_only=True)
    pillar_name = serializers.CharField(source='criterion.pillar.name', read_only=True)
    pillar_order = serializers.IntegerField(source='criterion.pillar.order', read_only=True)
    criterion_order = serializers.IntegerField(source='criterion.order', read_only=True)

    class Meta:
        model = CriterionScore
        fields = [
            'id', 'criterion_name', 'pillar_name', 'pillar_order', 'criterion_order',
            'boxing_score', 'kickboxing_score', 'effective_score', 'coach_comment',
        ]


class PillarScoreSerializer(serializers.ModelSerializer):
    pillar_name = serializers.CharField(source='pillar.name', read_only=True)
    pillar_order = serializers.IntegerField(source='pillar.order', read_only=True)

    class Meta:
        model = PillarScore
        fields = ['pillar_name', 'pillar_order', 'score']


class AssessmentListSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)

    class Meta:
        model = AssessmentSession
        fields = [
            'id', 'student', 'student_id', 'student_name', 'assessment_date',
            'martial_art', 'overall_score', 'grade_percentage',
            'level_at_assessment', 'sessions_completed', 'created_at',
        ]


class AssessmentDetailSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    pillar_scores = PillarScoreSerializer(many=True, read_only=True)
    criterion_scores = CriterionScoreSerializer(many=True, read_only=True)

    class Meta:
        model = AssessmentSession
        fields = [
            'id', 'student_id', 'student_name', 'assessment_date',
            'martial_art', 'sessions_completed', 'overall_score',
            'grade_percentage', 'level_at_assessment',
            'coach_notes', 'action_plan',
            'pillar_scores', 'criterion_scores', 'created_at',
        ]


# ── Template structure ──────────────────────────────────────────────────────

class CriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Criterion
        fields = ['id', 'name', 'description', 'order', 'is_sport_specific']


class PillarSerializer(serializers.ModelSerializer):
    criteria = CriterionSerializer(many=True, read_only=True)

    class Meta:
        model = Pillar
        fields = ['id', 'name', 'order', 'criteria']


class TemplateSerializer(serializers.ModelSerializer):
    pillars = PillarSerializer(many=True, read_only=True)

    class Meta:
        model = AssessmentTemplate
        fields = ['id', 'version', 'name', 'pillars']


# ── Coach entry ─────────────────────────────────────────────────────────────

class CoachCriterionScoreSerializer(serializers.ModelSerializer):
    criterion_id = serializers.UUIDField()

    class Meta:
        model = CoachCriterionScore
        fields = ['criterion_id', 'score', 'comment']


class CoachEntrySerializer(serializers.ModelSerializer):
    scores = CoachCriterionScoreSerializer(many=True)
    coach_name = serializers.CharField(source='coach.full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = CoachEntry
        fields = [
            'id', 'student', 'student_id', 'student_name',
            'coach_name', 'assessment_date', 'sessions_completed',
            'notes', 'action_plan', 'scores', 'submitted_at',
        ]
        read_only_fields = ['id', 'coach_name', 'student_id', 'student_name', 'submitted_at']

    def create(self, validated_data):
        scores_data = validated_data.pop('scores', [])
        entry, _ = CoachEntry.objects.update_or_create(
            student=validated_data['student'],
            coach=self.context['request'].user,
            assessment_date=validated_data['assessment_date'],
            defaults={
                'sessions_completed': validated_data.get('sessions_completed', 0),
                'notes': validated_data.get('notes', ''),
                'action_plan': validated_data.get('action_plan', ''),
            },
        )
        for score_data in scores_data:
            CoachCriterionScore.objects.update_or_create(
                entry=entry,
                criterion_id=score_data['criterion_id'],
                defaults={'score': score_data.get('score'), 'comment': score_data.get('comment', '')},
            )
        return entry
