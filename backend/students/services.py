import logging
from django.db import transaction
from accounts.models import User
from .models import Branch, Student

logger = logging.getLogger(__name__)


def _generate_student_id() -> str:
    # String-sorting 'GOAT-NNN' breaks the moment any id doesn't match that
    # shape (e.g. a legacy 'GT-001' sorts after 'GOAT-020'), so the next
    # number is the max numeric GOAT- suffix instead of whatever sorts last.
    max_num = 0
    for sid in Student.objects.filter(student_id__startswith='GOAT-').values_list(
        'student_id', flat=True
    ):
        try:
            max_num = max(max_num, int(sid.split('-')[-1]))
        except ValueError:
            continue
    return f'GOAT-{max_num + 1:03d}'


def create_student(
    full_name: str,
    email: str,
    password: str,
    sport: str,
    branch: Branch,
    join_date,
) -> Student:
    with transaction.atomic():
        user = User.objects.create_user(
            email=email,
            full_name=full_name,
            password=password,
            role=User.Role.STUDENT,
        )
        student = Student.objects.create(
            user=user,
            student_id=_generate_student_id(),
            sport=sport,
            branch=branch,
            join_date=join_date,
        )
        logger.info('Student created: %s (%s)', student.student_id, email)
        return student


def deactivate_student(student: Student) -> Student:
    """
    Takes the student off the active roster — hidden from the leaderboard
    and the default team list — without touching their login. They can
    still sign in and see their own account; "deactivated" means "no longer
    an active member," not "locked out."
    """
    student.is_active = False
    student.save(update_fields=['is_active'])
    logger.info('Student deactivated: %s', student.student_id)
    return student


def reactivate_student(student: Student) -> Student:
    student.is_active = True
    student.save(update_fields=['is_active'])
    logger.info('Student reactivated: %s', student.student_id)
    return student
