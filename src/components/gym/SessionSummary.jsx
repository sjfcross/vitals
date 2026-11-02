import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { durationMin, fmtDuration, fmtKg, groupBy, sessionPRs, sessionVolume, prLabel, e1rm } from '../../lib/gymLogic'
import { unknownExercise } from '../../lib/gymLibrary'
import { useNow } from '../../lib/gymHooks'
import { ExerciseThumb } from './ExerciseMedia'
import { HrSummary } from './HrSummary'
import { Badge, ConfirmRow, FullScreen, StatTile } from './GymUi'
import { C, iconBtn, label } from './gymStyles'

export function SessionSummary({ session, gym, onClose, onDelete, onOpenExercise, justFinished = false, hrStatus: initialHrStatus = null }) {
  const { sets, sessionsById, index, actions, settings } = gym
  const nowMs = useNow(30000)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [hrStatus, setHrStatus] = useState(initialHrStatus)

  const mine = useMemo(() => sets.filter(s => s.session_id === session.id).sort((a, b) => a.created_at.localeCompare(b.created_at)), [sets, session.id])
  const prs = useMemo(() => sessionPRs(session, sets, sessionsById), [session, sets, sessionsById])
  const byEx = useMemo(() => [...groupBy(mine, s => s.exercise_id).entries()], [mine])
  const exOf = id => index.byId.get(id) || unknownExercise(id)

  async function refreshHr() {
    setRefreshing(true)
    const res = await actions.computeSessionHr(session, settings.hr_max)
    setHrStatus(res.status)
    setRefreshing(false)
  }

  const header = (
    <>
      <button type="button" onClick={onClose} style={{ ...iconBtn, border: 'none' }} aria-label="Close">✕</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.routine_name || 'Session'}</div>
        <div style={{ fontSize: '0.68rem', color: C.subtle }}>{dayjs(session.started_at).format('ddd, MMM D · HH:mm')}</div>
      </div>
    </>
  )

  return (
    <FullScreen header={header} z={35}>
      <div style={{ padding: '16px 16px 60px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {justFinished && (
          <div className="fade-up" style={{ textAlign: 'center', padding: '6px 0 2px' }}>
            <div style={{ fontSize: '1.6rem' }}>{prs.length ? '🏆' : '✓'}</div>
            <div style={{ fontSize: '0.95rem', color: C.text, fontWeight: 600, marginTop: 4 }}>{prs.length ? `${prs.length} new record${prs.length > 1 ? 's' : ''}!` : 'Session saved'}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <StatTile label="DURATION" value={fmtDuration(durationMin(session, nowMs))} />
          <StatTile label="SETS" value={mine.length} sub={`${byEx.length} exercises`} />
          <StatTile label="VOLUME" value={sessionVolume(mine).toLocaleString()} unit="kg" />
        </div>

        {prs.length > 0 && (
          <div className="card" style={{ padding: '12px 14px', borderColor: 'rgba(240,201,106,0.25)' }}>
            <div style={{ ...label, color: C.pr, marginBottom: 8 }}>PERSONAL RECORDS</div>
            {prs.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderTop: i ? `1px solid ${C.divider}` : 'none' }}>
                <span style={{ fontSize: '0.8rem', color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exOf(p.exerciseId).name}</span>
                <span className="mono" style={{ fontSize: '0.76rem', color: C.pr, whiteSpace: 'nowrap' }}>
                  {prLabel(p)} <span style={{ color: C.subtle }}>(was {p.type === 'reps' ? p.prev : fmtKg(p.prev)})</span>
                </span>
              </div>
            ))}
          </div>
        )}

        <HrSummary session={session} nowMs={nowMs} onRefresh={refreshHr} refreshing={refreshing} status={hrStatus} />

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ ...label, marginBottom: 6 }}>EXERCISES</div>
          {byEx.length === 0 && <div style={{ fontSize: '0.78rem', color: C.subtle, padding: '6px 0' }}>No sets logged.</div>}
          {byEx.map(([exId, exSets], i) => {
            const ex = exOf(exId)
            const swappedFrom = exSets.find(s => s.swapped_from_exercise_id)?.swapped_from_exercise_id
            const best = Math.max(0, ...exSets.map(s => e1rm(s.weight_kg, s.reps) ?? 0))
            return (
              <button key={exId} type="button" onClick={() => onOpenExercise?.(ex)}
                style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'flex-start', padding: '10px 0', background: 'none', border: 'none', borderTop: i ? `1px solid ${C.divider}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
                <ExerciseThumb exercise={ex} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.84rem', color: C.text }}>{ex.name}</span>
                    {exSets.some(s => s.is_adhoc) && <Badge color={C.muted} bg="rgba(255,255,255,0.06)">EXTRA</Badge>}
                    {swappedFrom && <Badge color={C.warn} bg="rgba(240,201,106,0.12)">SWAP</Badge>}
                  </div>
                  {swappedFrom && <div style={{ fontSize: '0.66rem', color: C.subtle, marginTop: 2 }}>instead of {exOf(swappedFrom).name}</div>}
                  <div className="mono" style={{ fontSize: '0.74rem', color: C.muted, marginTop: 4 }}>
                    {exSets.sort((a, b) => a.set_number - b.set_number).map(s => `${fmtKg(s.weight_kg)}×${s.reps}`).join(' · ')}
                  </div>
                </div>
                {best > 0 && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: '0.8rem', color: C.accent }}>{fmtKg(best)}</div>
                    <div style={{ fontSize: '0.58rem', color: C.subtle }}>e1RM</div>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {justFinished && <button className="btn-primary" onClick={onClose}>Done</button>}

        {onDelete && (
          confirmDelete
            ? <ConfirmRow text="Delete this session and its sets?" onConfirm={() => onDelete(session)} onCancel={() => setConfirmDelete(false)} />
            : <button type="button" className="btn-ghost" style={{ color: C.danger }} onClick={() => setConfirmDelete(true)}>Delete session</button>
        )}
      </div>
    </FullScreen>
  )
}
