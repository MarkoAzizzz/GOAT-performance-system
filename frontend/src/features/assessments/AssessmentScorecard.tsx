import { Fragment, useMemo } from 'react'

const cell: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))',
  verticalAlign: 'middle',
}

function deltaColor(v: number): string {
  return v > 0 ? '#34d399' : v < 0 ? '#E11919' : 'rgb(var(--c-text-secondary))'
}

function fmtDelta(v: number, decimals = 1): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(decimals)}`
}

/**
 * Read-only "how the coach scored it" view for one assessment -- every
 * pillar and criterion, grouped and ordered exactly as entered. Derived
 * entirely from AssessmentDetailSerializer's own criterion_scores/
 * pillar_scores fields (pillar_name/order, criterion_order), so it needs
 * no separate template fetch and works identically for admins and
 * students (the API already scopes students to their own sessions).
 *
 * Branches on session.net_delta: points-based assessments (submitted after
 * the switch to +/- point deltas) show each pillar's delta + running
 * standing and each criterion's delta; older assessments render their
 * original absolute 0-10 scores unchanged.
 */
export function AssessmentScorecard({ session }: { session: any }) {
  const pillarGroups = useMemo(() => {
    const map = new Map<string, {
      pillar_name: string; pillar_order: number
      pillarScore: number | null; delta: number | null; standingAfter: number | null
      criteria: any[]
    }>()
    for (const cs of session?.criterion_scores ?? []) {
      if (!map.has(cs.pillar_name)) {
        const ps = (session?.pillar_scores ?? []).find((p: any) => p.pillar_name === cs.pillar_name)
        map.set(cs.pillar_name, {
          pillar_name: cs.pillar_name,
          pillar_order: cs.pillar_order,
          pillarScore: ps?.score ?? null,
          delta: ps?.delta ?? null,
          standingAfter: ps?.standing_after ?? null,
          criteria: [],
        })
      }
      map.get(cs.pillar_name)!.criteria.push(cs)
    }
    for (const g of map.values()) g.criteria.sort((a, b) => a.criterion_order - b.criterion_order)
    return Array.from(map.values()).sort((a, b) => a.pillar_order - b.pillar_order)
  }, [session])

  if (!session) return null

  const isPoints = session.net_delta != null
  const net = isPoints ? Number(session.net_delta) : null

  const ratingChange = session.rating_before != null && session.rating_after != null
    ? Number(session.rating_after) - Number(session.rating_before)
    : null

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="flex flex-wrap items-center gap-8 px-6 py-5 relative overflow-hidden"
        style={{ background: 'rgba(225,25,25,0.05)', border: '1px solid rgba(225,25,25,0.18)', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))' }}>
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'linear-gradient(to bottom,#E11919,transparent)' }} />
        <div>
          <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.48rem', letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 4 }}>Rating</p>
          <p className="font-display text-blood-red" style={{ fontSize: '2.6rem', lineHeight: 1 }}>
            {session.rating_after != null ? Number(session.rating_after).toFixed(0) : '—'}
          </p>
        </div>
        {ratingChange != null && (
          <div>
            <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.48rem', letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 6 }}>Change</p>
            <span className="font-display text-sm" style={{ color: ratingChange >= 0 ? '#34d399' : '#E11919' }}>
              {ratingChange >= 0 ? '+' : ''}{ratingChange.toFixed(0)}
            </span>
          </div>
        )}
        {net != null && (
          <div>
            <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.48rem', letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 4 }}>Net Points This Session</p>
            <p className="font-display text-2xl" style={{ color: deltaColor(net) }}>{fmtDelta(net)}</p>
          </div>
        )}
      </div>

      {/* Full scorecard */}
      <div className="relative overflow-hidden"
        style={{ background: 'rgb(var(--c-bg-surface))', border: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,#E11919,transparent)' }} />
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))' }}>
                {['Criterion', isPoints ? 'Δ Points' : 'Score /10', 'Coach Comment'].map(h => (
                  <th key={h} style={{ ...cell, color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.22em', textTransform: 'uppercase', textAlign: (h === 'Score /10' || h === 'Δ Points') ? 'center' : 'left', fontWeight: 400 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pillarGroups.map(group => (
                <Fragment key={group.pillar_name}>
                  <tr style={{ background: 'rgba(225,25,25,0.055)' }}>
                    <td colSpan={2} style={{ ...cell, paddingLeft: 16 }}>
                      <span className="font-display text-off-white" style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{group.pillar_name}</span>
                    </td>
                    <td style={{ ...cell, textAlign: 'center' }}>
                      {isPoints ? (
                        group.delta != null ? (
                          <div>
                            <span className="font-display" style={{ color: deltaColor(Number(group.delta)), fontSize: 14 }}>{fmtDelta(Number(group.delta))}</span>
                            {group.standingAfter != null && (
                              <div style={{ color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', fontSize: '0.55rem', marginTop: 1 }}>
                                standing: {Number(group.standingAfter).toFixed(1)}
                              </div>
                            )}
                          </div>
                        ) : <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', fontSize: 11 }}>—</span>
                      ) : (
                        group.pillarScore != null
                          ? <span className="font-display" style={{ color: '#E11919', fontSize: 14 }}>{Number(group.pillarScore).toFixed(2)}</span>
                          : <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                  {group.criteria.map((c: any) => (
                    <tr key={c.id}>
                      <td style={{ ...cell, color: 'rgb(var(--c-text-primary) / 0.82)', fontSize: 13 }}>{c.criterion_name}</td>
                      <td style={{ ...cell, textAlign: 'center' }}>
                        {isPoints ? (
                          c.delta != null
                            ? <span className="font-display" style={{ color: deltaColor(Number(c.delta)), fontSize: 15 }}>{fmtDelta(Number(c.delta))}</span>
                            : <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.15 * var(--c-sec-mult)))' }}>—</span>
                        ) : (
                          c.effective_score != null
                            ? <span className="font-display" style={{ color: '#E11919', fontSize: 15 }}>{Number(c.effective_score).toFixed(1)}</span>
                            : <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.15 * var(--c-sec-mult)))' }}>—</span>
                        )}
                      </td>
                      <td style={{ ...cell, color: 'rgb(var(--c-text-secondary) / calc(0.55 * var(--c-sec-mult)))', fontSize: 12 }}>
                        {c.coach_comment || <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes + Plan */}
      {(session.coach_notes || session.action_plan) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {session.coach_notes && (
            <div className="p-4" style={{ background: 'rgb(var(--c-overlay) / calc(0.02 * var(--c-ovl-mult)))', border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }}>
              <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.5rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 8 }}>Coach Notes</p>
              <p className="text-off-white/80 text-sm leading-relaxed">{session.coach_notes}</p>
            </div>
          )}
          {session.action_plan && (
            <div className="p-4" style={{ background: 'rgba(225,25,25,0.03)', border: '1px solid rgba(225,25,25,0.1)' }}>
              <p style={{ color: 'rgba(225,25,25,0.45)', fontSize: '0.5rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 8 }}>Action Plan</p>
              <p className="text-off-white/75 text-sm leading-relaxed italic">{session.action_plan}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
