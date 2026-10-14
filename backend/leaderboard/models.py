import uuid
from django.db import models
from students.models import Student
from assessments.models import AssessmentSession


class LeaderboardSnapshot(models.Model):
    """
    Cached leaderboard entry per student, refreshed after every sync.
    Derived entirely from AssessmentSession data by the engine.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.OneToOneField(
        Student, on_delete=models.CASCADE, related_name='leaderboard_entry'
    )
    latest_session = models.ForeignKey(
        AssessmentSession, on_delete=models.SET_NULL, null=True, related_name='+'
    )
    previous_session = models.ForeignKey(
        AssessmentSession, on_delete=models.SET_NULL, null=True, related_name='+',
        help_text='Session before latest, used to calculate improvement.'
    )
    current_rating = models.DecimalField(max_digits=6, decimal_places=1, null=True)
    previous_rating = models.DecimalField(max_digits=6, decimal_places=1, null=True)
    rating_change = models.DecimalField(
        max_digits=6, decimal_places=1, null=True,
        help_text='current_rating - previous_rating. Ranking tiebreaker.'
    )
    total_assessments = models.PositiveSmallIntegerField(default=0)
    rank = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text='Board position, 1 = highest current_rating.'
    )
    previous_rank = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text='Position before the last recompute. previous_rank - rank '
                  'gives the up/down movement clients show.'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leaderboard_snapshots'
        ordering = ['-current_rating', '-rating_change']

    def __str__(self):
        return f'{self.student.student_id} — rating: {self.current_rating}'
