import logging
from django.db import transaction
from accounts.models import User
from .models import Branch, Student

logger = logging.getLogger(__name__)


def _generate_student_id() -> str:
    last = Student.objects.order_by('-student_id').first()
    if last:
        try:
            num = int(last.student_id.split('-')[-1]) + 1
        except (ValueError, IndexError):
            num = 1
    else:
        num = 1
    return f'GOAT-{num:03d}'


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
    student.is_active = False
    student.user.is_active = False
    student.save(update_fields=['is_active'])
    student.user.save(update_fields=['is_active'])
    logger.info('Student deactivated: %s', student.student_id)
    return student
