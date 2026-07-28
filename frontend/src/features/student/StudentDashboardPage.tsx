import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { studentsService } from '../../services/students.service'
import { leaderboardService } from '../../services/analytics.service'
import { Badge } from '../../components/ui/Badge'
import { StatCard } from '../../components/ui/StatCard'
import { CardSkeleton } from '../../components/ui/LoadingSkeleton'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Trophy, Target, TrendingUp, ClipboardList, Award } from 'lucide-react'

export function StudentDashboardPage() {
  const { user } = useAuth()

  const { data: myStudent } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: studentsService.getMe,
  })

  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ['my-progress', myStudent?.id],
    queryFn: () => studentsService.getProgress(myStudent!.id),
    enabled: !!myStudent?.id,
  })

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => leaderboardService.get({}),
  })

  const prog = progress as any
  // API returns history (oldest→newest); reverse for display (newest first)
  const history: any[] = prog?.history ?? []
  const latest = history[history.length - 1]

  const trendData = [...history].map((s: any) => ({
    date: new Date(s.assessment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: s.grade_percentage,
  }))

  const lb = (leaderboard as any[]) ?? []
  const myRank = lb.findIndex((e: any) => e.student_id === myStudent?.student_id) + 1

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  if (loadingProgress && myStudent) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-overlay/5 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))', fontSize: '0.58rem', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 6 }}>
            Student Portal
          </p>
          <h1 className="font-display text-off-white" style={{ fontSize: '2.4rem', letterSpacing: '0.08em', lineHeight: 1 }}>
            Welcome back,{' '}
            <span className="text-blood-red">{user?.fullName?.split(' ')[0]}</span>
          </h1>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <div className="h-[2px] w-10 bg-blood-red shrink-0" />
            {myStudent && (
              <>
                <span className="font-display text-steel-gray/60" style={{ fontSize: '0.7rem', letterSpacing: '0.2em' }}>
                  {myStudent.student_id}
                </span>
                <span className="text-overlay/10">·</span>
                <Badge variant={myStudent.sport}>{myStudent.sport}</Badge>
                <Badge variant={myStudent.level}>{myStudent.level}</Badge>
              </>
            )}
          </div>
          <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.32 * var(--c-sec-mult)))', fontSize: '0.56rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginTop: 8 }}>
            {dateStr}
          </p>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Current Score"  value={latest ? `${latest.grade_percentage}%` : '—'} icon={Target}      accent />
        <StatCard label="Improvement"    value={prog?.improvement != null ? `${prog.improvement > 0 ? '+' : ''}${(prog.improvement * 10).toFixed(1)}%` : '—'} icon={TrendingUp} />
        <StatCard label="Assessments"    value={prog?.total_assessments ?? 0}                icon={ClipboardList} />
        <StatCard label="Rank"           value={myRank > 0 ? `#${myRank}` : '—'}            icon={Award}         sub="on leaderboard" />
      </div>

      {/* ── Top 3 banner ────────────────────────────────── */}
      {myRank > 0 && myRank <= 3 && (
        <div className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(105deg, rgb(var(--c-bg-surface)) 0%, rgb(var(--c-amber-wash)) 60%, rgba(251,191,36,0.05) 100%)',
            border: '1px solid rgba(251,191,36,0.18)',
            clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
          }}>
          <div className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: 'linear-gradient(to bottom, #fbbf24, rgba(251,191,36,0.2))' }} />
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(to right, #fbbf24, rgba(251,191,36,0.3) 50%, transparent)' }} />
          <div className="pl-6 pr-6 py-5 flex items-center gap-4">
            <div className="shrink-0 w-11 h-11 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
              <Trophy size={18} className="text-black" />
            </div>
            <div>
              <p style={{ color: 'rgba(251,191,36,0.5)', fontSize: '0.57rem', letterSpacing: '0.36em', textTransform: 'uppercase', marginBottom: 3 }}>
                Top Performer
              </p>
              <p className="font-display text-off-white" style={{ fontSize: '1.1rem', letterSpacing: '0.06em' }}>
                Rank #{myRank} on the leaderboard — keep pushing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Score trend ─────────────────────────────────── */}
      {trendData.length > 1 && (
        <div className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgb(var(--c-bg-elevated)) 0%, rgb(var(--c-bg-input)) 100%)',
            border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
            clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
          }}>
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.2) 50%, transparent)' }} />
          <div className="absolute top-0 left-0 bottom-0 w-px"
            style={{ background: 'linear-gradient(to bottom, #E11919, transparent 60%)' }} />
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-[3px] h-4 bg-blood-red" />
              <h3 className="font-display text-off-white text-xs uppercase tracking-[0.22em]">Score Trend</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#E11919" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#E11919" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))" />
                <XAxis dataKey="date" tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid rgba(225,25,25,0.2)', borderRadius: 0, fontSize: 12 }}
                  itemStyle={{ color: '#E11919' }}
                  labelStyle={{ color: 'rgb(var(--c-text-secondary))', fontSize: 11 }}
                  cursor={{ stroke: 'rgba(225,25,25,0.2)', strokeWidth: 1 }}
                />
                <Line type="monotone" dataKey="score" stroke="#E11919" strokeWidth={2}
                  dot={{ fill: '#E11919', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#E11919', stroke: 'rgba(225,25,25,0.3)', strokeWidth: 4 }}
                  name="Score %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Latest assessment ───────────────────────────── */}
      {latest && (
        <div className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgb(var(--c-bg-elevated)) 0%, rgb(var(--c-bg-input)) 100%)',
            border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
            clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
          }}>
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.2) 50%, transparent)' }} />
          <div className="absolute top-0 left-0 bottom-0 w-px"
            style={{ background: 'linear-gradient(to bottom, #E11919, transparent 60%)' }} />
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-[3px] h-4 bg-blood-red" />
              <h3 className="font-display text-off-white text-xs uppercase tracking-[0.22em]">Latest Assessment</h3>
              <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.2em' }}>
                {new Date(latest.assessment_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            {/* Score + level */}
            <div className="flex items-center gap-6 mb-5 pb-5" style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }}>
              <div>
                <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 4 }}>Final Score</p>
                <p className="font-display text-blood-red" style={{ fontSize: '3.2rem', lineHeight: 1 }}>
                  {latest.grade_percentage}<span style={{ fontSize: '1.4rem' }}>%</span>
                </p>
              </div>
              <div>
                <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 6 }}>Level</p>
                <Badge variant={latest.level_at_assessment as any}>{latest.level_at_assessment}</Badge>
              </div>
              {latest.sessions_completed > 0 && (
                <div>
                  <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 4 }}>Sessions</p>
                  <p className="font-display text-off-white text-xl">{latest.sessions_completed}</p>
                </div>
              )}
            </div>

            {/* Notes + Plan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latest.coach_notes ? (
                <div className="p-4" style={{ background: 'rgb(var(--c-overlay) / calc(0.02 * var(--c-ovl-mult)))', border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }}>
                  <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 8 }}>Coach Notes</p>
                  <p className="text-off-white/80 text-sm leading-relaxed">{latest.coach_notes}</p>
                </div>
              ) : null}
              {latest.action_plan ? (
                <div className="p-4" style={{ background: 'rgba(225,25,25,0.03)', border: '1px solid rgba(225,25,25,0.1)' }}>
                  <p style={{ color: 'rgba(225,25,25,0.45)', fontSize: '0.5rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 8 }}>Action Plan / Goals</p>
                  <p className="text-off-white/75 text-sm leading-relaxed italic">{latest.action_plan}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {!myStudent && (
        <div className="relative overflow-hidden text-center py-16"
          style={{
            background: 'linear-gradient(145deg, rgb(var(--c-bg-elevated)), rgb(var(--c-bg-input)))',
            border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
          }}>
          <p className="text-steel-gray/50 text-sm">No student profile found. Contact your coach.</p>
        </div>
      )}
    </div>
  )
}
