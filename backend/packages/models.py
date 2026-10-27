import uuid
from django.db import models
from accounts.models import User
from students.models import Student


class SessionPackage(models.Model):
    """
    A block of prepaid training sessions. A student renews by being given a
    new package; the old one stays for history rather than being topped up,
    so "which sessions belonged to which payment" is always answerable.
    """

    class Size(models.IntegerChoices):
        EIGHT = 8, '8 sessions'
        TWELVE = 12, '12 sessions'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='packages')
    total_sessions = models.PositiveSmallIntegerField(choices=Size.choices)
    assigned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
        help_text='Admin who recorded the renewal.'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    # Set when the next package is assigned, so exactly one package is current
    # per student and check-ins never land on an old block.
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'session_packages'
        ordering = ['-assigned_at']

    def __str__(self):
        return f'{self.student.student_id} — {self.total_sessions} sessions'

    @property
    def used_sessions(self) -> int:
        return self.check_ins.count()

    @property
    def remaining_sessions(self) -> int:
        """Never negative: a check-in past zero is refused by the service."""
        return max(0, self.total_sessions - self.used_sessions)

    @property
    def is_exhausted(self) -> bool:
        return self.remaining_sessions == 0


class SessionCheckIn(models.Model):
    """
    One attended session, recorded by an admin. Deleting a row is the undo —
    `remaining_sessions` is derived from these rather than stored, so a
    mis-tap cannot leave a counter permanently wrong.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    package = models.ForeignKey(SessionPackage, on_delete=models.CASCADE, related_name='check_ins')
    checked_in_at = models.DateTimeField(auto_now_add=True)
    checked_in_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )

    class Meta:
        db_table = 'session_check_ins'
        ordering = ['-checked_in_at']

    def __str__(self):
        return f'{self.package.student.student_id} @ {self.checked_in_at:%Y-%m-%d %H:%M}'


class PushToken(models.Model):
    """
    An Expo push token for one device. A user can have several (phone,
    tablet, reinstall), so tokens are rows rather than a field on User.
    Expo rejects tokens that are no longer valid; those get deleted on send.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_tokens')
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'push_tokens'

    def __str__(self):
        return f'{self.user.email} — {self.token[:24]}…'
