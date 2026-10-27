"""
Session package rules: assigning a renewal, recording attendance, and the
low-balance warnings that go out as the block runs down.
"""
import logging

from django.db import transaction
from django.utils import timezone

from students.models import Student

from .models import SessionCheckIn, SessionPackage
from .push import send_to_user

logger = logging.getLogger(__name__)

# Remaining counts that trigger a message. One warns while the student can
# still plan; zero confirms the block is finished.
WARN_AT = 1
EXHAUSTED_AT = 0


class PackageError(Exception):
    """Raised for rule violations the API should surface as 400s."""


def active_package(student: Student) -> SessionPackage | None:
    """The student's current block, or None if they've never had one."""
    return SessionPackage.objects.filter(student=student, closed_at__isnull=True).first()


@transaction.atomic
def assign_package(student: Student, total_sessions: int, assigned_by=None) -> SessionPackage:
    """
    Start a new block, closing any previous one.

    Unused sessions on the old block are not carried over — a renewal is a
    fresh purchase, and rolling leftovers forward silently would misreport
    what the student paid for.
    """
    if total_sessions not in SessionPackage.Size.values:
        raise PackageError('Package size must be 8 or 12 sessions.')

    SessionPackage.objects.filter(student=student, closed_at__isnull=True).update(
        closed_at=timezone.now()
    )
    return SessionPackage.objects.create(
        student=student, total_sessions=total_sessions, assigned_by=assigned_by
    )


@transaction.atomic
def check_in(student: Student, checked_in_by=None) -> SessionCheckIn:
    """
    Record one attended session and warn the student if the block is running
    out. Refuses once the package is spent rather than going negative — the
    admin assigns a renewal instead.
    """
    package = (
        SessionPackage.objects
        .select_for_update()
        .filter(student=student, closed_at__isnull=True)
        .first()
    )
    if package is None:
        raise PackageError('This student has no active package. Assign one first.')
    if package.is_exhausted:
        raise PackageError('This package is finished. Assign a renewal before checking in.')

    entry = SessionCheckIn.objects.create(package=package, checked_in_by=checked_in_by)

    # Read back through the DB so the count includes the row just written.
    remaining = package.remaining_sessions
    if remaining == WARN_AT:
        _notify_running_low(student, remaining)
    elif remaining == EXHAUSTED_AT:
        _notify_exhausted(student)

    return entry


@transaction.atomic
def undo_check_in(check_in_id, student: Student) -> None:
    """Remove a mistaken check-in, returning the session to the balance."""
    entry = SessionCheckIn.objects.filter(
        id=check_in_id, package__student=student
    ).first()
    if entry is None:
        raise PackageError('Check-in not found for this student.')
    entry.delete()


def _notify_running_low(student: Student, remaining: int) -> None:
    send_to_user(
        student.user,
        title='1 session left',
        body=(
            'You have 1 session remaining in your current package. '
            'Please renew with your coach to keep training without a break.'
        ),
        data={'type': 'package_low', 'remaining': remaining},
    )


def _notify_exhausted(student: Student) -> None:
    send_to_user(
        student.user,
        title='Your package is complete',
        body=(
            "You've completed all the sessions in your package. "
            'Once you renew, your upcoming sessions will be counted from the new package.'
        ),
        data={'type': 'package_exhausted', 'remaining': 0},
    )
