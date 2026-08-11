import os, django, random
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from datetime import date, timedelta
from accounts.models import User
from students.models import Student, Branch
def _next_id():
    ids = Student.objects.filter(student_id__startswith='GOAT-').values_list('student_id', flat=True)
    nums = []
    for sid in ids:
        try: nums.append(int(sid.split('-')[1]))
        except: pass
    return f'GOAT-{(max(nums) + 1 if nums else 1):03d}'
from assessments.models import AssessmentTemplate, Pillar, Criterion, AssessmentSession, PillarScore, CriterionScore
from decimal import Decimal


# --- Branch ---
branch, _ = Branch.objects.get_or_create(name='GOAT Main Branch', defaults={'location': 'Main Location'})

# --- Template ---
template, _ = AssessmentTemplate.objects.get_or_create(version=1, defaults={'name': 'Standard Template', 'is_active': True})

PILLAR_DATA = [
    ('Technique',  ['Stance', 'Guard', 'Footwork', 'Combination', 'Accuracy']),
    ('Power',      ['Jab Power', 'Cross Power', 'Hook Power', 'Kick Power', 'Body Shots']),
    ('Speed',      ['Hand Speed', 'Foot Speed', 'Reaction Time', 'Combo Speed', 'Movement']),
    ('Endurance',  ['Cardio', 'Recovery', 'Round Stamina', 'Mental Toughness', 'Consistency']),
    ('Defense',    ['Slipping', 'Blocking', 'Parrying', 'Clinch Work', 'Ring Awareness']),
]

pillars = []
for i, (pname, criteria) in enumerate(PILLAR_DATA):
    pillar, _ = Pillar.objects.get_or_create(template=template, order=i+1, defaults={'name': pname})
    pillars.append(pillar)
    for j, cname in enumerate(criteria):
        Criterion.objects.get_or_create(pillar=pillar, order=j+1, defaults={'name': cname, 'is_sport_specific': False})

# --- Students: (name, email, sport, start_score, end_score) ---
STUDENTS = [
    ('Ali Hassan',    'ali@goat.com',    'boxing',     40, 70),
    ('Omar Khalid',   'omar@goat.com',   'boxing',     55, 80),
    ('Yusuf Nasser',  'yusuf@goat.com',  'kickboxing', 35, 65),
    ('Karim Saad',    'karim@goat.com',  'kickboxing', 70, 92),
    ('Tarek Mansour', 'tarek@goat.com',  'boxing',     65, 88),
    ('Samir Fawzi',   'samir@goat.com',  'kickboxing', 50, 78),
    ('Nour Adel',     'nour@goat.com',   'boxing',     30, 62),
    ('Ziad Ramadan',  'ziad@goat.com',   'kickboxing', 58, 83),
    ('Hassan Tawfik', 'hassan@goat.com', 'boxing',     72, 95),
    ('Amr Eldin',     'amr@goat.com',    'kickboxing', 38, 68),
]

for full_name, email, sport, score_start, score_end in STUDENTS:
    user, created = User.objects.get_or_create(email=email, defaults={
        'full_name': full_name, 'role': 'student', 'is_active': True
    })
    if created:
        user.set_password('Student123!')
        user.save()

    if hasattr(user, 'student_profile'):
        student = user.student_profile
        print(f'Existing: {full_name} ({student.student_id})')
    else:
        student = Student.objects.create(
            user=user,
            student_id=_next_id(),
            sport=sport,
            branch=branch,
            join_date=date.today() - timedelta(days=random.randint(90, 500)),
            is_active=True,
        )
        print(f'Created:  {full_name} ({student.student_id})')

    # 4 assessments trending upward
    for i in range(4):
        assess_date = date.today() - timedelta(days=(3 - i) * 50 + random.randint(-7, 7))
        score = round(score_start + (score_end - score_start) * (i / 3) + random.uniform(-3, 3), 2)
        score = max(0, min(100, score))

        if AssessmentSession.objects.filter(student=student, assessment_date=assess_date).exists():
            print(f'  Skip {assess_date} (exists)')
            continue

        session = AssessmentSession.objects.create(
            student=student,
            coach=None,
            template=template,
            martial_art=sport,
            assessment_date=assess_date,
            grade_percentage=score,
            overall_score=round(score / 10, 2),
            coach_notes=f'Session {i+1} — {"Excellent progress" if score >= 70 else "Good effort, keep pushing"}',
            action_plan='Focus on defensive techniques and combination speed.',
        )

        for pillar in pillars:
            pillar_total = 0
            criteria_list = list(pillar.criteria.all())
            for crit in criteria_list:
                cs = round(score / 10 + random.uniform(-1.5, 1.5), 2)
                cs = max(0, min(10, cs))
                CriterionScore.objects.create(
                    session=session, criterion=crit,
                    boxing_score=cs if sport == 'boxing' else None,
                    kickboxing_score=cs if sport == 'kickboxing' else None,
                    effective_score=cs,
                )
                pillar_total += cs
            avg_pillar = round((pillar_total / len(criteria_list)) * 10, 2)
            PillarScore.objects.create(session=session, pillar=pillar, score=avg_pillar)

        print(f'  {assess_date}: {score}%')

print('\nAll done — 10 students with 4 assessments each.')
