import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie,
} from 'recharts'
import { analyticsService } from '../../services/analytics.service'
import { StatCard } from '../../components/ui/StatCard'
import { Badge } from '../../components/ui/Badge'
import { CardSkeleton } from '../../components/ui/LoadingSkeleton'
import { Target, TrendingUp, BarChart2, Award, BarChart as BarChartIcon } from 'lucide-react'

const C = {
  tooltip: { background: 'rgb(var(--c-bg-elevated))', border: '1px solid rgba(225,25,25,0.2)', borderRadius: 0, fontSize: 12 },
  label:   { color: 'rgb(var(--c-text-secondary))', fontSize: 11 },
  item:    { color: '#E11919' },
  tick:    { fill: 'rgb(var(--c-text-secondary))', fontSize: 10 },
  grid:    'rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))',
}

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'var(--c-chart-green)', intermediate: 'var(--c-chart-amber)', advanced: '#E11919',
}
const PILLAR_COLORS = ['#E11919', 'var(--c-chart-amber)', 'var(--c-chart-green)', 'var(--c-chart-blue)', 'var(--c-chart-purple)']

type Tab = 'overview' | 'sports' | 'pillars' | 'performers'

/* ── Shared card wrapper ──────────────────────────────────── */
function Card({ children, span2 = false }: { children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={`relative overflow-hidden ${span2 ? 'xl:col-span-2' : ''}`}
      style={{
        background: 'linear-gradient(145deg, rgb(var(--c-bg-elevated)) 0%, rgb(var(--c-bg-input)) 100%)',
        border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
        clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
      }}>
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.2) 50%, transparent)' }} />
      <div className="absolute top-0 left-0 bottom-0 w-px"
        style={{ background: 'linear-gradient(to bottom, #E11919, transparent 60%)' }} />
      <div className="p-6">{children}</div>
    </div>
  )
}

function CardTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-[3px] h-4 bg-blood-red" />
      <h3 className="font-display text-off-white text-xs uppercase tracking-[0.22em]">{title}</h3>
    </div>
  )
}

export function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [sportFilter, setSportFilter] = useState<string>('')

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['admin-summary'],
    queryFn: analyticsService.getSummary,
  })
  const { data: sportBreakdown, isLoading: loadingSports } = useQuery({
    queryKey: ['sport-breakdown'],
    queryFn: analyticsService.getSportBreakdown,
  })
  const { data: pillars, isLoading: loadingPillars } = useQuery({
    queryKey: ['pillars', sportFilter],
    queryFn: () => analyticsService.getPillars(sportFilter || undefined),
  })
  const { data: topPerformers, isLoading: loadingTop } = useQuery({
    queryKey: ['top-performers', sportFilter],
    queryFn: () => analyticsService.getTopPerformers(sportFilter || undefined),
  })
  const { data: scoreDist } = useQuery({
    queryKey: ['score-distribution', sportFilter],
    queryFn: () => analyticsService.getScoreDistribution(sportFilter || undefined),
  })

  const d = summary as any
  const trend = d?.weekly_trend ?? []
  const sports = (sportBreakdown as any[]) ?? []
  const pillarData = (pillars as any[]) ?? []
  const scoreDistData = (scoreDist as any[]) ?? []

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview',   label: 'Overview' },
    { key: 'sports',     label: 'Sport Breakdown' },
    { key: 'pillars',    label: 'Pillar Analysis' },
    { key: 'performers', label: 'Top Performers' },
  ]

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))', fontSize: '0.58rem', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 6 }}>
            Performance
          </p>
          <h1 className="font-display text-off-white" style={{ fontSize: '2.4rem', letterSpacing: '0.1em', lineHeight: 1 }}>
            Analytics
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-[2px] w-10 bg-blood-red" />
            <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.38 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              {dateStr}
            </span>
          </div>
        </div>

        {/* Sport filter */}
        <div className="flex items-center gap-3 pb-1">
          <select
            value={sportFilter}
            onChange={e => setSportFilter(e.target.value)}
            style={{
              background: 'rgb(var(--c-bg-surface))', border: '1px solid rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))',
              color: 'rgb(var(--c-text-secondary))', padding: '7px 14px', fontSize: '0.65rem',
              letterSpacing: '0.18em', textTransform: 'uppercase', outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">All Sports</option>
            <option value="boxing">Boxing</option>
            <option value="kickboxing">Kickboxing</option>
          </select>
        </div>
      </div>

      {/* ── Tab nav ────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }} className="flex gap-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px',
              fontSize: '0.6rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              borderBottom: tab === t.key ? '2px solid #E11919' : '2px solid transparent',
              color: tab === t.key ? 'rgb(var(--c-text-primary))' : 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))',
              background: 'none',
              cursor: 'pointer',
              transition: 'color 0.2s ease, border-color 0.2s ease',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* OVERVIEW                                              */}
      {/* ══════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {loadingSummary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Avg Score"    value={`${d?.average_score ?? 0}%`}    icon={Target}       accent />
              <StatCard label="Peak Score"   value={`${d?.highest_score ?? 0}%`}    icon={Award} />
              <StatCard label="Lowest Score" value={`${d?.lowest_score ?? 0}%`}     icon={BarChart2} />
              <StatCard label="This Week"    value={d?.weekly_assessments ?? 0}      icon={BarChartIcon} sub="sessions" />
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardTitle title="Weekly Avg Score" />
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#E11919" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#E11919" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="week" tick={C.tick} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={C.tick} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={C.tooltip} labelStyle={C.label} itemStyle={C.item}
                    cursor={{ stroke: 'rgba(225,25,25,0.2)', strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="average_score" stroke="#E11919" strokeWidth={2}
                    fill="url(#ag)" name="Avg %"
                    dot={{ fill: '#E11919', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#E11919', stroke: 'rgba(225,25,25,0.3)', strokeWidth: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <CardTitle title="Weekly Session Volume" />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trend} barSize={28} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="week" tick={C.tick} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={C.tick} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={C.tooltip} labelStyle={C.label} cursor={{ fill: 'rgb(var(--c-overlay) / calc(0.025 * var(--c-ovl-mult)))' }} />
                  <Bar dataKey="assessment_count" name="Sessions" fill="#E11919" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <CardTitle title="Score Distribution" />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={scoreDistData} barSize={44} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="range" tick={C.tick} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={C.tick} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={C.tooltip} labelStyle={C.label} cursor={{ fill: 'rgb(var(--c-overlay) / calc(0.025 * var(--c-ovl-mult)))' }} />
                  <Bar dataKey="count" name="Students" radius={[2, 2, 0, 0]}>
                    {scoreDistData.map((_: any, i: number) => (
                      <Cell key={i} fill={PILLAR_COLORS[i % PILLAR_COLORS.length]} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <CardTitle title="Level Distribution" />
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Beginner',     value: d?.grade_distribution?.beginner     ?? 0, fill: 'var(--c-chart-green)' },
                      { name: 'Intermediate', value: d?.grade_distribution?.intermediate ?? 0, fill: 'var(--c-chart-amber)' },
                      { name: 'Advanced',     value: d?.grade_distribution?.advanced     ?? 0, fill: '#E11919' },
                    ]}
                    dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={46}
                    strokeWidth={0}
                  >
                    {[
                      { fill: 'var(--c-chart-green)' }, { fill: 'var(--c-chart-amber)' }, { fill: '#E11919' },
                    ].map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={C.tooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-5 mt-2 justify-center">
                {[['Beginner','var(--c-chart-green)'],['Intermediate','var(--c-chart-amber)'],['Advanced','#E11919']].map(([name, color]) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                    <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{name}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* SPORTS                                                */}
      {/* ══════════════════════════════════════════════════════ */}
      {tab === 'sports' && (
        <div className="space-y-6">
          {loadingSports ? (
            <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sports.map((s: any) => {
                  const accent = s.sport === 'boxing' ? 'var(--c-chart-blue)' : 'var(--c-chart-purple)'
                  return (
                    <div key={s.sport} className="relative overflow-hidden"
                      style={{
                        background: 'linear-gradient(145deg, rgb(var(--c-bg-elevated)) 0%, rgb(var(--c-bg-input)) 100%)',
                        border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
                        clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
                      }}>
                      <div className="absolute top-0 left-0 right-0 h-px"
                        style={{ background: `linear-gradient(to right, ${accent}, rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult))) 50%, transparent)` }} />
                      <div className="absolute top-0 left-0 bottom-0 w-[3px]"
                        style={{ background: `linear-gradient(to bottom, ${accent}, transparent 70%)` }} />
                      <div className="p-6 space-y-5">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-off-white text-xl capitalize tracking-wide">{s.sport}</h3>
                          <Badge variant={s.sport}>{s.sport}</Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Students', value: s.total_students },
                            { label: 'Active',   value: s.active_students },
                            { label: 'Sessions', value: s.total_sessions },
                          ].map(c => (
                            <div key={c.label} className="text-center py-3"
                              style={{ background: 'rgb(var(--c-overlay) / calc(0.03 * var(--c-ovl-mult)))', border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }}>
                              <p className="font-display text-off-white text-xl">{c.value}</p>
                              <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: 3 }}>{c.label}</p>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-center">
                          {[
                            { label: 'Avg Score', value: `${s.average_score}%` },
                            { label: 'Highest',   value: `${s.highest_score}%` },
                            { label: 'Lowest',    value: `${s.lowest_score}%`  },
                          ].map(c => (
                            <div key={c.label}>
                              <p className="font-display text-off-white text-lg">{c.value}</p>
                              <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{c.label}</p>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2.5 pt-3" style={{ borderTop: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }}>
                          {['beginner', 'intermediate', 'advanced'].map(lvl => {
                            const count = s.level_distribution?.[lvl] ?? 0
                            const pct = s.total_students > 0 ? (count / s.total_students) * 100 : 0
                            return (
                              <div key={lvl} className="flex items-center gap-3">
                                <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', width: 80 }}>{lvl}</span>
                                <div className="flex-1 h-1 overflow-hidden" style={{ background: 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }}>
                                  <div className="h-full transition-all duration-700"
                                    style={{ width: `${pct}%`, background: LEVEL_COLORS[lvl] }} />
                                </div>
                                <span className="font-display text-off-white text-xs w-5 text-right">{count}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Card>
                <CardTitle title="Score Comparison — Boxing vs Kickboxing" />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={[
                      { metric: 'Avg Score', boxing: sports.find((s: any) => s.sport==='boxing')?.average_score ?? 0, kickboxing: sports.find((s: any) => s.sport==='kickboxing')?.average_score ?? 0 },
                      { metric: 'Highest',   boxing: sports.find((s: any) => s.sport==='boxing')?.highest_score ?? 0, kickboxing: sports.find((s: any) => s.sport==='kickboxing')?.highest_score ?? 0 },
                      { metric: 'Lowest',    boxing: sports.find((s: any) => s.sport==='boxing')?.lowest_score  ?? 0, kickboxing: sports.find((s: any) => s.sport==='kickboxing')?.lowest_score  ?? 0 },
                    ]}
                    barSize={36} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="metric" tick={C.tick} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={C.tick} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={C.tooltip} labelStyle={C.label} cursor={{ fill: 'rgb(var(--c-overlay) / calc(0.025 * var(--c-ovl-mult)))' }} />
                    <Bar dataKey="boxing"    name="Boxing"    fill="var(--c-chart-blue)" fillOpacity={0.85} radius={[2,2,0,0]} />
                    <Bar dataKey="kickboxing" name="Kickboxing" fill="var(--c-chart-purple)" fillOpacity={0.85} radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-5 mt-4 justify-center">
                  {[['Boxing','var(--c-chart-blue)'],['Kickboxing','var(--c-chart-purple)']].map(([name,color]) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                      <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{name}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* PILLARS                                               */}
      {/* ══════════════════════════════════════════════════════ */}
      {tab === 'pillars' && (
        <div className="space-y-6">
          {loadingPillars ? (
            <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
          ) : pillarData.length === 0 ? (
            <div className="relative overflow-hidden text-center py-16"
              style={{ background: 'linear-gradient(145deg,rgb(var(--c-bg-elevated)),rgb(var(--c-bg-input)))', border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }}>
              <p className="text-steel-gray/50 text-sm">No pillar data yet — sync assessments first.</p>
            </div>
          ) : (
            <>
              <Card span2>
                <CardTitle title="Average Score by Pillar" />
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={pillarData} barSize={40} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={C.tick} tickLine={false} axisLine={false} />
                    <YAxis dataKey="pillar" type="category" tick={{ ...C.tick, fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
                    <Tooltip contentStyle={C.tooltip} labelStyle={C.label} cursor={{ fill: 'rgb(var(--c-overlay) / calc(0.025 * var(--c-ovl-mult)))' }} />
                    <Bar dataKey="average" name="Avg Score" radius={[0, 2, 2, 0]}>
                      {pillarData.map((_: any, i: number) => (
                        <Cell key={i} fill={PILLAR_COLORS[i % PILLAR_COLORS.length]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card>
                  <CardTitle title="Pillar Radar" />
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={pillarData.map((p: any) => ({ ...p, pillar: p.pillar.replace('Physical ', '').replace(' Skills', '') }))}>
                      <PolarGrid stroke="rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))" />
                      <PolarAngleAxis dataKey="pillar" tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 10 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 8 }} />
                      <Radar name="Avg" dataKey="average" stroke="#E11919" fill="#E11919" fillOpacity={0.18} />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>

                <Card>
                  <CardTitle title="Pillar Detail" />
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }}>
                        {['Pillar','Avg','High','Low'].map(h => (
                          <th key={h} className={h === 'Pillar' ? 'text-left' : 'text-right'}
                            style={{ padding: '6px 8px 6px 0', color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pillarData.map((p: any, i: number) => (
                        <tr key={p.pillar} style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))' }}>
                          <td style={{ padding: '8px 8px 8px 0' }}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: PILLAR_COLORS[i % PILLAR_COLORS.length] }} />
                              <span className="text-off-white text-xs">{p.pillar.replace('Physical ', '').replace(' Skills', '')}</span>
                            </div>
                          </td>
                          <td className="text-right font-display text-off-white text-sm" style={{ padding: '8px 8px 8px 0' }}>{p.average}%</td>
                          <td className="text-right text-xs" style={{ padding: '8px 8px 8px 0', color: '#34d399' }}>{p.highest}%</td>
                          <td className="text-right text-xs text-blood-red" style={{ padding: '8px 0' }}>{p.lowest}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* TOP PERFORMERS                                        */}
      {/* ══════════════════════════════════════════════════════ */}
      {tab === 'performers' && (
        <div className="space-y-6">
          {loadingTop ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-overlay/5 animate-pulse" />)}</div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              <Card>
                <CardTitle title="Most Improved" />
                {((topPerformers as any)?.by_improvement ?? []).length === 0 ? (
                  <p className="text-steel-gray/50 text-sm py-4">No data yet.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }}>
                        {['#','Student','Score','+Δ'].map(h => (
                          <th key={h} className={h === '#' || h === 'Student' ? 'text-left' : 'text-right'}
                            style={{ padding: '6px 8px 6px 0', color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {((topPerformers as any)?.by_improvement ?? []).map((p: any, i: number) => (
                        <tr key={p.student_id} style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))' }}>
                          <td style={{ padding: '10px 8px 10px 0', color: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', fontSize: '0.65rem', fontFamily: 'var(--font-display)' }}>{i + 1}</td>
                          <td style={{ padding: '10px 8px 10px 0' }}>
                            <p className="text-off-white text-xs">{p.student_name}</p>
                            <Badge variant={p.sport}>{p.sport}</Badge>
                          </td>
                          <td className="text-right font-display text-off-white text-sm" style={{ padding: '10px 8px 10px 0' }}>{p.current_score}%</td>
                          <td className="text-right font-display text-base" style={{ padding: '10px 0', color: '#34d399' }}>
                            {p.improvement != null ? `+${p.improvement}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>

              <Card>
                <CardTitle title="Highest Scores" />
                {((topPerformers as any)?.by_score ?? []).length === 0 ? (
                  <p className="text-steel-gray/50 text-sm py-4">No data yet.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }}>
                        {['#','Student','Level','Score'].map(h => (
                          <th key={h} className={h === '#' || h === 'Student' || h === 'Level' ? 'text-left' : 'text-right'}
                            style={{ padding: '6px 8px 6px 0', color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {((topPerformers as any)?.by_score ?? []).map((p: any, i: number) => (
                        <tr key={p.student_id} style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))' }}>
                          <td style={{ padding: '10px 8px 10px 0', color: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', fontSize: '0.65rem', fontFamily: 'var(--font-display)' }}>{i + 1}</td>
                          <td style={{ padding: '10px 8px 10px 0' }}>
                            <p className="text-off-white text-xs">{p.student_name}</p>
                            <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.55rem', letterSpacing: '0.18em' }}>{p.student_id}</p>
                          </td>
                          <td style={{ padding: '10px 8px 10px 0' }}>
                            <Badge variant={p.level}>{p.level}</Badge>
                          </td>
                          <td className="text-right font-display text-blood-red text-base" style={{ padding: '10px 0' }}>{p.current_score}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
