import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { studentsService } from '../../services/students.service'
import { StatCard } from '../../components/ui/StatCard'
import { Badge } from '../../components/ui/Badge'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { useToast } from '../../components/ui/Toast'
import { ArrowLeft, UserX, Trash2, ClipboardList, Award, TrendingUp, Plus, ChevronRight } from 'lucide-react'

const C = {
  tooltip: { background: 'rgb(var(--c-bg-elevated))', border: '1px solid rgba(225,25,25,0.2)', borderRadius: 0, fontSize: 12 },
  label:   { color: 'rgb(var(--c-text-secondary))', fontSize: 11 },
  item:    { color: '#E11919' },
  tick:    { fill: 'rgb(var(--c-text-secondary))', fontSize: 10 },
  grid:    'rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))',
}

const LEVEL_COLOR: Record<string, string> = {
  advanced:     '#E11919',
  intermediate: '#fbbf24',
  beginner:     '#34d399',
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg,rgb(var(--c-bg-elevated)),rgb(var(--c-bg-input)))', border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)' }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,#E11919,rgba(225,25,25,0.2) 50%,transparent)' }} />
      <div className="absolute top-0 left-0 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom,#E11919,transparent 60%)' }} />
      <div className="p-6">{children}</div>
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-[3px] h-4 bg-blood-red" />
      <h3 className="font-display text-off-white text-xs uppercase tracking-[0.22em]">{title}</h3>
    </div>
  )
}

function DeleteConfirmModal({ name, onConfirm, onCancel, loading }: {
  name: string; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}>
      <div className="relative w-full max-w-md"
        style={{ background: 'linear-gradient(145deg,rgb(var(--c-accent-wash)),rgb(var(--c-bg-elevated)))', border: '1px solid rgba(225,25,25,0.3)', clipPath: 'polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,#E11919,rgba(225,25,25,0.2) 50%,transparent)' }} />
        <div className="absolute top-0 left-0 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom,#E11919,transparent 60%)' }} />
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 flex items-center justify-center shrink-0"
              style={{ background: 'rgba(225,25,25,0.12)', border: '1px solid rgba(225,25,25,0.3)' }}>
              <Trash2 size={18} className="text-blood-red" />
            </div>
            <div>
              <h3 className="font-display text-off-white text-lg tracking-wide">Delete Student</h3>
              <p className="text-steel-gray text-xs mt-1 leading-relaxed">
                This will permanently delete <span className="text-off-white font-medium">{name}</span> and all their data.
                This action <span className="text-blood-red">cannot be undone</span>.
              </p>
            </div>
          </div>
          <div className="p-3 text-xs" style={{ background: 'rgba(225,25,25,0.06)', border: '1px solid rgba(225,25,25,0.15)' }}>
            <p style={{ color: 'rgba(225,25,25,0.7)', letterSpacing: '0.06em' }}>
              ⚠ All assessment history, scores, and records will be permanently erased.
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} disabled={loading}
              className="flex-1 py-2.5 text-xs uppercase tracking-widest font-display transition-all"
              style={{ border: '1px solid rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))', color: 'rgb(var(--c-text-secondary) / calc(0.6 * var(--c-sec-mult)))', background: 'rgb(var(--c-overlay) / calc(0.02 * var(--c-ovl-mult)))' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgb(var(--c-overlay) / calc(0.2 * var(--c-ovl-mult)))'; (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-primary))' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))'; (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-secondary) / calc(0.6 * var(--c-sec-mult)))' }}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 py-2.5 text-xs uppercase tracking-widest font-display text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#E11919,#B90F16)', clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(225,25,25,0.45)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
              {loading ? 'Deleting…' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StudentDetailPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const { toast }  = useToast()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const { data: student, isLoading: loadingStudent } = useQuery({
    queryKey: ['student', id],
    queryFn:  () => studentsService.get(id!),
  })

  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ['student-progress', id],
    queryFn:  () => studentsService.getProgress(id!),
    enabled:  !!id,
  })

  const deactivateMutation = useMutation({
    mutationFn: () => studentsService.deactivate(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', id] })
      qc.invalidateQueries({ queryKey: ['students'] })
      toast('Student deactivated')
    },
    onError: () => toast('Failed to deactivate', 'error'),
  })

  const hardDeleteMutation = useMutation({
    mutationFn: () => studentsService.hardDelete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      toast('Student permanently deleted')
      navigate('/admin/students')
    },
    onError: () => toast('Failed to delete student', 'error'),
  })

  if (loadingStudent) return <LoadingSkeleton rows={8} />

  const s    = student as any
  const prog = progress as any

  // history is oldest→newest from API; reverse for display (newest first)
  const history: any[] = prog?.history ? [...prog.history].reverse() : []
  const latest = history[0]   // newest assessment

  // chart data: oldest→newest for the line chart
  const trendData = [...history].reverse().map((h: any) => ({
    date:  new Date(h.assessment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: Number(h.grade_percentage),
  }))

  // radar from latest_pillar_scores
  const radarData = (prog?.latest_pillar_scores ?? []).map((p: any) => ({
    pillar: (p.pillar__name ?? '').replace('Physical ', '').replace(' Skills', '').replace('Cardio, ', ''),
    score:  Number(p.score ?? 0) * 10,   // pillar score is /10 → convert to %
  }))

  const initial = (s?.full_name ?? s?.user?.full_name ?? '?')[0].toUpperCase()

  const levelKey = (latest?.level_at_assessment ?? s?.level ?? '').toLowerCase()
  const levelColor = LEVEL_COLOR[levelKey] ?? 'rgb(var(--c-text-secondary))'

  return (
    <div className="space-y-8">

      {/* ── Back + New assessment ──────────────────────────── */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/admin/students')}
          className="flex items-center gap-2 transition-colors duration-200"
          style={{ color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-primary))' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))' }}>
          <ArrowLeft size={12} /> All Students
        </button>

        <button
          onClick={() => navigate('/admin/assessments/entry', { state: { preselect: s } })}
          className="flex items-center gap-2 font-display text-white text-xs tracking-[0.2em] uppercase px-4 py-2 transition-all"
          style={{ background: 'linear-gradient(135deg,#E11919,#B90F16)', clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(225,25,25,0.35)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
          <Plus size={12} /> New Assessment
        </button>
      </div>

      {/* ── Hero card ─────────────────────────────────────── */}
      <div className="relative overflow-hidden"
        style={{ background: 'linear-gradient(105deg,rgb(var(--c-accent-wash)),rgb(var(--c-bg-elevated)),rgba(225,25,25,0.04))', border: '1px solid rgba(225,25,25,0.15)', clipPath: 'polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))' }}>
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'linear-gradient(to bottom,#E11919,rgba(225,25,25,0.2))' }} />
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,#E11919,rgba(225,25,25,0.3) 50%,transparent)' }} />

        <div className="p-6 flex flex-wrap items-start gap-6">
          {/* Avatar */}
          <div className="w-16 h-16 flex items-center justify-center font-display text-3xl shrink-0"
            style={{ background: 'linear-gradient(135deg,rgba(225,25,25,0.15),rgba(225,25,25,0.08))', border: '1px solid rgba(225,25,25,0.3)', clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))', color: '#E11919' }}>
            {initial}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h2 className="font-display text-off-white text-2xl">{s?.full_name ?? s?.user?.full_name}</h2>
              <span className="font-display text-blood-red text-sm">{s?.student_id}</span>
            </div>
            <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.72rem', marginBottom: 10 }}>{s?.email ?? s?.user?.email}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={s?.sport}>{s?.sport}</Badge>
              {latest && <Badge variant={latest.level_at_assessment as any}>{latest.level_at_assessment}</Badge>}
              <Badge variant={s?.is_active ? 'success' : 'error'}>{s?.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>
          </div>

          {/* Score highlights */}
          <div className="flex gap-8 shrink-0">
            <div className="text-right">
              <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 4 }}>Latest Score</p>
              <p className="font-display text-blood-red" style={{ fontSize: '2.4rem', lineHeight: 1 }}>
                {prog?.current_grade != null ? `${Number(prog.current_grade).toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="text-right">
              <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 4 }}>Improvement</p>
              <p className="font-display" style={{ fontSize: '2rem', lineHeight: 1, color: (prog?.improvement ?? 0) >= 0 ? '#34d399' : '#E11919' }}>
                {prog?.improvement != null ? `${prog.improvement > 0 ? '+' : ''}${prog.improvement}%` : '—'}
              </p>
            </div>
            {latest && (
              <div className="text-right">
                <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 4 }}>Level</p>
                <p className="font-display text-lg capitalize" style={{ color: levelColor }}>{latest.level_at_assessment}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="self-start flex flex-col gap-2 ml-auto">
            {s?.is_active && (
              <button
                onClick={() => { if (confirm('Deactivate this student?')) deactivateMutation.mutate() }}
                className="flex items-center gap-2 font-display text-xs tracking-[0.16em] uppercase px-4 py-2 transition-all duration-200"
                style={{ border: '1px solid rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', color: 'rgb(var(--c-text-secondary) / calc(0.7 * var(--c-sec-mult)))', background: 'rgb(var(--c-text-secondary) / calc(0.04 * var(--c-sec-mult)))', cursor: 'pointer', minWidth: 130 }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(225,25,25,0.5)'; el.style.color = '#E11919'; el.style.background = 'rgba(225,25,25,0.08)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))'; el.style.color = 'rgb(var(--c-text-secondary) / calc(0.7 * var(--c-sec-mult)))'; el.style.background = 'rgb(var(--c-text-secondary) / calc(0.04 * var(--c-sec-mult)))' }}>
                <UserX size={13} /> Deactivate
              </button>
            )}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 font-display text-xs tracking-[0.16em] uppercase px-4 py-2 transition-all duration-200"
              style={{ border: '1px solid rgba(225,25,25,0.35)', color: '#E11919', background: 'rgba(225,25,25,0.08)', cursor: 'pointer', minWidth: 130 }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(225,25,25,0.18)'; el.style.borderColor = 'rgba(225,25,25,0.7)'; el.style.boxShadow = '0 0 16px rgba(225,25,25,0.2)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(225,25,25,0.08)'; el.style.borderColor = 'rgba(225,25,25,0.35)'; el.style.boxShadow = 'none' }}>
              <Trash2 size={13} /> Delete Student
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Assessments" value={prog?.total_assessments ?? 0}                                            icon={ClipboardList} />
        <StatCard label="Best Score"         value={prog?.highest_score != null ? `${Number(prog.highest_score).toFixed(1)}%` : '—'} icon={Award}         accent />
        <StatCard label="Improvement"        value={prog?.improvement != null ? `${prog.improvement > 0 ? '+' : ''}${prog.improvement}%` : '—'} icon={TrendingUp} />
      </div>

      {/* ── Charts ────────────────────────────────────────── */}
      {trendData.length > 1 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <SectionTitle title="Score History" />
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="date" tick={C.tick} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={C.tick} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={C.tooltip} itemStyle={C.item} labelStyle={C.label}
                  cursor={{ stroke: 'rgba(225,25,25,0.2)', strokeWidth: 1 }} />
                <Line type="monotone" dataKey="score" stroke="#E11919" strokeWidth={2}
                  dot={{ fill: '#E11919', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#E11919', stroke: 'rgba(225,25,25,0.3)', strokeWidth: 4 }}
                  name="Score %" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {radarData.length > 0 && (
            <Card>
              <SectionTitle title="Latest Pillar Scores" />
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))" />
                  <PolarAngleAxis dataKey="pillar" tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 8 }} />
                  <Radar name="Score" dataKey="score" stroke="#E11919" fill="#E11919" fillOpacity={0.18} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* ── Assessment history ────────────────────────────── */}
      {loadingProgress ? (
        <LoadingSkeleton rows={4} />
      ) : history.length === 0 ? (
        <div className="relative overflow-hidden text-center py-14"
          style={{ background: 'linear-gradient(145deg,rgb(var(--c-bg-elevated)),rgb(var(--c-bg-input)))', border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,#E11919,rgba(225,25,25,0.2) 50%,transparent)' }} />
          <p className="text-steel-gray/40 text-sm mb-3">No assessments yet</p>
          <button
            onClick={() => navigate('/admin/assessments/entry', { state: { preselect: s } })}
            className="inline-flex items-center gap-2 font-display text-white text-xs tracking-[0.2em] uppercase px-5 py-2.5 transition-all"
            style={{ background: 'linear-gradient(135deg,#E11919,#B90F16)', clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)' }}>
            <Plus size={12} /> Add First Assessment
          </button>
        </div>
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-5">
            <SectionTitle title="Assessment History" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }}>
                  {['#', 'Date', 'Grade', 'Level', 'Coach Notes', 'Action Plan', ''].map(h => (
                    <th key={h} className="text-left"
                      style={{ padding: '6px 16px 10px 0', color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.22em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((sess: any, i: number) => (
                  <tr key={sess.id}
                    onClick={() => navigate('/admin/assessments/entry', { state: { preselect: s, viewDate: sess.assessment_date } })}
                    style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(225,25,25,0.04)'; (e.currentTarget as HTMLElement).style.outline = '1px solid rgba(225,25,25,0.12)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.outline = 'none' }}>
                    <td style={{ padding: '12px 16px 12px 0', color: 'rgb(var(--c-text-secondary) / calc(0.25 * var(--c-sec-mult)))', fontSize: 11, fontFamily: 'var(--font-display)' }}>
                      {history.length - i}
                    </td>
                    <td style={{ padding: '12px 16px 12px 0', whiteSpace: 'nowrap' }}>
                      <div>
                        <span style={{ color: 'rgb(var(--c-text-primary) / 0.75)', fontSize: '0.8rem' }}>
                          {new Date(sess.assessment_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {i === 0 && (
                          <span style={{ display: 'block', color: 'rgba(52,211,153,0.6)', fontSize: '0.5rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 2 }}>
                            Latest
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px 12px 0' }}>
                      <span className="font-display text-blood-red text-base">{Number(sess.grade_percentage).toFixed(1)}%</span>
                    </td>
                    <td style={{ padding: '12px 16px 12px 0' }}>
                      <Badge variant={sess.level_at_assessment as any}>{sess.level_at_assessment}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px 12px 0', color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.72rem', maxWidth: 200 }}>
                      {sess.coach_notes ? (
                        <span className="block truncate" title={sess.coach_notes}>{sess.coach_notes}</span>
                      ) : <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 0', color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.72rem', maxWidth: 200 }}>
                      {sess.action_plan ? (
                        <span className="block truncate italic" title={sess.action_plan}>{sess.action_plan}</span>
                      ) : <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 0 12px 12px', width: 28 }}>
                      <ChevronRight size={13} style={{ color: 'rgba(225,25,25,0.35)' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showDeleteModal && (
        <DeleteConfirmModal
          name={s?.full_name ?? s?.user?.full_name ?? 'this student'}
          loading={hardDeleteMutation.isPending}
          onConfirm={() => hardDeleteMutation.mutate()}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  )
}
