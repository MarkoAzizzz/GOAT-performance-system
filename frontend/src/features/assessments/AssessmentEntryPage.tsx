import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { studentsService } from '../../services/students.service'
import { assessmentsService } from '../../services/students.service'
import { assessmentEntryService } from '../../services/assessments.service'
import { useToast } from '../../components/ui/Toast'
import { ChevronDown, ChevronLeft, ChevronRight, Save, User, CheckCircle, AlertCircle, Users } from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

function avg(vals: number[]): number | null {
  const v = vals.filter(x => !isNaN(x) && x >= 0 && x <= 10)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function calcOverall(scores: Record<string, string>, pillars: any[]) {
  const pillarAvgs = pillars.map(p => {
    const vals = p.criteria.map((c: any) => parseFloat(scores[c.id])).filter((v: number) => !isNaN(v))
    return avg(vals)
  }).filter(v => v !== null) as number[]
  const overall = avg(pillarAvgs)
  if (overall === null) return null
  const grade = overall * 10
  return { overall, grade, level: grade >= 80 ? 'Advanced' : grade >= 50 ? 'Intermediate' : 'Beginner' }
}

function clampScore(raw: string): string {
  if (raw === '' || raw === '-') return raw
  const n = parseFloat(raw)
  if (isNaN(n)) return ''
  return String(Math.min(10, Math.max(0, n)))
}

const LEVEL_COLOR: Record<string, string> = {
  Advanced: '#E11919',
  Intermediate: '#fbbf24',
  Beginner: '#34d399',
}

// ── styles ───────────────────────────────────────────────────────────────────

const cell: React.CSSProperties = {
  padding: '0 12px', height: 44,
  borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))',
  verticalAlign: 'middle', whiteSpace: 'nowrap',
}

const scoreInputStyle: React.CSSProperties = {
  width: 68, height: 32,
  background: 'rgba(225,25,25,0.06)',
  border: '1px solid rgba(225,25,25,0.2)',
  color: '#E11919',
  fontFamily: 'var(--font-display)',
  fontSize: 15, fontWeight: 700,
  textAlign: 'center', outline: 'none',
}

const commentInputStyle: React.CSSProperties = {
  width: '100%', height: 32,
  background: 'rgb(var(--c-bg-input))',
  border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
  color: 'rgb(var(--c-text-primary) / 0.65)',
  fontSize: 12, padding: '0 10px', outline: 'none',
}

const angularCard: React.CSSProperties = {
  background: 'rgb(var(--c-bg-elevated))',
  border: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))',
  boxShadow: 'var(--c-card-shadow)',
  clipPath: 'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)',
}

const redLine = { background: 'linear-gradient(to right,#E11919,transparent)' }

// ── Past assessment read-only view ───────────────────────────────────────────

function PastAssessmentView({ session, pillars }: { session: any; pillars: any[] }) {
  if (!session) return null

  const criterionScores: Record<string, number | null> = {}
  for (const cs of session.criterion_scores ?? []) {
    criterionScores[cs.criterion_name] = cs.effective_score
  }

  const pillarMap: Record<string, number | null> = {}
  for (const ps of session.pillar_scores ?? []) {
    pillarMap[ps.pillar_name] = ps.score
  }

  let rowNum = 0

  return (
    <div className="space-y-5">
      {/* Score banner */}
      <div className="flex flex-wrap items-center gap-8 px-6 py-5 relative overflow-hidden"
        style={{ background: 'rgba(225,25,25,0.05)', border: '1px solid rgba(225,25,25,0.18)', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))' }}>
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'linear-gradient(to bottom,#E11919,transparent)' }} />
        <div>
          <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.48rem', letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 4 }}>Final Score</p>
          <p className="font-display text-blood-red" style={{ fontSize: '3rem', lineHeight: 1 }}>{session.grade_percentage}<span style={{ fontSize: '1.2rem' }}>%</span></p>
        </div>
        <div>
          <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.48rem', letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 6 }}>Level</p>
          <span className="font-display text-sm" style={{ color: LEVEL_COLOR[session.level_at_assessment] ?? 'rgb(var(--c-text-secondary))' }}>
            {session.level_at_assessment}
          </span>
        </div>
        <div>
          <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.48rem', letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 4 }}>Overall /10</p>
          <p className="font-display text-off-white text-2xl">{session.overall_score}</p>
        </div>
      </div>

      {/* Scorecard table (read-only) */}
      <div className="relative overflow-hidden"
        style={{ background: 'rgb(var(--c-bg-surface))', border: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={redLine} />
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 42 }} /><col style={{ width: 220 }} /><col style={{ width: 90 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))' }}>
                {['#', 'Criterion', 'Score /10'].map(h => (
                  <th key={h} style={{ ...cell, height: 36, color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.24em', textTransform: 'uppercase', textAlign: h === 'Score /10' ? 'center' : 'left', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pillars.map((pillar: any, pi: number) => {
                const pscore = pillarMap[pillar.name]
                return [
                  <tr key={`ph-${pillar.id}`} style={{ background: 'rgba(225,25,25,0.055)', borderTop: pi > 0 ? '1px solid rgba(225,25,25,0.12)' : undefined, borderBottom: '1px solid rgba(225,25,25,0.08)' }}>
                    <td colSpan={2} style={{ ...cell, height: 36, paddingLeft: 16 }}>
                      <div className="flex items-center gap-3">
                        <span style={{ color: '#E11919', fontFamily: 'var(--font-display)', fontSize: 11 }}>{String(pi + 1).padStart(2, '0')}</span>
                        <span className="font-display text-off-white" style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{pillar.name}</span>
                      </div>
                    </td>
                    <td style={{ ...cell, height: 36, textAlign: 'center' }}>
                      {pscore != null
                        ? <span className="font-display" style={{ color: '#E11919', fontSize: 14 }}>{Number(pscore).toFixed(2)}</span>
                        : <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', fontSize: 11 }}>—</span>}
                    </td>
                  </tr>,
                  ...pillar.criteria.map((criterion: any) => {
                    rowNum++
                    const num = rowNum
                    // match by name since we don't have criterion_id in the past session data
                    const cscore = (session.criterion_scores ?? []).find((cs: any) => cs.criterion_name === criterion.name)?.effective_score
                    return (
                      <tr key={criterion.id}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgb(var(--c-overlay) / calc(0.018 * var(--c-ovl-mult)))' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                        <td style={{ ...cell, color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', fontSize: 11, fontFamily: 'var(--font-display)', textAlign: 'center' }}>{num}</td>
                        <td style={{ ...cell, color: 'rgb(var(--c-text-primary) / 0.82)', fontSize: 13 }}>{criterion.name}</td>
                        <td style={{ ...cell, textAlign: 'center' }}>
                          {cscore != null
                            ? <span className="font-display" style={{ color: '#E11919', fontSize: 15 }}>{Number(cscore).toFixed(1)}</span>
                            : <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.15 * var(--c-sec-mult)))' }}>—</span>}
                        </td>
                      </tr>
                    )
                  }),
                ]
              })}
              <tr style={{ background: 'rgba(225,25,25,0.08)', borderTop: '1px solid rgba(225,25,25,0.2)' }}>
                <td colSpan={2} style={{ ...cell, height: 44, paddingLeft: 16 }}>
                  <span className="font-display text-off-white" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Overall Score</span>
                </td>
                <td style={{ ...cell, height: 44, textAlign: 'center' }}>
                  <span className="font-display" style={{ color: '#E11919', fontSize: 18 }}>{session.grade_percentage}<span style={{ fontSize: 12 }}>%</span></span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes + Plan */}
      {(session.coach_notes || session.action_plan) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {session.coach_notes && (
            <div className="p-4 relative overflow-hidden" style={{ ...angularCard }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={redLine} />
              <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 8 }}>Coach Notes</p>
              <p className="text-off-white/80 text-sm leading-relaxed">{session.coach_notes}</p>
            </div>
          )}
          {session.action_plan && (
            <div className="p-4 relative overflow-hidden" style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid rgba(225,25,25,0.12)', clipPath: 'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)' }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,rgba(225,25,25,0.5),transparent)' }} />
              <p style={{ color: 'rgba(225,25,25,0.45)', fontSize: '0.5rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 8 }}>Action Plan / Goals</p>
              <p className="text-off-white/75 text-sm leading-relaxed italic">{session.action_plan}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function AssessmentEntryPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const location = useLocation()

  // student selector
  const [search, setSearch] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [student, setStudent] = useState<any>(null)

  // which assessment to view: -1 = current (entry form), 0 = latest past, 1 = second-latest, etc.
  // history is sorted newest→oldest, so index 0 = most recent past session
  const [historyIdx, setHistoryIdx] = useState(-1)  // -1 means "current / new entry"

  // new entry form state
  const [date] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [plan, setPlan] = useState('')
  const [scores, setScores] = useState<Record<string, string>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  // queries
  const { data: students = [] } = useQuery({ queryKey: ['students-all'], queryFn: studentsService.list })

  const { data: template, isLoading: loadingTpl, isError: tplError } = useQuery({
    queryKey: ['assessment-template'],
    queryFn: assessmentEntryService.getTemplate,
  })

  const { data: progress } = useQuery({
    queryKey: ['student-progress', student?.id],
    queryFn: () => studentsService.getProgress(student!.id),
    enabled: !!student,
  })

  const { data: entries = [], refetch: refetchEntries } = useQuery({
    queryKey: ['coach-entries', student?.id, date],
    queryFn: () => assessmentEntryService.getCoachEntries(student!.id, date),
    enabled: !!student,
  })

  // history ordered newest→oldest — must be declared before the useEffects that depend on it
  const history: any[] = useMemo(() => {
    const h = (progress as any)?.history ?? []
    return [...h].reverse()
  }, [progress])

  // Pre-select student if navigated from StudentDetailPage
  useEffect(() => {
    const pre = (location.state as any)?.preselect
    if (pre && !student) {
      setStudent(pre)
      setSearch(pre.full_name ?? '')
    }
  }, [location.state])

  // Jump to a specific past assessment date if provided via navigation state
  useEffect(() => {
    const viewDate = (location.state as any)?.viewDate
    if (!viewDate || !history.length) return
    const idx = history.findIndex((h: any) => h.assessment_date === viewDate)
    if (idx !== -1) setHistoryIdx(idx)
  }, [location.state, history])

  // fetch full detail of a past session when navigating to it
  const viewedSessionId = historyIdx >= 0 ? history[historyIdx]?.id : null
  const { data: sessionDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['assessment-detail', viewedSessionId],
    queryFn: () => assessmentsService.get(viewedSessionId!),
    enabled: !!viewedSessionId,
  })

  // pre-fill form if coach already submitted for today
  useEffect(() => {
    if (!entries.length || !template) return
    const last = entries[entries.length - 1]
    const s: Record<string, string> = {}
    const c: Record<string, string> = {}
    for (const x of last.scores ?? []) {
      s[x.criterion_id] = x.score != null ? String(x.score) : ''
      c[x.criterion_id] = x.comment ?? ''
    }
    setScores(s); setComments(c)
    setNotes(last.notes ?? ''); setPlan(last.action_plan ?? '')
  }, [entries, template])

  const pillars: any[] = template?.pillars ?? []
  const calc = useMemo(() => calcOverall(scores, pillars), [scores, pillars])

  // sorted student list
  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase()
    return (students as any[])
      .filter((s: any) => (s.full_name ?? '').toLowerCase().includes(q))
      .sort((a: any, b: any) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
  }, [students, search])

  function pickStudent(s: any) {
    setStudent(s); setSearch(s.full_name ?? ''); setShowDrop(false)
    setScores({}); setComments({}); setNotes(''); setPlan('')
    setSubmitted(false); setHistoryIdx(-1)
  }

  function handleScoreChange(criterionId: string, raw: string) {
    // Allow typing in progress (e.g. "1." or "0."), clamp on blur
    if (raw === '' || raw === '.') { setScores(prev => ({ ...prev, [criterionId]: raw })); return }
    const n = parseFloat(raw)
    if (!isNaN(n) && n > 10) {
      setScores(prev => ({ ...prev, [criterionId]: '10' })); return
    }
    setScores(prev => ({ ...prev, [criterionId]: raw }))
  }

  function handleScoreBlur(criterionId: string) {
    setScores(prev => {
      const clamped = clampScore(prev[criterionId] ?? '')
      return { ...prev, [criterionId]: clamped }
    })
  }

  const submitMutation = useMutation({
    mutationFn: assessmentEntryService.submitEntry,
    onSuccess: () => {
      toast('Assessment submitted — final score auto-calculated', 'success')
      setSubmitted(true)
      refetchEntries()
      // Invalidate student progress so the detail page refreshes automatically
      if (student?.id) {
        qc.invalidateQueries({ queryKey: ['student-progress', student.id] })
        qc.invalidateQueries({ queryKey: ['student', student.id] })
        qc.invalidateQueries({ queryKey: ['leaderboard'] })
      }
    },
    onError: () => toast('Failed to submit', 'error'),
  })

  function handleSubmit() {
    if (!student) return
    submitMutation.mutate({
      student: student.id,
      assessment_date: date,
      sessions_completed: 0,
      notes, action_plan: plan,
      scores: Object.entries(scores)
        .filter(([, v]) => v !== '' && v !== '.')
        .map(([criterion_id, score]) => ({
          criterion_id, score: parseFloat(clampScore(score)),
          comment: comments[criterion_id] ?? '',
        })),
    })
  }

  const isCurrentEntry = historyIdx === -1
  const canGoNewer = historyIdx > -1
  const canGoOlder = historyIdx < history.length - 1

  // Sorted student list (alphabetical) for prev/next
  const sortedStudents = useMemo(() =>
    [...(students as any[])].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')),
    [students]
  )

  // Today's assessed student IDs
  const { data: todayAssessments = [] } = useQuery({
    queryKey: ['assessments-today', date],
    queryFn: () => assessmentsService.list({ date }),
    refetchInterval: 30000,
  })
  const assessedTodayIds = useMemo(() =>
    new Set((todayAssessments as any[]).map((a: any) => a.student_id ?? a.student)),
    [todayAssessments]
  )

  const assessedCount = assessedTodayIds.size
  const totalCount = sortedStudents.length

  // Prev/Next student navigation
  const currentIdx = student ? sortedStudents.findIndex((s: any) => s.id === student.id) : -1
  function goToStudent(s: any) {
    setStudent(s); setSearch(s.full_name ?? ''); setShowDrop(false)
    setScores({}); setComments({}); setNotes(''); setPlan('')
    setSubmitted(false); setHistoryIdx(-1)
  }
  const goPrev = () => { if (currentIdx > 0) goToStudent(sortedStudents[currentIdx - 1]) }
  const goNext = () => { if (currentIdx < sortedStudents.length - 1) goToStudent(sortedStudents[currentIdx + 1]) }

  // Sticky bar visibility
  const stickyRef = useRef<HTMLDivElement>(null)
  const bannerRef = useRef<HTMLDivElement>(null)
  const [showSticky, setShowSticky] = useState(false)
  useEffect(() => {
    if (!student) { setShowSticky(false); return }
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    )
    if (bannerRef.current) observer.observe(bannerRef.current)
    return () => observer.disconnect()
  }, [student])

  let rowNum = 0

  return (
    <div className="space-y-6">

      {showSticky && student && (
        <div ref={stickyRef} style={{
          position: 'fixed', top: 56, left: 0, right: 0, zIndex: 40,
          background: 'rgba(6,6,6,0.96)', borderBottom: '1px solid rgba(225,25,25,0.2)',
          backdropFilter: 'blur(8px)',
        }}>
          <div className="px-8 py-2 flex items-center gap-4 max-w-[1400px] mx-auto">
            <div className="w-7 h-7 flex items-center justify-center font-display text-sm shrink-0"
              style={{ background: 'rgba(225,25,25,0.15)', border: '1px solid rgba(225,25,25,0.3)', color: '#E11919' }}>
              {(student.full_name ?? '?')[0].toUpperCase()}
            </div>
            <span className="font-display text-off-white text-sm tracking-wide">{student.full_name}</span>
            <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.65rem' }}>{student.student_id} · {student.sport}</span>
            {isCurrentEntry && calc && (
              <>
                <div className="h-3 w-px bg-overlay/10 ml-2" />
                <span className="font-display text-blood-red text-sm">{calc.grade.toFixed(1)}%</span>
                <span className="font-display text-xs" style={{ color: LEVEL_COLOR[calc.level] }}>{calc.level}</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={goPrev} disabled={currentIdx <= 0}
                className="flex items-center gap-1 px-2 py-1 text-xs font-display tracking-widest uppercase transition-all"
                style={{ border: '1px solid rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))', color: currentIdx > 0 ? 'rgb(var(--c-text-primary) / 0.7)' : 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', background: 'none', cursor: currentIdx > 0 ? 'pointer' : 'default' }}>
                <ChevronLeft size={11} /> Prev
              </button>
              <button onClick={goNext} disabled={currentIdx >= sortedStudents.length - 1}
                className="flex items-center gap-1 px-2 py-1 text-xs font-display tracking-widest uppercase transition-all"
                style={{ border: '1px solid rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))', color: currentIdx < sortedStudents.length - 1 ? 'rgb(var(--c-text-primary) / 0.7)' : 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', background: 'none', cursor: currentIdx < sortedStudents.length - 1 ? 'pointer' : 'default' }}>
                Next <ChevronRight size={11} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))', fontSize: '0.58rem', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 6 }}>
            Management
          </p>
          <h1 className="font-display text-off-white" style={{ fontSize: '2.4rem', letterSpacing: '0.1em', lineHeight: 1 }}>
            Assessment <span className="text-blood-red">Entry</span>
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-[2px] w-10 bg-blood-red" />
            <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.38 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              Score a student · all 25 criteria · system auto-calculates final grade
            </span>
          </div>
        </div>
      </div>

      {/* ── Progress counter ── */}
      {totalCount > 0 && (
        <div className="relative overflow-hidden px-5 py-3 flex items-center gap-6"
          style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))', clipPath: 'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={redLine} />
          <div className="flex items-center gap-2">
            <Users size={13} style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))' }} />
            <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.26em', textTransform: 'uppercase' }}>Today's Progress</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-blood-red" style={{ fontSize: '1.4rem', lineHeight: 1 }}>{assessedCount}</span>
            <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.75rem' }}>/ {totalCount} students assessed</span>
          </div>
          {/* progress bar */}
          <div className="flex-1 h-1" style={{ background: 'rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))' }}>
            <div className="h-1 transition-all duration-500"
              style={{ width: `${(assessedCount / totalCount) * 100}%`, background: 'linear-gradient(to right,#E11919,#ff4444)' }} />
          </div>
          <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', fontSize: '0.65rem' }}>
            {totalCount - assessedCount} remaining
          </span>
        </div>
      )}

      {/* ── Student picker + date ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* Student dropdown + prev/next */}
        <div className="relative md:col-span-2 flex gap-2">
          {/* Prev button */}
          <button onClick={goPrev} disabled={currentIdx <= 0}
            title={currentIdx > 0 ? `← ${sortedStudents[currentIdx - 1]?.full_name}` : ''}
            className="flex items-center justify-center shrink-0 px-3 transition-all"
            style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))', color: currentIdx > 0 ? 'rgb(var(--c-text-primary) / 0.7)' : 'rgb(var(--c-text-secondary) / calc(0.18 * var(--c-sec-mult)))', cursor: currentIdx > 0 ? 'pointer' : 'default', clipPath: 'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,0 100%)' }}
            onMouseEnter={e => { if (currentIdx > 0) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(225,25,25,0.4)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))' }}>
            <ChevronLeft size={16} />
          </button>

          {/* Dropdown */}
          <div className="relative flex-1">
            <div className="relative overflow-hidden" style={angularCard}>
              <div className="absolute top-0 left-0 right-0 h-px" style={redLine} />
              <div className="px-4 py-3">
                <label style={{ display: 'block', color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>Student</label>
                <div className="flex items-center gap-2">
                  <User size={13} style={{ color: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', flexShrink: 0 }} />
                  <input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setShowDrop(true) }}
                    onFocus={() => setShowDrop(true)}
                    onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                    placeholder="Search student by name..."
                    className="flex-1 bg-transparent text-off-white text-sm outline-none"
                    style={{ border: 'none' }}
                  />
                  <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); setShowDrop(v => !v) }}
                    className="p-1 transition-colors"
                    style={{ color: showDrop ? '#E11919' : 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <ChevronDown size={14} style={{ transform: showDrop ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                  </button>
                </div>
              </div>
            </div>

            {showDrop && filteredStudents.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto"
                style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))', boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
                {filteredStudents.map((s: any) => {
                  const done = assessedTodayIds.has(s.id)
                  return (
                    <button key={s.id} onMouseDown={() => pickStudent(s)}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors"
                      style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(225,25,25,0.07)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                      {/* assessed indicator */}
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: done ? '#34d399' : 'rgba(225,25,25,0.5)', flexShrink: 0, display: 'inline-block' }} />
                      <span className="text-off-white text-sm flex-1">{s.full_name}</span>
                      <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.65rem' }}>{s.student_id} · {s.sport}</span>
                      {done && <CheckCircle size={11} style={{ color: '#34d399', flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Next button */}
          <button onClick={goNext} disabled={currentIdx >= sortedStudents.length - 1}
            title={currentIdx >= 0 && currentIdx < sortedStudents.length - 1 ? `${sortedStudents[currentIdx + 1]?.full_name} →` : ''}
            className="flex items-center justify-center shrink-0 px-3 transition-all"
            style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))', color: currentIdx >= 0 && currentIdx < sortedStudents.length - 1 ? 'rgb(var(--c-text-primary) / 0.7)' : 'rgb(var(--c-text-secondary) / calc(0.18 * var(--c-sec-mult)))', cursor: currentIdx >= 0 && currentIdx < sortedStudents.length - 1 ? 'pointer' : 'default', clipPath: 'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,0 100%)' }}
            onMouseEnter={e => { if (currentIdx >= 0 && currentIdx < sortedStudents.length - 1) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(225,25,25,0.4)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))' }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Date (read-only display) */}
        <div className="relative overflow-hidden" style={angularCard}>
          <div className="absolute top-0 left-0 right-0 h-px" style={redLine} />
          <div className="px-4 py-3">
            <label style={{ display: 'block', color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>Assessment Date</label>
            <p className="text-off-white text-sm">
              {isCurrentEntry
                ? new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
                : new Date(history[historyIdx]?.assessment_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* ── Student banner ───────────────────────────────────────── */}
      {student && (
        <div ref={bannerRef} className="relative overflow-hidden flex flex-wrap items-center gap-6 px-5 py-4"
          style={{ background: 'rgba(225,25,25,0.04)', border: '1px solid rgba(225,25,25,0.15)', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))' }}>
          <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'linear-gradient(to bottom,#E11919,transparent)' }} />
          <div className="w-9 h-9 flex items-center justify-center font-display text-lg shrink-0"
            style={{ background: 'rgba(225,25,25,0.15)', border: '1px solid rgba(225,25,25,0.3)', color: '#E11919' }}>
            {(student.full_name ?? '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-display text-off-white">{student.full_name}</p>
            <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.65rem' }}>{student.student_id} · {student.sport}
              {assessedTodayIds.has(student.id) && (
                <span style={{ marginLeft: 10, color: '#34d399' }}>✓ assessed today</span>
              )}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-8">
            <div className="text-center">
              <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.48rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Level</p>
              <p className="text-off-white text-sm capitalize">{student.level}</p>
            </div>
            {isCurrentEntry && (
              <div className="text-center">
                <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.48rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Live Grade</p>
                <p className="font-display text-2xl" style={{ color: '#E11919', lineHeight: 1 }}>
                  {calc ? `${calc.grade.toFixed(1)}%` : '—'}
                </p>
              </div>
            )}
            {isCurrentEntry && calc && (
              <div className="text-center">
                <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.48rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Projected</p>
                <p className="font-display text-sm" style={{ color: LEVEL_COLOR[calc.level] }}>{calc.level}</p>
              </div>
            )}
            {/* Prev / Next in banner */}
            <div className="flex items-center gap-2">
              <button onClick={goPrev} disabled={currentIdx <= 0}
                title={currentIdx > 0 ? `← ${sortedStudents[currentIdx - 1]?.full_name}` : ''}
                className="flex items-center gap-1 px-3 py-1.5 font-display text-xs tracking-widest uppercase transition-all"
                style={{ border: '1px solid rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))', color: currentIdx > 0 ? 'rgb(var(--c-text-primary) / 0.7)' : 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', background: 'none', cursor: currentIdx > 0 ? 'pointer' : 'default' }}
                onMouseEnter={e => { if (currentIdx > 0) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(225,25,25,0.3)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))' }}>
                <ChevronLeft size={12} /> Prev
              </button>
              <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', fontSize: '0.6rem' }}>{currentIdx + 1}/{sortedStudents.length}</span>
              <button onClick={goNext} disabled={currentIdx >= sortedStudents.length - 1}
                title={currentIdx >= 0 && currentIdx < sortedStudents.length - 1 ? `${sortedStudents[currentIdx + 1]?.full_name} →` : ''}
                className="flex items-center gap-1 px-3 py-1.5 font-display text-xs tracking-widest uppercase transition-all"
                style={{ border: '1px solid rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))', color: currentIdx >= 0 && currentIdx < sortedStudents.length - 1 ? 'rgb(var(--c-text-primary) / 0.7)' : 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', background: 'none', cursor: currentIdx >= 0 && currentIdx < sortedStudents.length - 1 ? 'pointer' : 'default' }}
                onMouseEnter={e => { if (currentIdx >= 0 && currentIdx < sortedStudents.length - 1) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(225,25,25,0.3)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))' }}>
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History navigation bar ───────────────────────────────── */}
      {student && history.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setHistoryIdx(i => Math.min(history.length - 1, i + 1))}
            disabled={!canGoOlder}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-display tracking-widest uppercase transition-all"
            style={{
              background: canGoOlder ? 'rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))' : 'transparent',
              border: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))',
              color: canGoOlder ? 'rgb(var(--c-text-primary) / 0.7)' : 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))',
              cursor: canGoOlder ? 'pointer' : 'default',
            }}
            onMouseEnter={e => { if (canGoOlder) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(225,25,25,0.3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))' }}>
            <ChevronLeft size={13} /> Older
          </button>

          {/* Session pills */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <button
              onClick={() => setHistoryIdx(-1)}
              className="px-3 py-1.5 text-xs font-display tracking-widest uppercase transition-all"
              style={{
                background: isCurrentEntry ? 'rgba(225,25,25,0.12)' : 'transparent',
                border: `1px solid ${isCurrentEntry ? 'rgba(225,25,25,0.4)' : 'rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))'}`,
                color: isCurrentEntry ? '#E11919' : 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))',
                cursor: 'pointer',
              }}>
              New Entry
            </button>
            {history.map((h: any, i: number) => (
              <button key={h.id}
                onClick={() => setHistoryIdx(i)}
                className="px-3 py-1.5 text-xs font-display transition-all"
                style={{
                  background: historyIdx === i ? 'rgba(225,25,25,0.08)' : 'transparent',
                  border: `1px solid ${historyIdx === i ? 'rgba(225,25,25,0.3)' : 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))'}`,
                  color: historyIdx === i ? 'rgb(var(--c-text-primary) / 0.9)' : 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))',
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}>
                {new Date(h.assessment_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' })}
                <span style={{ marginLeft: 6, color: historyIdx === i ? '#E11919' : 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', fontSize: '0.7rem' }}>
                  {h.grade_percentage}%
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setHistoryIdx(i => Math.max(-1, i - 1))}
            disabled={!canGoNewer}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-display tracking-widest uppercase transition-all"
            style={{
              background: canGoNewer ? 'rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))' : 'transparent',
              border: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))',
              color: canGoNewer ? 'rgb(var(--c-text-primary) / 0.7)' : 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))',
              cursor: canGoNewer ? 'pointer' : 'default',
            }}
            onMouseEnter={e => { if (canGoNewer) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(225,25,25,0.3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))' }}>
            Newer <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* ── PAST ASSESSMENT VIEW ─────────────────────────────────── */}
      {student && !isCurrentEntry && (
        <>
          {(loadingDetail || loadingTpl || !sessionDetail || !pillars.length) ? (
            <div style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.75rem', padding: '40px 0', textAlign: 'center' }}>Loading assessment...</div>
          ) : (
            <PastAssessmentView session={sessionDetail} pillars={pillars} />
          )}
        </>
      )}

      {/* ── CURRENT ENTRY FORM ───────────────────────────────────── */}
      {student && isCurrentEntry && (
        <>
          {loadingTpl && (
            <div style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.75rem', padding: '40px 0', textAlign: 'center' }}>Loading scorecard...</div>
          )}
          {tplError && (
            <div className="flex items-center gap-3 p-4" style={{ background: 'rgba(225,25,25,0.06)', border: '1px solid rgba(225,25,25,0.2)' }}>
              <AlertCircle size={16} style={{ color: '#E11919' }} />
              <span style={{ color: 'rgb(var(--c-text-primary) / 0.6)', fontSize: '0.8rem' }}>Could not load template. Make sure the backend is running.</span>
            </div>
          )}

          {template && pillars.length > 0 && (
            <div className="relative overflow-hidden"
              style={{ background: 'rgb(var(--c-bg-surface))', border: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)' }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,#E11919,rgba(225,25,25,0.2) 60%,transparent)' }} />
              <div className="absolute top-0 left-0 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom,#E11919,transparent 70%)' }} />

              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 42 }} /><col style={{ width: 220 }} /><col style={{ minWidth: 100 }} />
                    <col style={{ width: 90 }} /><col style={{ minWidth: 200 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))' }}>
                      {['#', 'Criterion', 'Pillar', 'Score /10', 'Comment'].map(h => (
                        <th key={h} style={{ ...cell, height: 36, color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.24em', textTransform: 'uppercase', textAlign: h === 'Score /10' ? 'center' : 'left', fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pillars.map((pillar: any, pi: number) => {
                      const criteriaIds = pillar.criteria.map((c: any) => c.id)
                      const pillarVals = criteriaIds.map((id: string) => parseFloat(scores[id])).filter((v: number) => !isNaN(v) && v <= 10)
                      const sectionAvg = avg(pillarVals)
                      return [
                        <tr key={`ph-${pillar.id}`} style={{ background: 'rgba(225,25,25,0.055)', borderTop: pi > 0 ? '1px solid rgba(225,25,25,0.12)' : undefined, borderBottom: '1px solid rgba(225,25,25,0.08)' }}>
                          <td colSpan={3} style={{ ...cell, height: 36, paddingLeft: 16 }}>
                            <div className="flex items-center gap-3">
                              <span style={{ color: '#E11919', fontFamily: 'var(--font-display)', fontSize: 11 }}>{String(pi + 1).padStart(2, '0')}</span>
                              <span className="font-display text-off-white" style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{pillar.name}</span>
                            </div>
                          </td>
                          <td style={{ ...cell, height: 36, textAlign: 'center' }}>
                            {sectionAvg !== null
                              ? <span className="font-display" style={{ color: '#E11919', fontSize: 14 }}>{sectionAvg.toFixed(2)}</span>
                              : <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', fontSize: 11 }}>—</span>}
                          </td>
                          <td style={{ ...cell, height: 36 }}>
                            <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.25 * var(--c-sec-mult)))', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>section average</span>
                          </td>
                        </tr>,
                        ...pillar.criteria.map((criterion: any) => {
                          rowNum++
                          const num = rowNum
                          return (
                            <tr key={criterion.id}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgb(var(--c-overlay) / calc(0.018 * var(--c-ovl-mult)))' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                              <td style={{ ...cell, color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', fontSize: 11, fontFamily: 'var(--font-display)', textAlign: 'center' }}>{num}</td>
                              <td style={{ ...cell, color: 'rgb(var(--c-text-primary) / 0.82)', fontSize: 13 }}>{criterion.name}</td>
                              <td style={{ ...cell, color: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', fontSize: 11 }}>—</td>
                              <td style={{ ...cell, textAlign: 'center', padding: '0 8px' }}>
                                <input
                                  type="number" min={0} max={10} step={0.5}
                                  value={scores[criterion.id] ?? ''}
                                  onChange={e => handleScoreChange(criterion.id, e.target.value)}
                                  onBlur={() => handleScoreBlur(criterion.id)}
                                  placeholder="—"
                                  style={scoreInputStyle}
                                  onFocus={e => { e.target.style.borderColor = '#E11919'; e.target.style.boxShadow = '0 0 10px rgba(225,25,25,0.15)' }}
                                />
                              </td>
                              <td style={{ ...cell, padding: '0 12px' }}>
                                <input type="text"
                                  value={comments[criterion.id] ?? ''}
                                  onChange={e => setComments(prev => ({ ...prev, [criterion.id]: e.target.value }))}
                                  placeholder="Note..."
                                  style={commentInputStyle}
                                  onFocus={e => e.target.style.borderColor = 'rgba(225,25,25,0.3)'}
                                  onBlur={e => e.target.style.borderColor = 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))'}
                                />
                              </td>
                            </tr>
                          )
                        }),
                      ]
                    })}
                    <tr style={{ background: 'rgba(225,25,25,0.08)', borderTop: '1px solid rgba(225,25,25,0.2)' }}>
                      <td colSpan={3} style={{ ...cell, height: 48, paddingLeft: 16 }}>
                        <span className="font-display text-off-white" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Overall Score</span>
                      </td>
                      <td style={{ ...cell, height: 48, textAlign: 'center' }}>
                        {calc
                          ? <span className="font-display" style={{ color: '#E11919', fontSize: 18 }}>{calc.grade.toFixed(1)}<span style={{ fontSize: 12 }}>%</span></span>
                          : <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))' }}>—</span>}
                      </td>
                      <td style={{ ...cell, height: 48 }}>
                        {calc && <span className="font-display text-sm" style={{ color: LEVEL_COLOR[calc.level] }}>{calc.level}</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes + Plan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Coach Notes', value: notes, set: setNotes, ph: 'Overall observations about this session...' },
              { label: 'Action Plan / Goals', value: plan, set: setPlan, ph: 'What should the student focus on next...' },
            ].map(({ label, value, set, ph }) => (
              <div key={label} className="relative overflow-hidden" style={angularCard}>
                <div className="absolute top-0 left-0 right-0 h-px" style={redLine} />
                <div className="p-4">
                  <label style={{ display: 'block', color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</label>
                  <textarea value={value} onChange={e => set(e.target.value)} placeholder={ph} rows={4}
                    className="w-full bg-transparent text-off-white/80 text-sm outline-none resize-y"
                    style={{ border: 'none', lineHeight: 1.6 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              {submitted && (
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} style={{ color: '#34d399' }} />
                  <span style={{ color: '#34d399', fontSize: '0.75rem' }}>Submitted — final score auto-averaged from all coach entries</span>
                </div>
              )}
              {entries.length > 1 && (
                <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.65rem', marginTop: 4 }}>
                  {entries.length} coach submissions for {date} — final score averaged
                </p>
              )}
            </div>
            <button onClick={handleSubmit}
              disabled={submitMutation.isPending || !student || !template}
              className="flex items-center gap-2 font-display text-white text-xs tracking-[0.22em] uppercase px-6 py-3 transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg,#E11919,#B90F16)',
                clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)',
                opacity: (submitMutation.isPending || !student || !template) ? 0.45 : 1,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(225,25,25,0.4)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
              <Save size={13} />
              {submitMutation.isPending ? 'Saving...' : 'Submit Assessment'}
            </button>
          </div>

          {/* ── Post-submit Prev / Next navigation ── */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button onClick={goPrev} disabled={currentIdx <= 0}
              className="flex items-center gap-3 px-5 py-3 flex-1 transition-all"
              style={{
                background: 'rgb(var(--c-bg-elevated))', border: `1px solid ${currentIdx > 0 ? 'rgba(225,25,25,0.25)' : 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))'}`,
                color: currentIdx > 0 ? 'rgb(var(--c-text-primary) / 0.75)' : 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))',
                cursor: currentIdx > 0 ? 'pointer' : 'default',
                clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)',
              }}
              onMouseEnter={e => { if (currentIdx > 0) { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(225,25,25,0.5)'; el.style.background = 'rgba(225,25,25,0.05)' } }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = currentIdx > 0 ? 'rgba(225,25,25,0.25)' : 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))'; el.style.background = 'rgb(var(--c-bg-elevated))' }}>
              <ChevronLeft size={16} style={{ flexShrink: 0 }} />
              <div className="text-left min-w-0">
                <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.48rem', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 2 }}>Previous Student</p>
                <p className="font-display text-sm truncate">{currentIdx > 0 ? sortedStudents[currentIdx - 1]?.full_name : '—'}</p>
              </div>
            </button>

            <div style={{ color: 'rgb(var(--c-text-secondary) / calc(0.25 * var(--c-sec-mult)))', fontSize: '0.65rem', flexShrink: 0 }}>
              {student ? `${currentIdx + 1} / ${sortedStudents.length}` : '—'}
            </div>

            <button onClick={goNext} disabled={currentIdx < 0 || currentIdx >= sortedStudents.length - 1}
              className="flex items-center justify-end gap-3 px-5 py-3 flex-1 transition-all"
              style={{
                background: 'rgb(var(--c-bg-elevated))', border: `1px solid ${currentIdx >= 0 && currentIdx < sortedStudents.length - 1 ? 'rgba(225,25,25,0.25)' : 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))'}`,
                color: currentIdx >= 0 && currentIdx < sortedStudents.length - 1 ? 'rgb(var(--c-text-primary) / 0.75)' : 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))',
                cursor: currentIdx >= 0 && currentIdx < sortedStudents.length - 1 ? 'pointer' : 'default',
                clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)',
              }}
              onMouseEnter={e => { if (currentIdx >= 0 && currentIdx < sortedStudents.length - 1) { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(225,25,25,0.5)'; el.style.background = 'rgba(225,25,25,0.05)' } }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = currentIdx >= 0 && currentIdx < sortedStudents.length - 1 ? 'rgba(225,25,25,0.25)' : 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))'; el.style.background = 'rgb(var(--c-bg-elevated))' }}>
              <div className="text-right min-w-0">
                <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.48rem', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 2 }}>Next Student</p>
                <p className="font-display text-sm truncate">{currentIdx >= 0 && currentIdx < sortedStudents.length - 1 ? sortedStudents[currentIdx + 1]?.full_name : '—'}</p>
              </div>
              <ChevronRight size={16} style={{ flexShrink: 0 }} />
            </button>
          </div>

          {/* Submissions */}
          {entries.length > 0 && (
            <div className="relative overflow-hidden" style={{ ...angularCard, border: '1px solid rgba(52,211,153,0.1)' }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,rgba(52,211,153,0.5),transparent)' }} />
              <div className="p-4">
                <label style={{ display: 'block', color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Submissions for {date}
                </label>
                {entries.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))' }}>
                    <div>
                      <span className="text-off-white text-sm">{e.coach_name ?? 'Coach'}</span>
                      <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.65rem', marginLeft: 12 }}>
                        {e.scores?.length ?? 0} criteria · {new Date(e.submitted_at).toLocaleString()}
                      </span>
                    </div>
                    <CheckCircle size={13} style={{ color: '#34d399' }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {!student && (
        <div className="relative overflow-hidden text-center py-24"
          style={{ background: 'rgb(var(--c-bg-surface))', border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={redLine} />
          <User size={32} style={{ color: 'rgb(var(--c-text-secondary) / calc(0.15 * var(--c-sec-mult)))', margin: '0 auto 12px' }} />
          <p className="font-display text-off-white/50 text-base mb-1">Select a student to begin</p>
          <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', fontSize: '0.75rem' }}>Use the dropdown above to load a student's scorecard</p>
        </div>
      )}
    </div>
  )
}
