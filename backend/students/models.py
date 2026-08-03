import uuid
from decimal import Decimal
from django.db import models
from accounts.models import User


class Branch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    location = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'branches'
        verbose_name_plural = 'branches'

    def __str__(self):
        return self.name


class Student(models.Model):
    class Sport(models.TextChoices):
        BOXING = 'boxing', 'Boxing'
        KICKBOXING = 'kickboxing', 'Kickboxing'

    class Level(models.TextChoices):
        BEGINNER = 'beginner', 'Beginner'
        INTERMEDIATE = 'intermediate', 'Intermediate'
        ADVANCED = 'advanced', 'Advanced'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student_id = models.CharField(max_length=20, unique=True, db_index=True)
    user = models.OneToOneField(User, on_delete=models.PROTECT, related_name='student_profile')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='students')
    sport = models.CharField(max_length=12, choices=Sport.choices)
    level = models.CharField(max_length=14, choices=Level.choices, default=Level.BEGINNER)
    rating = models.DecimalField(
        max_digits=6, decimal_places=1, default=Decimal('1000'),
        help_text='Open-ended ELO-style rating. No fixed ceiling — see assessments.engine.',
    )
    join_date = models.DateField()
    is_active = models.BooleanField(default=True)
    profile_photo = models.ImageField(upload_to='students/photos/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'students'
        ordering = ['student_id']

    def __str__(self):
        return f'{self.student_id} — {self.user.full_name}'

    @property
    def full_name(self):
        return self.user.full_name

    @property
    def email(self):
        return self.user.email
