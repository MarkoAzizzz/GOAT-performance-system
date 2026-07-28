import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, ResponsiveContainer,
} from 'recharts'
import { Users, TrendingUp, ClipboardList, Target, Award, BarChart2, Trophy } from 'lucide-react'
import { analyticsService } from '../../services/analytics.service'
import { StatCard } from '../../components/ui/StatCard'
import { CardSkeleton } from '../../components/ui/LoadingSkeleton'

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-summary'],
    queryFn: analyticsService.getSummary,
  })

  const gradeData = data ? [
    { name: 'Beginner',      value: data.grade_distribution?.beginner      ?? 0, fill: 'var(--c-chart-green)' },
    { name: 'Intermediate',  value: data.grade_distribution?.intermediate   ?? 0, fill: 'var(--c-chart-amber)' },
    { name: 'Advanced',      value: data.grade_distribution?.advanced       ?? 0, fill: '#E11919' },
  ] : []

  const trend = data?.weekly_trend ?? []

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-8">

      {/* ── Page header ─────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))', fontSize: '0.58rem', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 6 }}>
            Performance
          </p>
          <h1 className="font-display text-off-white" style={{ fontSize: '2.4rem', letterSpacing: '0.1em', lineHeight: 1 }}>
            Dashboard
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-[2px] w-10 bg-blood-red" />
            <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.38 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              {dateStr}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"
              style={{ animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite' }} />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span style={{ color: 'rgba(52,211,153,0.5)', fontSize: '0.58rem', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            Live
          </span>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Total Students" value={data?.total_students ?? 0}        icon={Users} />
          <StatCard label="Active"          value={data?.active_students ?? 0}       icon={TrendingUp} accent />
          <StatCard label="This Week"       value={data?.weekly_assessments ?? 0}    icon={ClipboardList} sub="assessments" />
          <StatCard label="Avg Score"       value={`${data?.average_score ?? 0}%`}   icon={Target} />
          <StatCard label="Highest"         value={`${data?.highest_score ?? 0}%`}   icon={Award} />
          <StatCard label="Lowest"          value={`${data?.lowest_score ?? 0}%`}    icon={BarChart2} />
        </div>
      )}

      {/* ── Top Performer banner ────────────────────────── */}
      {data?.biggest_improvement?.student_name && (
        <div className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(105deg, rgb(var(--c-bg-surface)) 0%, rgb(var(--c-accent-wash)) 60%, rgba(225,25,25,0.06) 100%)',
            border: '1px solid rgba(225,25,25,0.18)',
            boxShadow: 'var(--c-card-shadow)',
            clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
          }}
        >
          {/* Left red accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: 'linear-gradient(to bottom, #E11919, rgba(225,25,25,0.2))' }} />
          {/* Top glow line */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.3) 50%, transparent)' }} />
          {/* Subtle red radial behind trophy */}
          <div className="absolute right-0 top-0 bottom-0 w-48 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at right center, rgba(225,25,25,0.07) 0%, transparent 70%)' }} />

          <div className="pl-6 pr-6 py-5 flex items-center gap-5">
            {/* Trophy icon */}
            <div className="shrink-0 w-12 h-12 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #E11919, #B90F16)',
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
              }}>
              <Trophy size={20} className="text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.57rem', letterSpacing: '0.36em', textTransform: 'uppercase', marginBottom: 4 }}>
                Biggest Improvement — This Period
              </p>
              <p className="font-display text-off-white truncate" style={{ fontSize: '1.35rem', letterSpacing: '0.08em' }}>
                {data.biggest_improvement.student_name}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-display text-blood-red" style={{ fontSize: '2.2rem', lineHeight: 1, letterSpacing: '0.04em' }}>
                +{data.biggest_improvement.improvement}%
              </p>
              <p style={{ color: 'rgba(225,25,25,0.45)', fontSize: '0.55rem', letterSpacing: '0.32em', textTransform: 'uppercase', marginTop: 4 }}>
                Score increase
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Charts ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Weekly trend */}
        <div className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgb(var(--c-bg-elevated)) 0%, rgb(var(--c-bg-input)) 100%)',
            border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
            boxShadow: 'var(--c-card-shadow)',
            clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
          }}>
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.2) 50%, transparent)' }} />
          <div className="absolute top-0 left-0 bottom-0 w-px"
            style={{ background: 'linear-gradient(to bottom, #E11919, transparent 60%)' }} />

          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-[3px] h-4 bg-blood-red" />
              <h3 className="font-display text-off-white text-xs uppercase tracking-[0.22em]">
                Score Trend — 8 Weeks
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#E11919" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#E11919" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))" />
                <XAxis dataKey="week" tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid rgba(225,25,25,0.2)', borderRadius: 0, fontSize: 12 }}
                  labelStyle={{ color: 'rgb(var(--c-text-secondary))', fontSize: 11, letterSpacing: '0.1em' }}
                  itemStyle={{ color: '#E11919' }}
                  cursor={{ stroke: 'rgba(225,25,25,0.2)', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="average_score" stroke="#E11919" strokeWidth={2}
                  fill="url(#scoreGrad)" name="Avg Score %" dot={{ fill: '#E11919', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#E11919', stroke: 'rgba(225,25,25,0.3)', strokeWidth: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Level distribution */}
        <div className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgb(var(--c-bg-elevated)) 0%, rgb(var(--c-bg-input)) 100%)',
            border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
            boxShadow: 'var(--c-card-shadow)',
            clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
          }}>
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.2) 50%, transparent)' }} />
          <div className="absolute top-0 left-0 bottom-0 w-px"
            style={{ background: 'linear-gradient(to bottom, #E11919, transparent 60%)' }} />

          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-[3px] h-4 bg-blood-red" />
              <h3 className="font-display text-off-white text-xs uppercase tracking-[0.22em]">
                Level Distribution
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={gradeData} barSize={44} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid rgba(225,25,25,0.2)', borderRadius: 0, fontSize: 12 }}
                  labelStyle={{ color: 'rgb(var(--c-text-secondary))', fontSize: 11 }}
                  cursor={{ fill: 'rgb(var(--c-overlay) / calc(0.025 * var(--c-ovl-mult)))' }}
                />
                <Bar dataKey="value" name="Students" radius={[2, 2, 0, 0]}>
                  {gradeData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} opacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center gap-5 mt-4 justify-center">
              {gradeData.map(({ name, fill }) => (
                <div key={name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm" style={{ background: fill }} />
                  <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
