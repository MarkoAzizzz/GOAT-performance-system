import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { studentsService } from '../../services/students.service'
import { Badge } from '../../components/ui/Badge'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { ChevronDown, ChevronUp, ClipboardList } from 'lucide-react'

export function StudentHistoryPage() {
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: myStudent } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: studentsService.getMe,
  })

  const { data: progress, isLoading } = useQuery({
    queryKey: ['my-progress', myStudent?.id],
    queryFn: () => studentsService.getProgress(myStudent!.id),
    enabled: !!myStudent?.id,
  })

  // API returns `history` ordered oldest→newest; reverse so newest is first
  const sessions = [...((progress as any)?.history ?? [])].reverse()

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))', fontSize: '0.58rem', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 6 }}>
            Student Portal
          </p>
          <h1 className="font-display text-off-white" style={{ fontSize: '2.4rem', letterSpacing: '0.08em', lineHeight: 1 }}>
            Assessment <span className="text-blood-red">History</span>
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-[2px] w-10 bg-blood-red" />
            <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.38 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} on record
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <ClipboardList size={14} style={{ color: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))' }} />
          <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            All Time
          </span>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : sessions.length === 0 ? (
        <div className="relative overflow-hidden text-center py-16"
          style={{
            background: 'linear-gradient(145deg, rgb(var(--c-bg-elevated)), rgb(var(--c-bg-input)))',
            border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
            clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
          }}>
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.2) 50%, transparent)' }} />
          <p className="text-steel-gray/50 text-sm">No assessments on record yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s: any, idx: number) => {
            const isOpen = expanded === s.id
            const isLatest = idx === 0
            return (
              <div key={s.id}
                className="relative overflow-hidden transition-all duration-200"
                style={{
                  background: isOpen
                    ? 'linear-gradient(145deg, rgb(var(--c-accent-wash)) 0%, rgb(var(--c-bg-elevated)) 100%)'
                    : 'linear-gradient(145deg, rgb(var(--c-bg-elevated)) 0%, rgb(var(--c-bg-input)) 100%)',
                  border: isOpen
                    ? '1px solid rgba(225,25,25,0.2)'
                    : '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
                  clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
                }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{
                    background: isOpen
                      ? 'linear-gradient(to right, #E11919, rgba(225,25,25,0.2) 50%, transparent)'
                      : 'transparent',
                    transition: 'background 0.2s ease',
                  }} />

                <button
                  className="w-full flex items-center gap-4 text-left px-5 py-4"
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                >
                  <div className="shrink-0 w-7 h-7 flex items-center justify-center border font-display text-xs"
                    style={{
                      background: isLatest ? 'rgba(225,25,25,0.1)' : 'rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))',
                      borderColor: isLatest ? 'rgba(225,25,25,0.3)' : 'rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))',
                      color: isLatest ? '#E11919' : 'rgb(var(--c-text-secondary))',
                    }}>
                    {sessions.length - idx}
                  </div>

                  <div className="flex-1 flex flex-wrap items-center gap-3 min-w-0">
                    <span className="text-steel-gray text-xs">
                      {new Date(s.assessment_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <Badge variant={s.level_at_assessment as any}>{s.level_at_assessment}</Badge>
                    {isLatest && (
                      <span style={{
                        fontSize: '0.5rem', letterSpacing: '0.28em', textTransform: 'uppercase',
                        color: 'rgba(52,211,153,0.6)',
                        border: '1px solid rgba(52,211,153,0.2)',
                        padding: '2px 6px',
                      }}>Latest</span>
                    )}
                  </div>

                  <span className="text-blood-red font-display text-xl shrink-0">{s.grade_percentage}%</span>
                  <span className="text-steel-gray/40 shrink-0">
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 space-y-5">
                    <div className="h-px" style={{ background: 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }} />

                    {s.pillar_scores?.length > 0 && (
                      <div>
                        <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.56rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 12 }}>
                          Pillar Breakdown
                        </p>
                        <div className="space-y-3">
                          {s.pillar_scores.map((p: any) => (
                            <div key={p.id ?? p.pillar_name} className="flex items-center gap-3">
                              <span className="text-steel-gray/60 text-xs w-28 shrink-0">
                                {p.pillar_name?.replace('Physical ', '').replace(' Skills', '')}
                              </span>
                              <div className="flex-1 h-1 bg-overlay/[0.06] overflow-hidden">
                                <div
                                  className="h-full transition-all duration-700"
                                  style={{
                                    width: `${p.score ?? 0}%`,
                                    background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.6))',
                                  }}
                                />
                              </div>
                              <span className="text-off-white text-xs w-10 text-right font-display">{p.score}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {s.coach_notes && (
                        <div className="p-4" style={{
                          background: 'rgb(var(--c-overlay) / calc(0.02 * var(--c-ovl-mult)))',
                          border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
                        }}>
                          <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.56rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 8 }}>
                            Coach Notes
                          </p>
                          <p className="text-off-white text-sm leading-relaxed">{s.coach_notes}</p>
                        </div>
                      )}
                      {s.action_plan && (
                        <div className="p-4" style={{
                          background: 'rgba(225,25,25,0.03)',
                          border: '1px solid rgba(225,25,25,0.1)',
                        }}>
                          <p style={{ color: 'rgba(225,25,25,0.45)', fontSize: '0.56rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 8 }}>
                            Action Plan
                          </p>
                          <p className="text-off-white/80 text-sm leading-relaxed italic">{s.action_plan}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
