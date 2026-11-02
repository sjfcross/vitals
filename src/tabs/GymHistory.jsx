import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { durationMin, fmtDuration, fmtKg, groupBy, sessionPRs, sessionVolume, exerciseBest } from '../lib/gymLogic'
import { unknownExercise } from '../lib/gymLibrary'
import { ExerciseThumb } from '../components/gym/ExerciseMedia'
import { Empty, Segmented } from '../components/gym/GymUi'
import { C } from '../components/gym/gymStyles'

export function GymHistory({ gym, onOpenSession, onOpenExercise }) {
  const { sessions, sets, sessionsById, index } = gym
  const [mode, setMode] = useState('sessions')
  const exOf = id => index.byId.get(id) || unknownExercise(id)
  const finished = useMemo(() => sessions.filter(s => s.ended_at), [sessions])
  const setsBySession = useMemo(() => groupBy(sets, s => s.session_id), [sets])

  const exercises = useMemo(() => {
    const byEx = groupBy(sets.filter(s => sessionsById.get(s.session_id)?.ended_at), s => s.exercise_id)
    return [...byEx.entries()].map(([id, list]) => {
      const sessionIds = new Set(list.map(s => s.session_id))
      const lastAt = Math.max(...[...sessionIds].map(sid => new Date(sessionsById.get(sid).started_at).getTime()))
      return { id, best: exerciseBest(list), sessions: sessionIds.size, lastAt }
    }).sort((a, b) => b.lastAt - a.lastAt)
  }, [sets, sessionsById])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Segmented value={mode} onChange={setMode} options={[{ id: 'sessions', label: `Sessions (${finished.length})` }, { id: 'exercises', label: `Exercises (${exercises.length})` }]} />

      {mode === 'sessions' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {finished.length === 0 && <Empty>No finished sessions yet.</Empty>}
          {finished.map((s, i) => {
            const list = setsBySession.get(s.id) || []
            const prs = sessionPRs(s, sets, sessionsById).filter(p => p.type !== 'weight').length
            const showMonth = i === 0 || dayjs(finished[i - 1].started_at).format('YYYY-MM') !== dayjs(s.started_at).format('YYYY-MM')
            return (
              <div key={s.id}>
                {showMonth && (
                  <div style={{ padding: '10px 14px 4px', fontSize: '0.62rem', color: C.subtle, letterSpacing: '0.06em', borderTop: i ? `1px solid ${C.divider}` : 'none' }}>
                    {dayjs(s.started_at).format('MMMM YYYY').toUpperCase()}
                  </div>
                )}
                <button type="button" onClick={() => onOpenSession(s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderTop: showMonth ? 'none' : `1px solid ${C.divider}`, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: '1rem', color: C.text, lineHeight: 1 }}>{dayjs(s.started_at).format('D')}</div>
                    <div style={{ fontSize: '0.58rem', color: C.subtle, marginTop: 2 }}>{dayjs(s.started_at).format('ddd').toUpperCase()}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.86rem', color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.routine_name}{prs > 0 && <span style={{ marginLeft: 6, fontSize: '0.72rem' }}>🏆{prs > 1 ? `×${prs}` : ''}</span>}
                    </div>
                    <div className="mono" style={{ fontSize: '0.66rem', color: C.subtle, marginTop: 3 }}>
                      {fmtDuration(durationMin(s, 0))} · {list.length} sets · {sessionVolume(list).toLocaleString()} kg
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: '0.74rem', color: s.hr_avg != null ? C.hr : C.faint, flexShrink: 0 }}>
                    {s.hr_avg != null ? `♥ ${s.hr_avg}` : '♥ –'}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {mode === 'exercises' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {exercises.length === 0 && <Empty>Exercises you log show up here with their progress charts.</Empty>}
          {exercises.map((e, i) => {
            const ex = exOf(e.id)
            return (
              <button key={e.id} type="button" onClick={() => onOpenExercise(ex)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderTop: i ? `1px solid ${C.divider}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
                <ExerciseThumb exercise={ex} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.84rem', color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
                  <div style={{ fontSize: '0.66rem', color: C.subtle, marginTop: 2 }}>{e.sessions} session{e.sessions === 1 ? '' : 's'} · last {dayjs(e.lastAt).format('MMM D')}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: '0.84rem', color: C.accent }}>
                    {e.best.e1rm != null ? fmtKg(e.best.e1rm) : e.best.weight != null ? fmtKg(e.best.weight) : e.best.bwReps ?? '–'}
                  </div>
                  <div style={{ fontSize: '0.58rem', color: C.subtle }}>{e.best.e1rm != null ? 'e1RM kg' : e.best.weight != null ? 'top kg' : 'reps'}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
