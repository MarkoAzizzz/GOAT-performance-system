from django.contrib import admin
from .models import AssessmentTemplate, Pillar, Criterion, AssessmentSession, CriterionScore, PillarScore


class PillarInline(admin.TabularInline):
    model = Pillar
    extra = 0


class CriterionInline(admin.TabularInline):
    model = Criterion
    extra = 0


@admin.register(AssessmentTemplate)
class AssessmentTemplateAdmin(admin.ModelAdmin):
    list_display = ['version', 'name', 'is_active', 'created_at']
    inlines = [PillarInline]


@admin.register(Pillar)
class PillarAdmin(admin.ModelAdmin):
    list_display = ['name', 'template', 'order']
    inlines = [CriterionInline]


@admin.register(Criterion)
class CriterionAdmin(admin.ModelAdmin):
    list_display = ['name', 'pillar', 'is_sport_specific', 'order']
    list_filter = ['pillar', 'is_sport_specific']


class CriterionScoreInline(admin.TabularInline):
    model = CriterionScore
    extra = 0
    readonly_fields = ['effective_score']


class PillarScoreInline(admin.TabularInline):
    model = PillarScore
    extra = 0


@admin.register(AssessmentSession)
class AssessmentSessionAdmin(admin.ModelAdmin):
    list_display = ['student', 'assessment_date', 'martial_art', 'overall_score', 'grade_percentage', 'net_delta', 'rating_after']
    list_filter = ['martial_art', 'assessment_date']
    search_fields = ['student__student_id', 'student__user__full_name']
    readonly_fields = ['id', 'overall_score', 'grade_percentage', 'net_delta', 'rating_before', 'rating_after', 'created_at']
    inlines = [PillarScoreInline, CriterionScoreInline]
