import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  pickTodaysRoutine, exerciseHistory, progressionHint, fmtKg, localDate, sessionVolume, sessionPRs, prLabel,
  durationMin, fmtDuration, WEEKDAYS, rotationLetter,
} from '../lib/gymLogic'
import { unknownExercise } from '../lib/gymLibrary'
import { useNow, useRecovery } from '../lib/gymHooks'
import { ExerciseThumb } from '../components/gym/ExerciseMedia'
import { Chip, Empty, SectionLabel, StatTile } from '../components/gym/GymUi'
import { C, label } from '../components/gym/gymStyles'

export function GymToday({ gym, today, onStart, onResume, onOpenSession, onOpenExercise, onGoRoutines, onGoLibrary }) {
  const { routines, sessions, sets, sessionsById, index, activeSession } = gym
  const pick = useMemo(() => pickTodaysRoutine(routines, sessions, today), [routines, sessions, today])
  const [chosenId, setChosenId] = useState(null)
  const [starting, setStarting] = useState(false)
  const routine = routines.find(r => r.id === chosenId) || pick.routine
  const recovery = useRecovery()
  const exOf = id => index.byId.get(id) || unknownExercise(id)

  const finished = useMemo(() => sessions.filter(s => s.ended_at), [sessions])
  const weekStart = dayjs(today).subtract(6, 'day').format('YYYY-MM-DD')
  const prevStart = dayjs(today).subtract(13, 'day').format('YYYY-MM-DD')
  const load = useMemo(() => {
    const inRange = (s, a, b) => { const d = localDate(s.started_at); return d >= a && d <= b }
    const prevEnd = dayjs(weekStart).subtract(1, 'day').format('YYYY-MM-DD')
    const vol = list => list.reduce((acc, s) => acc + sessionVolume(sets.filter(x => x.session_id === s.id)), 0)
    const week = finished.filter(s => inRange(s, weekStart, today))
    const prev = finished.filter(s => inRange(s, prevStart, prevEnd))
    return { sessions: week.length, volume: vol(week), prevVolume: vol(prev) }
  }, [finished, sets, today, weekStart, prevStart])

  const recentPrs = useMemo(() => {
    const cutoff = dayjs(today).subtract(30, 'day').format('YYYY-MM-DD')
    return finished
      .filter(s => localDate(s.started_at) >= cutoff)
      .flatMap(s => sessionPRs(s, sets, sessionsById).filter(p => p.type !== 'weight').map(p => ({ ...p, session: s })))
      .slice(0, 5)
  }, [finished, sets, sessionsById, today])

  const lastRec = [...recovery].reverse().find(r => r.hrv_rmssd != null || r.resting_hr_bpm != null)
  const avg = key => {
    const v = recovery.slice(-7).map(r => r[key]).filter(x => x != null).map(Number)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  const hrvAvg = avg('hrv_rmssd'), rhrAvg = avg('resting_hr_bpm')

  async function start(r) {
    setStarting(true)
    await onStart(r)
    setStarting(false)
  }

  const scheduleText = r => {
    if (!r) return ''
    if (r.schedule_type === 'weekdays') return WEEKDAYS.filter(d => (r.weekdays || []).includes(d.iso)).map(d => d.short).join(' ')
    const rot = routines.filter(x => x.schedule_type === 'rotation').sort((a, b) => a.rotation_order - b.rotation_order)
    return `Rotation ${rotationLetter(Math.max(0, rot.findIndex(x => x.id === r.id)))}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {activeSession ? (
        <ActiveCard session={activeSession} count={sets.filter(s => s.session_id === activeSession.id).length} onResume={onResume} />
      ) : routine ? (
        <div className="card-lg fade-up stagger-1" style={{ padding: 16 }}>
          {pick.doneToday && !chosenId && (
            <div style={{ fontSize: '0.74rem', color: C.good, marginBottom: 10 }}>✓ {pick.doneToday.name} done today — nice. Next up:</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={label}>
                {routine.id === pick.routine?.id ? (pick.doneToday ? 'NEXT' : 'TODAY') : 'CHOSEN'} · {scheduleText(routine).toUpperCase()}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: C.text, marginTop: 6 }}>{routine.name}</div>
            </div>
            <span className="mono" style={{ fontSize: '0.7rem', color: C.subtle, marginTop: 2 }}>{routine.exercises.length} ex.</span>
          </div>

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
            {routine.exercises.map((re, i) => {
              const ex = exOf(re.exercise_id)
              const hist = exerciseHistory(re.exercise_id, sets, sessionsById)
              const hint = progressionHint(re, hist)
              const top = hist[0] ? hist[0].reduce((a, b) => (Number(b.weight_kg) > Number(a.weight_kg) ? b : a)) : null
              return (
                <button key={re.id} type="button" onClick={() => onOpenExercise(ex)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', background: 'none', border: 'none', borderTop: i ? `1px solid ${C.divider}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <ExerciseThumb exercise={ex} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
                    <div style={{ fontSize: '0.64rem', color: C.subtle }}>{re.target_sets} × {re.rep_min === re.rep_max ? re.rep_min : `${re.rep_min}–${re.rep_max}`}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: '0.76rem', color: C.muted }}>{top ? `${fmtKg(top.weight_kg)}×${top.reps}` : re.start_weight_kg != null ? `${fmtKg(re.start_weight_kg)} kg` : '—'}</div>
                    {hint.kind === 'increase' && <div className="mono" style={{ fontSize: '0.62rem', color: C.good }}>↑ {fmtKg(hint.weight)} kg</div>}
                    {hint.kind === 'deload' && <div className="mono" style={{ fontSize: '0.62rem', color: C.danger }}>↓ {fmtKg(hint.weight)} kg</div>}
                  </div>
                </button>
              )
            })}
          </div>

          <button className="btn-primary" style={{ marginTop: 14 }} disabled={starting} onClick={() => start(routine)}>
            {starting ? 'Starting…' : `Start ${routine.name}`}
          </button>
          {routines.length > 1 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
              <span style={{ fontSize: '0.66rem', color: C.subtle, marginRight: 2 }}>Other:</span>
              {routines.filter(r => r.id !== routine.id).map(r => <Chip key={r.id} onClick={() => setChosenId(r.id)}>{r.name}</Chip>)}
            </div>
          )}
          <button type="button" onClick={() => start(null)} disabled={starting}
            style={{ marginTop: 10, background: 'none', border: 'none', color: C.muted, fontSize: '0.74rem', cursor: 'pointer', padding: 0 }}>
            or start a free session (extras only) →
          </button>
        </div>
      ) : (
        <div className="card-lg fade-up stagger-1" style={{ padding: 18 }}>
          <div style={label}>NO ROUTINE YET</div>
          <div style={{ fontSize: '0.86rem', color: C.muted, lineHeight: 1.55, marginTop: 8 }}>
            Photograph the machines at your gym, work out a plan with Claude, then enter it as a routine.
            Until then, browse the {index.all.length}-exercise library or log a free session.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn-primary" style={{ flex: 1, padding: '12px' }} onClick={onGoRoutines}>Create routine</button>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={onGoLibrary}>Library</button>
          </div>
          <button type="button" onClick={() => start(null)} disabled={starting}
            style={{ marginTop: 12, background: 'none', border: 'none', color: C.accent, fontSize: '0.76rem', cursor: 'pointer', padding: 0 }}>
            Start a free session →
          </button>
        </div>
      )}

      {/* Load + recovery */}
      <div className="fade-up stagger-2" style={{ display: 'flex', gap: 8 }}>
        <StatTile label="LAST 7 DAYS" value={load.sessions} unit={load.sessions === 1 ? 'session' : 'sessions'}
          sub={load.volume ? `${(load.volume / 1000).toFixed(1)} t${load.prevVolume ? ` · ${load.volume >= load.prevVolume ? '+' : ''}${Math.round((load.volume / load.prevVolume - 1) * 100)}%` : ''}` : 'no volume yet'} />
        <StatTile label="HRV" value={lastRec?.hrv_rmssd != null ? Math.round(lastRec.hrv_rmssd) : '–'} unit="ms" color="#b47fdb"
          sub={hrvAvg != null ? `7d avg ${Math.round(hrvAvg)}` : 'no data'} />
        <StatTile label="RESTING HR" value={lastRec?.resting_hr_bpm ?? '–'} unit="bpm" color={C.hr}
          sub={rhrAvg != null ? `7d avg ${Math.round(rhrAvg)}` : 'no data'} />
      </div>

      {recentPrs.length > 0 && (
        <div className="card fade-up stagger-3" style={{ padding: '12px 14px' }}>
          <SectionLabel>RECENT RECORDS · 30 DAYS</SectionLabel>
          {recentPrs.map((p, i) => (
            <button key={i} type="button" onClick={() => onOpenExercise(exOf(p.exerciseId))}
              style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, padding: '7px 0', background: 'none', border: 'none', borderTop: i ? `1px solid ${C.divider}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: '0.8rem', color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏆 {exOf(p.exerciseId).name}</span>
              <span className="mono" style={{ fontSize: '0.72rem', color: C.pr, whiteSpace: 'nowrap' }}>{prLabel(p)} <span style={{ color: C.subtle }}>{dayjs(p.session.started_at).format('MMM D')}</span></span>
            </button>
          ))}
        </div>
      )}

      {finished[0] && (
        <div className="card fade-up stagger-4" style={{ padding: '12px 14px' }}>
          <SectionLabel>LAST SESSION</SectionLabel>
          <button type="button" onClick={() => onOpenSession(finished[0].id)}
            style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            <div>
              <div style={{ fontSize: '0.86rem', color: C.text }}>{finished[0].routine_name}</div>
              <div style={{ fontSize: '0.68rem', color: C.subtle, marginTop: 2 }}>
                {dayjs(finished[0].started_at).format('ddd, MMM D · HH:mm')} · {fmtDuration(durationMin(finished[0], 0))}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {finished[0].hr_avg != null && <div className="mono" style={{ fontSize: '0.78rem', color: C.hr }}>♥ {finished[0].hr_avg}</div>}
              <div style={{ fontSize: '0.66rem', color: C.subtle }}>details →</div>
            </div>
          </button>
        </div>
      )}

      {!finished.length && !activeSession && routines.length > 0 && (
        <Empty>No sessions yet — your history, records and charts appear here.</Empty>
      )}
    </div>
  )
}

function ActiveCard({ session, count, onResume }) {
  const now = useNow(15000)
  return (
    <div className="card-lg fade-up" style={{ padding: 16, borderColor: 'rgba(94,207,207,0.35)' }}>
      <div style={{ ...label, color: C.accent }}>● SESSION IN PROGRESS</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 600, color: C.text, marginTop: 6 }}>{session.routine_name}</div>
      <div className="mono" style={{ fontSize: '0.72rem', color: C.subtle, marginTop: 4 }}>
        started {dayjs(session.started_at).format('HH:mm')} · {fmtDuration(durationMin(session, now))} · {count} sets
      </div>
      <button className="btn-primary" style={{ marginTop: 14 }} onClick={onResume}>Resume</button>
    </div>
  )
}
