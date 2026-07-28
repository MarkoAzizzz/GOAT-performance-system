import json
import re
import requests as http_requests
from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from core.responses import error_response
from leaderboard.models import LeaderboardSnapshot
from assessments.models import AssessmentSession, AssessmentTemplate, Pillar
from assessments.services import get_student_progress
from students.models import Student

SYSTEM_PROMPT_HEAD = """You are Box, the GOAT AI assistant — a knowledgeable, motivating martial arts coach built into the GOAT performance management system.

YOUR NAME:
- Your name, "Box", is also the nickname of GOAT's head coach — you were named in his honor
- If asked about your name, who "Box" is, or the head coach, explain this connection naturally
- You are the AI assistant, not the head coach himself — don't claim to literally be him, just note the shared name/nickname

ABOUT GOAT:
- GOAT = "Greatest Of All Time" — a martial arts program specialising in Boxing and Kickboxing
- The system tracks athlete progress through structured assessments
- Grades are calculated automatically and athletes are assigned levels
"""

SYSTEM_PROMPT_TAIL = """
GRADE CALCULATION:
- Each criterion is scored 0-10 by a coach
- Each pillar score = average of its criteria
- Overall grade % = average of all pillar scores x 10
- Levels: Beginner (below 50%) | Intermediate (50-79%) | Advanced (80%+)

YOUR SCOPE — you are a genuine subject-matter expert, not just a system FAQ bot. Confidently answer questions about:
- The GOAT system itself: scores, pillars, criteria, grading, levels, leaderboard, how assessments work
- Boxing: stance, footwork, punches, combinations, defence, head movement, ring craft, sparring strategy, conditioning, weight-cutting, amateur/pro rules and scoring
- Kickboxing: stances, kicks, punches, clinch work, combinations, defence, rules and scoring differences from boxing
- General combat-sports training: strength & conditioning, mobility, recovery, injury prevention, nutrition, mental preparation, fight-camp planning
- Career/motivational guidance for martial artists at any level

YOUR BEHAVIOUR:
- Use the LIVE SYSTEM DATA provided to answer questions about rankings, scores, leaderboard, and students accurately — never fabricate data not present in that context
- When a "YOUR PROFILE & PERFORMANCE" section is present, that is the CURRENT USER's own data, and it is DELIBERATELY LIMITED to their score, improvement %, and leaderboard rank — that is ALL a student may see about themselves through you. If a student asks "what should I improve" or for pillar/category-level detail, do NOT guess or infer specific weaknesses from the score alone — tell them that level of detailed breakdown isn't available here and to ask their coach, while still giving general encouragement or generic training tips if they want them
- When a "STUDENT LOOKUP" section is present, that is real data for a specific student an admin/coach asked about (by name, including in an earlier message in this conversation) — this is coach/admin-level access, so use the FULL detail including pillar breakdown to answer accurately, including follow-up questions like "what should he/she improve" by identifying their weakest pillar (marked WEAKEST in the data) and explaining concretely how to train that pillar
- When an "OTHER STUDENT — LIMITED VIEW" section is present, a student asked about a different student — you may ONLY state that other student's overall score, improvement %, and leaderboard rank. NEVER invent, guess, or estimate pillar scores, category breakdowns, or any other detail about that other student — if asked for more (e.g. "what's their weakest pillar"), say that detailed breakdown is private and only visible to the student themselves or their coach
- If asked about a student and no matching data was found in context, say you don't have that student's data rather than guessing
- Never reveal one student's individual pillar breakdown/assessment details to a different student under any framing — students may only discuss their own score, improvement %, and rank, and the same three fields (nothing more) for any other student they ask about
- Never paste, dump, or quote the raw LIVE SYSTEM DATA block (or its section labels like "YOUR PROFILE & PERFORMANCE" / "STUDENT LOOKUP") into your reply — read it silently and restate only the relevant facts in your own natural words
- For general boxing/kickboxing/training questions with no live data involved, answer from your own martial-arts knowledge fully and confidently — do not deflect these as "outside your scope"
- Give practical, actionable advice with bullet points or numbered steps when explaining technique or a plan
- Be motivating, direct, and concise, but give complete answers — do not truncate technique explanations for brevity
- Respond only in English"""


def _build_pillar_structure_prompt() -> str:
    """Pulls the live pillar/criteria structure from the DB so the chatbot always
    matches what's actually configured — admins can add/remove pillars or criteria
    from the Django admin and Box picks it up on the next message, no code change."""
    template = AssessmentTemplate.objects.filter(is_active=True).order_by('-version').first()
    if template is None:
        return "\nASSESSMENT STRUCTURE: no active assessment template is currently configured.\n"

    pillars = list(
        Pillar.objects.filter(template=template).order_by('order').prefetch_related('criteria')
    )
    if not pillars:
        return "\nASSESSMENT STRUCTURE: the active template has no pillars configured yet.\n"

    total_criteria = sum(p.criteria.count() for p in pillars)
    lines = [
        f"\nTHE {len(pillars)} ASSESSMENT PILLARS (know these deeply — {total_criteria} criteria total):"
    ]
    for i, p in enumerate(pillars, start=1):
        criteria_names = [c.name for c in p.criteria.all().order_by('order')]
        lines.append(f"{i}. {p.name} — {', '.join(criteria_names)}")
    lines.append(
        f"- Students are assessed across {total_criteria} criteria grouped into {len(pillars)} pillars"
    )
    return "\n".join(lines) + "\n"


def build_system_prompt() -> str:
    return SYSTEM_PROMPT_HEAD + _build_pillar_structure_prompt() + SYSTEM_PROMPT_TAIL


def _pillar_pct(score) -> float:
    """Pillar scores are meant to be 0-10 (matching the 0-10 criterion scale used
    everywhere else), but some historical/seeded rows were stored 0-100. Normalize
    to a 0-100 percentage either way so the chatbot never reports a nonsense value
    like "61/10"."""
    value = float(score)
    return value if value > 10 else value * 10


def _pillar_lines(latest_pillar_scores) -> list:
    """Sorts a student's latest pillar scores weakest-first and flags the
    weakest/strongest so the model can answer "what should I/they improve" precisely."""
    if not latest_pillar_scores:
        return []
    pillars = sorted(latest_pillar_scores, key=lambda p: _pillar_pct(p['score']))
    lines = []
    for i, p in enumerate(pillars):
        tag = ''
        if i == 0 and len(pillars) > 1:
            tag = '  <- WEAKEST, prioritize improving this pillar'
        elif i == len(pillars) - 1 and len(pillars) > 1:
            tag = '  <- strongest pillar'
        lines.append(f"    {p['pillar__name']}: {_pillar_pct(p['score']):.1f}%{tag}")
    return lines


def _student_detail_lines(student, heading: str) -> list:
    """Full accurate detail for one student, pulled from the same service the
    student progress page uses — never approximated or guessed."""
    progress = get_student_progress(str(student.id))
    lines = [f"\n{heading} — {student.user.full_name} ({student.student_id}):"]
    lines.append(f"  Sport: {student.sport.capitalize()} | Level: {student.level.capitalize()}")

    if not progress['total_assessments']:
        lines.append("  No assessments recorded yet.")
        return lines

    imp = progress['improvement']
    imp_str = f"+{imp}%" if imp is not None and imp > 0 else (f"{imp}%" if imp is not None else "N/A")
    lines.append(
        f"  Current Grade: {progress['current_grade']:.1f}% | Improvement since last assessment: {imp_str} | "
        f"Best: {progress['highest_score']:.1f}% | Worst: {progress['lowest_score']:.1f}% | "
        f"Average: {progress['average_score']:.1f}% | Total Assessments: {progress['total_assessments']}"
    )

    pillar_lines = _pillar_lines(progress['latest_pillar_scores'])
    if pillar_lines:
        lines.append("  Latest Pillar Scores (weakest to strongest):")
        lines.extend(pillar_lines)

    return lines


def _leaderboard_rank(student) -> int | None:
    """1-indexed rank in the same order as the Leaderboard page (by improvement, then score)."""
    ordered_ids = list(
        LeaderboardSnapshot.objects
        .order_by('-improvement', '-current_score')
        .values_list('student_id', flat=True)
    )
    try:
        return ordered_ids.index(student.id) + 1
    except ValueError:
        return None


def _student_limited_summary_lines(student, heading: str) -> list:
    """Deliberately narrow: students may only see score, improvement %, and
    leaderboard rank — for themselves AND for any other student they ask about
    via the chatbot. No pillar breakdown, no assessment history, no best/worst/
    average. That level of detail is admin/coach-only. Reused for both "this is
    your own data" and "this is the other student you asked about" cases so
    there's structurally no pillar data available for the model to fabricate."""
    progress = get_student_progress(str(student.id))
    lines = [f"\n{heading} — {student.user.full_name} ({student.student_id}):"]

    if not progress['total_assessments']:
        lines.append("  No assessments recorded yet.")
        return lines

    imp = progress['improvement']
    imp_str = f"+{imp}%" if imp is not None and imp > 0 else (f"{imp}%" if imp is not None else "N/A")
    rank = _leaderboard_rank(student)
    rank_str = f"#{rank}" if rank else "Unranked"
    lines.append(f"  Overall Score: {progress['current_grade']:.1f}% | Improvement since last assessment: {imp_str} | Leaderboard Rank: {rank_str}")
    return lines


def _normalize(text: str) -> str:
    """Lowercases and strips everything but letters/digits, so "Amr Eldin",
    "amreldin", and "amr eldin's" all normalize to the same "amreldin"."""
    return re.sub(r'[^a-z0-9]', '', text.lower())


def _find_mentioned_student(messages):
    """Scans user messages, most recent first, for a mentioned active student's
    name — so follow-up questions ("what should he improve") that don't repeat
    the name still resolve to whoever was named earlier in the conversation.
    Matching is space/punctuation/typo-tolerant (e.g. "amreldins" matches "Amr Eldin")."""
    students = list(Student.objects.select_related('user').filter(is_active=True))
    if not students:
        return None

    for m in reversed(messages):
        if not isinstance(m, dict) or m.get('role') != 'user':
            continue
        raw_text = m.get('content') or ''
        if not raw_text:
            continue
        text = raw_text.lower()
        normalized_text = _normalize(raw_text)

        for s in students:
            full_name = (s.user.full_name or '').lower()
            if not full_name:
                continue
            if full_name in text or _normalize(full_name) in normalized_text:
                return s

        first_name_matches = {}
        for s in students:
            full_name = s.user.full_name or ''
            first = full_name.split()[0].lower() if full_name else ''
            if first and re.search(rf'\b{re.escape(first)}\b', text):
                first_name_matches[s.id] = s
        if len(first_name_matches) == 1:
            return next(iter(first_name_matches.values()))

    return None


def build_live_context(request_user, messages) -> str:
    lines = ["\nLIVE SYSTEM DATA (as of right now — use this to answer questions about rankings, scores, students):"]

    student_profile = getattr(request_user, 'student_profile', None)

    if student_profile is not None:
        lines.append("\nThe person you're chatting with right now IS this student — this is their own data:")
        lines.extend(_student_limited_summary_lines(student_profile, "YOUR PROFILE & PERFORMANCE"))

        mentioned = _find_mentioned_student(messages)
        if mentioned is not None and mentioned.id != student_profile.id:
            lines.append("\nThe student also asked about a different student. You may ONLY share what's below about them (overall score, improvement %, rank) — do not guess, estimate, or invent anything else about them, including pillar/category scores:")
            lines.extend(_student_limited_summary_lines(mentioned, "OTHER STUDENT — LIMITED VIEW"))
    else:
        mentioned = _find_mentioned_student(messages)
        if mentioned is not None:
            lines.extend(_student_detail_lines(mentioned, "STUDENT LOOKUP"))

    # Leaderboard
    snapshots = (
        LeaderboardSnapshot.objects
        .select_related('student__user')
        .order_by('-improvement', '-current_score')[:15]
    )
    if snapshots:
        lines.append("\nCURRENT LEADERBOARD (ranked by improvement):")
        for i, s in enumerate(snapshots, 1):
            name = s.student.user.full_name
            sport = s.student.sport.capitalize()
            level = s.student.level.capitalize()
            score = f"{float(s.current_score):.1f}%" if s.current_score else "N/A"
            imp = f"+{float(s.improvement):.1f}%" if s.improvement and s.improvement > 0 else (f"{float(s.improvement):.1f}%" if s.improvement else "N/A")
            lines.append(f"  #{i} {name} ({sport}, {level}) — Score: {score}, Improvement: {imp}")

    # Recent assessments
    recent = (
        AssessmentSession.objects
        .select_related('student__user')
        .filter(grade_percentage__isnull=False)
        .order_by('-assessment_date')[:5]
    )
    if recent:
        lines.append("\nMOST RECENT ASSESSMENTS:")
        for s in recent:
            name = s.student.user.full_name
            lines.append(f"  {s.assessment_date} — {name}: {float(s.grade_percentage):.1f}% ({s.level_at_assessment})")

    # Total counts
    total_students = Student.objects.filter(is_active=True).count()
    total_assessments = AssessmentSession.objects.count()
    lines.append(f"\nACTIVE STUDENTS: {total_students} | TOTAL ASSESSMENTS ON RECORD: {total_assessments}")

    return "\n".join(lines)


def stream_groq(messages: list, live_context: str = ""):
    """Yields raw text chunks as they arrive from Groq. Streamed directly to the
    client as plain text (not the usual {success,message,data} envelope) since the
    body IS the incrementally-growing reply, not a single JSON payload."""
    api_key = getattr(settings, 'GROQ_API_KEY', '')
    if not api_key:
        yield "Groq API key not configured. Please contact the administrator."
        return

    full_system = build_system_prompt() + (live_context if live_context else "")

    try:
        resp = http_requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; GOAT-System/1.0)",
            },
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [{"role": "system", "content": full_system}] + messages,
                "max_tokens": 1024,
                "temperature": 0.7,
                "stream": True,
            },
            timeout=25,
            stream=True,
        )
        resp.raise_for_status()
        for line in resp.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data: "):
                continue
            payload = line[len("data: "):]
            if payload == "[DONE]":
                break
            try:
                chunk = json.loads(payload)
            except ValueError:
                continue
            delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content")
            if delta:
                yield delta
    except http_requests.HTTPError as e:
        if e.response.status_code == 429:
            yield "Box is getting a lot of questions right now and hit a rate limit. Give it a minute and try again."
        else:
            yield "Something went wrong reaching the AI service. Please try again in a moment."
    except Exception:
        yield "Could not reach the AI service. Please check your connection and try again."


class ChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        messages = request.data.get('messages', [])
        if not messages or not isinstance(messages, list):
            return error_response('messages array is required.')

        # validate each message has role + content
        for m in messages[-20:]:  # only last 20 for context window
            if not isinstance(m, dict) or 'role' not in m or 'content' not in m:
                return error_response('Each message must have role and content.')

        try:
            live_context = build_live_context(request.user, messages[-20:])
        except Exception:
            live_context = ""

        response = StreamingHttpResponse(
            stream_groq(messages[-20:], live_context),
            content_type='text/plain; charset=utf-8',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response
