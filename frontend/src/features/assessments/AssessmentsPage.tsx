import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { assessmentsService } from '../../services/students.service'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { ClipboardList, Plus, TrendingUp, Award, Calendar, ChevronRight } from 'lucide-react'
import type { Sport } from '../../types'

const LEVEL_COLOR: Record<string, string> = {
  Advanced:     '#E11919',
  Intermediate: '#fbbf24',
  Beginner:     '#34d399',
}

const SPORT_COLOR: Record<string, string> = {
  boxing:     'rgba(225,25,25,0.15)',
  kickboxing: 'rgba(251,191,36,0.12)',
}
const SPORT_BORDER: Record<string, string> = {
  boxing:     'rgba(225,25,25,0.35)',
  kickboxing: 'rgba(251,191,36,0.3)',
}
const SPORT_TEXT: Record<string, string> = {
  boxing:     '#E11919',
  kickboxing: '#fbbf24',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function ScoreBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#E11919' : pct >= 50 ? '#fbbf24' : '#34d399'
  return (
    <div className="flex items-center gap-3 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-none" style={{ background: 'rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))' }}>
        <div className="h-1.5 transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(to right, ${color}88, ${color})` }} />
      </div>
      <span className="font-display text-sm shrink-0" style={{ color, minWidth: 48, textAlign: 'right' }}>
        {pct != null ? `${Number(pct).toFixed(1)}%` : '—'}
      </span>
    </div>
  )
}

export function AssessmentsPage() {
  const [sport, setSport] = useState<Sport | ''>('')
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['assessments', sport],
    queryFn: () => assessmentsService.list({ martial_art: (sport as Sport) || undefined }),
  })

  const list = (data?.results ?? data ?? []) as any[]

  // ── Stats ────────────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0]

  const todayList = useMemo(() => list.filter((a: any) => a.assessment_date === todayStr), [list, todayStr])

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const weekList = useMemo(() =>
    list.filter((a: any) => new Date(a.assessment_date) >= weekAgo),
    [list]
  )
  const weekAvg = useMemo(() => {
    const valid = weekList.filter((a: any) => a.grade_percentage != null)
    if (!valid.length) return null
    return valid.reduce((s: number, a: any) => s + Number(a.grade_percentage), 0) / valid.length
  }, [weekList])

  const topToday = useMemo(() => {
    if (!todayList.length) return null
    return todayList.reduce((best: any, a: any) =>
      Number(a.grade_percentage) > Number(best.grade_percentage) ? a : best
    )
  }, [todayList])

  // ── Group by date ────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const a of list) {
      const key = a.assessment_date
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [list])

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const statCard = (icon: React.ReactNode, label: string, value: React.ReactNode, sub: string) => (
    <div className="relative overflow-hidden px-5 py-4 flex gap-4 items-start"
      style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))', clipPath: 'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)' }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,#E11919,transparent)' }} />
      <div className="w-9 h-9 flex items-center justify-center shrink-0"
        style={{ background: 'rgba(225,25,25,0.1)', border: '1px solid rgba(225,25,25,0.2)' }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.38 * var(--c-sec-mult)))', fontSize: '0.48rem', letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
        <div className="font-display text-off-white" style={{ fontSize: '1.55rem', lineHeight: 1, marginBottom: 3 }}>{value}</div>
        <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.32 * var(--c-sec-mult)))', fontSize: '0.62rem' }}>{sub}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))', fontSize: '0.58rem', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 6 }}>
            Management
          </p>
          <h1 className="font-display text-off-white" style={{ fontSize: '2.4rem', letterSpacing: '0.1em', lineHeight: 1 }}>
            Assessments
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-[2px] w-10 bg-blood-red" />
            <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.38 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              {list.length} records · {dateStr}
            </span>
          </div>
        </div>

        <div className="flex gap-2 pb-1 flex-wrap items-center">
          <button
            onClick={() => navigate('/admin/assessments/entry')}
            className="flex items-center gap-2 text-white font-display text-xs tracking-[0.2em] uppercase px-4 py-2 transition-all"
            style={{ background: 'linear-gradient(135deg,#E11919,#B90F16)', clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(225,25,25,0.35)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
            <Plus size={12} /> New Entry
          </button>
          {(['', 'boxing', 'kickboxing'] as const).map(v => (
            <button key={v} onClick={() => setSport(v as Sport | '')}
              style={{
                background: sport === v ? 'rgba(225,25,25,0.08)' : 'rgb(var(--c-bg-surface))',
                border: `1px solid ${sport === v ? 'rgba(225,25,25,0.4)' : 'rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))'}`,
                color: sport === v ? 'rgb(var(--c-text-primary))' : 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))',
                padding: '7px 14px', fontSize: '0.62rem', letterSpacing: '0.18em',
                textTransform: 'uppercase', cursor: 'pointer', outline: 'none',
              }}>
              {v || 'All Sports'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat cards ── */}
      {!isLoading && list.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCard(
            <ClipboardList size={16} style={{ color: '#E11919' }} />,
            'Total Records',
            list.length,
            `${todayList.length} assessed today`
          )}
          {statCard(
            <TrendingUp size={16} style={{ color: '#E11919' }} />,
            'Avg Score — 7 days',
            weekAvg != null ? <span style={{ color: weekAvg >= 80 ? '#E11919' : weekAvg >= 50 ? '#fbbf24' : '#34d399' }}>{weekAvg.toFixed(1)}%</span> : '—',
            `${weekList.length} sessions this week`
          )}
          {statCard(
            <Award size={16} style={{ color: '#E11919' }} />,
            "Today's Top Score",
            topToday
              ? <span style={{ color: LEVEL_COLOR[topToday.level_at_assessment] ?? '#E11919' }}>{Number(topToday.grade_percentage).toFixed(1)}%</span>
              : '—',
            topToday ? topToday.student_name ?? 'Unknown' : 'No assessments today'
          )}
        </div>
      )}

      {/* ── Timeline ── */}
      {isLoading ? (
        <LoadingSkeleton rows={8} />
      ) : list.length === 0 ? (
        <div className="relative overflow-hidden text-center py-20"
          style={{ background: 'linear-gradient(145deg,rgb(var(--c-bg-elevated)),rgb(var(--c-bg-input)))', border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,#E11919,rgba(225,25,25,0.2) 50%,transparent)' }} />
          <ClipboardList size={28} style={{ color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', margin: '0 auto 12px' }} />
          <p className="font-display text-off-white text-base mb-1">No assessments found</p>
          <p className="text-steel-gray/40 text-sm">Create a new entry to get started</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([dateKey, entries]) => (
            <div key={dateKey}>

              {/* Date header */}
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar size={11} style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))' }} />
                  <span className="font-display text-off-white" style={{ fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                    {formatDate(dateKey)}
                  </span>
                </div>
                <div className="flex-1 h-px" style={{ background: 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }} />
                <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', fontSize: '0.6rem', letterSpacing: '0.14em' }}>
                  {entries.length} session{entries.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Cards for this date */}
              <div className="space-y-2">
                {entries.map((a: any, i: number) => (
                  <div key={a.id}
                    onClick={() => navigate(`/admin/students/${a.student}`)}
                    className="relative overflow-hidden flex items-center gap-5 px-5 py-4 cursor-pointer transition-all duration-150 group"
                    style={{
                      background: 'rgb(var(--c-bg-elevated))',
                      border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
                      clipPath: i === 0
                        ? 'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)'
                        : 'none',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgba(225,25,25,0.04)'
                      el.style.borderColor = 'rgba(225,25,25,0.18)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgb(var(--c-bg-elevated))'
                      el.style.borderColor = 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))'
                    }}>

                    {/* Left accent */}
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'linear-gradient(to bottom,#E11919,transparent)' }} />

                    {/* Avatar */}
                    <div className="w-9 h-9 flex items-center justify-center font-display text-base shrink-0"
                      style={{ background: 'rgba(225,25,25,0.1)', border: '1px solid rgba(225,25,25,0.2)', color: '#E11919' }}>
                      {(a.student_name ?? '?')[0].toUpperCase()}
                    </div>

                    {/* Name */}
                    <div className="min-w-[160px]">
                      <p className="text-off-white text-sm font-medium">{a.student_name ?? a.student}</p>
                      <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.6rem', marginTop: 2 }}>
                        {new Date(a.assessment_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>

                    {/* Sport badge */}
                    <div className="shrink-0 px-3 py-1"
                      style={{
                        background: SPORT_COLOR[a.martial_art] ?? 'rgb(var(--c-text-secondary) / calc(0.08 * var(--c-sec-mult)))',
                        border: `1px solid ${SPORT_BORDER[a.martial_art] ?? 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))'}`,
                        color: SPORT_TEXT[a.martial_art] ?? 'rgb(var(--c-text-secondary) / calc(0.6 * var(--c-sec-mult)))',
                        fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase',
                      }}>
                      {a.martial_art}
                    </div>

                    {/* Score bar */}
                    <div className="flex-1">
                      <ScoreBar pct={Number(a.grade_percentage)} />
                    </div>

                    {/* Level */}
                    <div className="shrink-0 px-3 py-1 font-display"
                      style={{
                        background: `${LEVEL_COLOR[a.level_at_assessment] ?? '#888'}18`,
                        border: `1px solid ${LEVEL_COLOR[a.level_at_assessment] ?? '#888'}40`,
                        color: LEVEL_COLOR[a.level_at_assessment] ?? '#888',
                        fontSize: '0.52rem', letterSpacing: '0.18em', textTransform: 'uppercase', minWidth: 90, textAlign: 'center',
                      }}>
                      {a.level_at_assessment}
                    </div>

                    {/* Arrow */}
                    <ChevronRight size={14} style={{ color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', flexShrink: 0 }}
                      className="group-hover:text-blood-red transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
