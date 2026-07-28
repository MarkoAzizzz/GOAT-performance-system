import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { studentsService } from '../../services/students.service'
import { leaderboardService } from '../../services/analytics.service'
import { Badge } from '../../components/ui/Badge'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { Trophy } from 'lucide-react'

const MEDAL = [
  { icon: '#fbbf24', border: 'rgba(251,191,36,0.3)', bg: 'rgba(251,191,36,0.08)', text: '#fbbf24' },
  { icon: 'rgb(var(--c-text-secondary))', border: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', bg: 'rgb(var(--c-text-secondary) / calc(0.06 * var(--c-sec-mult)))', text: 'rgb(var(--c-text-secondary))' },
  { icon: '#cd7c2f', border: 'rgba(205,124,47,0.3)',  bg: 'rgba(205,124,47,0.06)',  text: '#cd7c2f' },
]

export function StudentLeaderboardPage() {
  const { user } = useAuth()

  const { data: myStudent } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: studentsService.getMe,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => leaderboardService.get({}),
  })

  const entries = (data as any[]) ?? []
  const myRank = entries.findIndex((e: any) => e.student_id === myStudent?.student_id) + 1
  const myEntry = myRank > 0 ? entries[myRank - 1] : null

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))', fontSize: '0.58rem', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 6 }}>
            Student Portal
          </p>
          <h1 className="font-display text-off-white" style={{ fontSize: '2.4rem', letterSpacing: '0.08em', lineHeight: 1 }}>
            Leader<span className="text-blood-red">board</span>
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-[2px] w-10 bg-blood-red" />
            <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.38 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              Ranked by biggest improvement
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Trophy size={14} style={{ color: 'rgba(251,191,36,0.4)' }} />
          <span style={{ color: 'rgba(251,191,36,0.4)', fontSize: '0.58rem', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            {entries.length} Athletes
          </span>
        </div>
      </div>

      {/* My rank banner */}
      {myRank > 0 && myEntry && (
        <div className="relative overflow-hidden"
          style={{
            background: myRank <= 3
              ? 'linear-gradient(105deg, rgb(var(--c-bg-surface)) 0%, rgb(var(--c-amber-wash)) 60%, rgba(251,191,36,0.04) 100%)'
              : 'linear-gradient(105deg, rgb(var(--c-bg-surface)) 0%, rgb(var(--c-accent-wash)) 60%, rgba(225,25,25,0.04) 100%)',
            border: myRank <= 3 ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(225,25,25,0.18)',
            clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
          }}>
          <div className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: myRank <= 3
              ? 'linear-gradient(to bottom, #fbbf24, rgba(251,191,36,0.2))'
              : 'linear-gradient(to bottom, #E11919, rgba(225,25,25,0.2))' }} />
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: myRank <= 3
              ? 'linear-gradient(to right, #fbbf24, rgba(251,191,36,0.3) 50%, transparent)'
              : 'linear-gradient(to right, #E11919, rgba(225,25,25,0.3) 50%, transparent)' }} />

          <div className="pl-6 pr-6 py-5 flex items-center gap-5">
            <div className="shrink-0 w-12 h-12 flex items-center justify-center font-display text-xl"
              style={{
                background: myRank <= 3
                  ? 'linear-gradient(135deg, #fbbf24, #d97706)'
                  : 'linear-gradient(135deg, #E11919, #B90F16)',
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                color: myRank <= 3 ? '#000' : '#fff',
              }}>
              {myRank <= 3 ? <Trophy size={18} /> : `#${myRank}`}
            </div>

            <div className="flex-1 min-w-0">
              <p style={{ color: myRank <= 3 ? 'rgba(251,191,36,0.5)' : 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.57rem', letterSpacing: '0.36em', textTransform: 'uppercase', marginBottom: 3 }}>
                Your Rank
              </p>
              <p className="font-display text-off-white" style={{ fontSize: '1.25rem', letterSpacing: '0.06em' }}>
                #{myRank} of {entries.length}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.57rem', letterSpacing: '0.36em', textTransform: 'uppercase', marginBottom: 3 }}>
                Improvement
              </p>
              <p className="font-display text-blood-red" style={{ fontSize: '2rem', lineHeight: 1 }}>
                {myEntry.improvement != null
                  ? `${myEntry.improvement > 0 ? '+' : ''}${myEntry.improvement}%`
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton rows={8} />
      ) : entries.length === 0 ? (
        <div className="relative overflow-hidden text-center py-16"
          style={{
            background: 'linear-gradient(145deg, rgb(var(--c-bg-elevated)), rgb(var(--c-bg-input)))',
            border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
          }}>
          <p className="text-steel-gray/50 text-sm">No rankings yet.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry: any, i: number) => {
            const rank = i + 1
            const isMe = entry.student_id === myStudent?.student_id
            const medal = rank <= 3 ? MEDAL[rank - 1] : null

            return (
              <div
                key={entry.student_id}
                className="relative overflow-hidden flex items-center gap-4 px-5 py-3.5 transition-all duration-200"
                style={{
                  background: isMe
                    ? 'linear-gradient(145deg, rgb(var(--c-accent-wash)) 0%, rgb(var(--c-bg-elevated)) 100%)'
                    : 'linear-gradient(145deg, rgb(var(--c-bg-elevated)) 0%, rgb(var(--c-bg-input)) 100%)',
                  border: isMe
                    ? '1px solid rgba(225,25,25,0.25)'
                    : medal
                      ? `1px solid ${medal.border}`
                      : '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))',
                }}>
                {isMe && (
                  <div className="absolute left-0 top-0 bottom-0 w-[2px]"
                    style={{ background: 'linear-gradient(to bottom, #E11919, rgba(225,25,25,0.1))' }} />
                )}

                <div className="w-8 shrink-0 text-center">
                  {medal
                    ? <Trophy size={15} style={{ color: medal.icon, margin: '0 auto' }} />
                    : <span className="font-display text-sm" style={{ color: 'rgb(var(--c-text-secondary) / calc(0.25 * var(--c-sec-mult)))' }}>{rank}</span>
                  }
                </div>

                <div className="w-8 h-8 flex items-center justify-center border font-display text-xs shrink-0"
                  style={isMe
                    ? { background: 'rgba(225,25,25,0.15)', border: '1px solid rgba(225,25,25,0.35)', color: '#E11919' }
                    : medal
                      ? { background: medal.bg, border: `1px solid ${medal.border}`, color: medal.text }
                      : { background: 'rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))', border: '1px solid rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))', color: 'rgb(var(--c-text-secondary))' }
                  }>
                  {entry.student_name?.[0] ?? '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: isMe ? '#E11919' : medal ? medal.text : 'rgb(var(--c-text-primary))' }}>
                    {entry.student_name}
                    {isMe && <span className="text-xs ml-2" style={{ color: 'rgba(225,25,25,0.5)' }}>(you)</span>}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))' }}>{entry.student_id}</p>
                </div>

                <div className="hidden sm:flex gap-2 shrink-0">
                  <Badge variant={entry.sport as any}>{entry.sport}</Badge>
                  <Badge variant={entry.level as any}>{entry.level}</Badge>
                </div>

                <div className="text-right shrink-0 min-w-14">
                  <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Score</p>
                  <p className="font-display text-off-white text-sm">{entry.current_score ?? '—'}%</p>
                </div>

                <div className="text-right shrink-0">
                  <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Δ</p>
                  <p className="font-display text-base" style={{ color: (entry.improvement ?? 0) >= 0 ? '#34d399' : '#E11919' }}>
                    {entry.improvement != null ? `${entry.improvement > 0 ? '+' : ''}${entry.improvement}%` : '—'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
