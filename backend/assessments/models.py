import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from students.models import Student
from accounts.models import User


class AssessmentTemplate(models.Model):
    """Versioned template defining pillars and criteria. Never mutated after use."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.PositiveSmallIntegerField(unique=True)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'assessment_templates'
        ordering = ['-version']

    def __str__(self):
        return f'v{self.version} — {self.name}'


class Pillar(models.Model):
    """One of the 5 scored pillars."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(AssessmentTemplate, on_delete=models.PROTECT, related_name='pillars')
    name = models.CharField(max_length=100)
    order = models.PositiveSmallIntegerField()

    class Meta:
        db_table = 'pillars'
        ordering = ['order']
        unique_together = [('template', 'order')]

    def __str__(self):
        return self.name


class Criterion(models.Model):
    """One of the 5 criteria inside a pillar."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pillar = models.ForeignKey(Pillar, on_delete=models.PROTECT, related_name='criteria')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_sport_specific = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField()

    class Meta:
        db_table = 'criteria'
        ordering = ['order']
        unique_together = [('pillar', 'order')]

    def __str__(self):
        return f'{self.pillar.name} › {self.name}'


class AssessmentSession(models.Model):
    """A single weekly assessment snapshot for a student. Never deleted."""

    class MartialArt(models.TextChoices):
        BOXING = 'boxing', 'Boxing'
        KICKBOXING = 'kickboxing', 'Kickboxing'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='assessments')
    coach = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='conducted_assessments'
    )
    template = models.ForeignKey(AssessmentTemplate, on_delete=models.PROTECT)
    martial_art = models.CharField(max_length=12, choices=MartialArt.choices)
    assessment_date = models.DateField(db_index=True)
    sessions_completed = models.PositiveSmallIntegerField(default=0)
    coach_notes = models.TextField(blank=True)
    action_plan = models.TextField(blank=True)

    # Calculated by assessment engine — never set by UI
    overall_score = models.DecimalField(max_digits=4, decimal_places=2, null=True)
    grade_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True)

    # Open-ended rating snapshot — see assessments.engine.update_rating
    rating_before = models.DecimalField(max_digits=6, decimal_places=1, null=True)
    rating_after = models.DecimalField(max_digits=6, decimal_places=1, null=True)

    synced_from_sheet = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'assessment_sessions'
        ordering = ['-assessment_date']
        indexes = [
            models.Index(fields=['student', 'assessment_date']),
        ]

    def __str__(self):
        return f'{self.student.student_id} — {self.assessment_date}'


class CriterionScore(models.Model):
    """Raw score for a single criterion in an assessment. Source of truth."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        AssessmentSession, on_delete=models.PROTECT, related_name='criterion_scores'
    )
    criterion = models.ForeignKey(Criterion, on_delete=models.PROTECT)
    boxing_score = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
    )
    kickboxing_score = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
    )
    effective_score = models.DecimalField(
        max_digits=4, decimal_places=2, null=True,
        help_text='Calculated by engine: average of filled scores.',
    )
    coach_comment = models.TextField(blank=True)

    class Meta:
        db_table = 'criterion_scores'
        unique_together = [('session', 'criterion')]

    def __str__(self):
        return f'{self.session} › {self.criterion.name}'


class PillarScore(models.Model):
    """Aggregated score per pillar per session. Calculated by engine."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        AssessmentSession, on_delete=models.PROTECT, related_name='pillar_scores'
    )
    pillar = models.ForeignKey(Pillar, on_delete=models.PROTECT)
    score = models.DecimalField(max_digits=4, decimal_places=2)

    class Meta:
        db_table = 'pillar_scores'
        unique_together = [('session', 'pillar')]

    def __str__(self):
        return f'{self.session} › {self.pillar.name}: {self.score}'


class CoachEntry(models.Model):
    """One coach's raw score submission for a student on a given date."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='coach_entries')
    coach = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='coach_entries')
    assessment_date = models.DateField()
    sessions_completed = models.PositiveSmallIntegerField(default=0)
    notes = models.TextField(blank=True)
    action_plan = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'coach_entries'
        unique_together = [('student', 'coach', 'assessment_date')]
        ordering = ['-assessment_date']

    def __str__(self):
        coach_name = self.coach.full_name if self.coach else 'Unknown'
        return f'{coach_name} → {self.student.student_id} ({self.assessment_date})'


class CoachCriterionScore(models.Model):
    """One criterion score from one coach's entry (0–10)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entry = models.ForeignKey(CoachEntry, on_delete=models.CASCADE, related_name='scores')
    criterion = models.ForeignKey(Criterion, on_delete=models.PROTECT)
    score = models.DecimalField(
        max_digits=3, decimal_places=1,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        null=True, blank=True,
    )
    comment = models.TextField(blank=True)

    class Meta:
        db_table = 'coach_criterion_scores'
        unique_together = [('entry', 'criterion')]

    def __str__(self):
        return f'{self.entry} › {self.criterion.name}: {self.score}'
