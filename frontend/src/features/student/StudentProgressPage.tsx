import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { studentsService } from '../../services/students.service'
import { CardSkeleton } from '../../components/ui/LoadingSkeleton'
import { StatCard } from '../../components/ui/StatCard'
import { Target, Award, TrendingUp, ClipboardList } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'

const CHART = {
  tooltip: { background: 'rgb(var(--c-bg-elevated))', border: '1px solid rgba(225,25,25,0.2)', borderRadius: 0, fontSize: 12 },
  label: { color: 'rgb(var(--c-text-secondary))', fontSize: 11 },
  item: { color: '#E11919' },
  tick: { fill: 'rgb(var(--c-text-secondary))', fontSize: 10 },
  grid: 'rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))',
}

const angularCard = {
  background: 'linear-gradient(145deg, rgb(var(--c-bg-elevated)) 0%, rgb(var(--c-bg-input)) 100%)',
  border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
  boxShadow: 'var(--c-card-shadow)',
  clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
} as const

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-[3px] h-4 bg-blood-red" />
      <h3 className="font-display text-off-white text-xs uppercase tracking-[0.22em]">{title}</h3>
    </div>
  )
}

function CardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden" style={angularCard}>
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.2) 50%, transparent)' }} />
      <div className="absolute top-0 left-0 bottom-0 w-px"
        style={{ background: 'linear-gradient(to bottom, #E11919, transparent 60%)' }} />
      <div className="p-6">{children}</div>
    </div>
  )
}

export function StudentProgressPage() {
  const { user } = useAuth()

  const { data: myStudent } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: studentsService.getMe,
  })

  const { data: progress, isLoading } = useQuery({
    queryKey: ['my-progress', myStudent?.id],
    queryFn: () => studentsService.getProgress(myStudent!.id),
    enabled: !!myStudent?.id,
  })

  const prog = progress as any
  // API returns `history` oldest→newest
  const sessions = prog?.history ?? []

  const trendData = [...sessions].map((s: any) => ({
    date: new Date(s.assessment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    rating: s.rating_after,
  }))

  // latest_pillar_scores is the only per-assessment pillar breakdown the API
  // exposes (for the most recent session) -- there's no per-session pillar
  // history, so only the radar (latest snapshot) can be shown here, not a
  // multi-session pillar trend.
  const latestPillar = prog?.latest_pillar_scores ?? []
  const radarData = latestPillar.map((p: any) => ({
    pillar: p.pillar__name?.replace('Physical ', '').replace(' Skills', '') ?? 'Unknown',
    score: Number(p.score ?? 0) * 10,
    full: 100,
  }))

  if (isLoading && myStudent) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-overlay/5 animate-pulse" />
        <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <p style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))', fontSize: '0.58rem', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 6 }}>
          Student Portal
        </p>
        <h1 className="font-display text-off-white" style={{ fontSize: '2.4rem', letterSpacing: '0.08em', lineHeight: 1 }}>
          My <span className="text-blood-red">Progress</span>
        </h1>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-[2px] w-10 bg-blood-red" />
          <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.38 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
            Detailed performance breakdown
          </span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Rating"         value={prog?.current_rating  != null ? Number(prog.current_rating).toFixed(0) : '—'} icon={Target} accent />
        <StatCard label="Peak Rating"    value={prog?.highest_rating  != null ? Number(prog.highest_rating).toFixed(0) : '—'} icon={Award} />
        <StatCard label="Rating Change"  value={prog?.rating_change   != null ? `${prog.rating_change > 0 ? '+' : ''}${Number(prog.rating_change).toFixed(0)}` : '—'} icon={TrendingUp} />
        <StatCard label="Assessments"    value={prog?.total_assessments ?? 0}                                    icon={ClipboardList} sub="total" />
      </div>

      {sessions.length === 0 && (
        <div className="relative overflow-hidden text-center py-16" style={angularCard}>
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.2) 50%, transparent)' }} />
          <p className="text-steel-gray/50 text-sm">No assessments yet. Your coach will add them after your first session.</p>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          <CardWrapper>
            <SectionHeader title="Rating Trend" />
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="date" tick={CHART.tick} tickLine={false} axisLine={false} />
                <YAxis domain={['dataMin - 30', 'dataMax + 30']} tick={CHART.tick} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={CHART.tooltip} itemStyle={CHART.item} labelStyle={CHART.label}
                  cursor={{ stroke: 'rgba(225,25,25,0.2)', strokeWidth: 1 }} />
                <Line type="monotone" dataKey="rating" stroke="#E11919" strokeWidth={2}
                  dot={{ fill: '#E11919', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#E11919', stroke: 'rgba(225,25,25,0.3)', strokeWidth: 4 }}
                  name="Rating" />
              </LineChart>
            </ResponsiveContainer>
          </CardWrapper>

          {radarData.length > 0 && (
            <CardWrapper>
              <SectionHeader title="Latest Pillar Scores" />
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))" />
                  <PolarAngleAxis dataKey="pillar" tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 8 }} />
                  <Radar name="Score" dataKey="score" stroke="#E11919" fill="#E11919" fillOpacity={0.18} />
                </RadarChart>
              </ResponsiveContainer>
            </CardWrapper>
          )}
        </div>
      )}
    </div>
  )
}
