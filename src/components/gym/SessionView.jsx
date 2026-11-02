import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_TARGET, detectSetPRs, exerciseHistory, fmtKg, progressionHint, prLabel, durationMin, fmtDuration,
} from '../../lib/gymLogic'
import { findAlternatives, unknownExercise, titleCase } from '../../lib/gymLibrary'
import { useNow, readLocal, writeLocal } from '../../lib/gymHooks'
import { ExerciseThumb } from './ExerciseMedia'
import { ExerciseDetail } from './ExerciseDetail'
import { LibraryBrowser } from './LibraryBrowser'
import { Badge, Chip, ConfirmRow, Empty, FullScreen, Sheet, Stepper } from './GymUi'
import { C, iconBtn, label, smallBtn } from './gymStyles'

const slotsKey = id => `vitals-gym-slots-${id}`
// Clock reads for event handlers (kept out of the component body for the purity lint rule).
const restUntil = sec => Date.now() + sec * 1000
let extraSeq = 0
const extraKey = id => `x-${id}-${Date.now()}-${++extraSeq}`

// A "slot" is one line of today's plan: a routine exercise (possibly swapped) or an ad-hoc extra.
// Slots are rebuilt from the routine + the session's logged sets, so a reload mid-session loses
// nothing that was logged; un-logged swaps/extras are additionally kept in localStorage.
function buildSlots(session, routine, sessionSets) {
  const saved = readLocal(slotsKey(session.id), null)
  let slots = saved || (routine?.exercises || []).map(re => ({
    key: re.id, routineExerciseId: re.id, plannedId: re.exercise_id, exerciseId: re.exercise_id, adhoc: false,
  }))
  slots = slots.map(s => ({ ...s }))
  for (const set of sessionSets) {
    if (set.routine_exercise_id) {
      let slot = slots.find(s => s.routineExerciseId === set.routine_exercise_id)
      if (!slot) {
        slot = { key: set.routine_exercise_id, routineExerciseId: set.routine_exercise_id, plannedId: set.swapped_from_exercise_id || set.exercise_id, exerciseId: set.exercise_id, adhoc: false }
        slots.push(slot)
      }
      slot.exerciseId = set.exercise_id
    } else if (!slots.some(s => !s.routineExerciseId && s.exerciseId === set.exercise_id)) {
      slots.push({ key: `x-${set.exercise_id}`, routineExerciseId: null, plannedId: null, exerciseId: set.exercise_id, adhoc: true })
    }
  }
  return slots
}

const slotSets = (slot, sessionSets) => sessionSets
  .filter(s => (slot.routineExerciseId ? s.routine_exercise_id === slot.routineExerciseId : !s.routine_exercise_id && s.exercise_id === slot.exerciseId))
  .sort((a, b) => a.created_at.localeCompare(b.created_at))

function useWakeLock() {
  useEffect(() => {
    let lock = null, released = false
    const acquire = () => {
      if (document.hidden || !navigator.wakeLock) return
      navigator.wakeLock.request('screen').then(l => { if (released) l.release(); else lock = l }).catch(() => {})
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => { released = true; document.removeEventListener('visibilitychange', acquire); lock?.release().catch(() => {}) }
  }, [])
}

export function SessionView({ session, routine, gym, weightEntries, onMinimize, onFinished, onDiscarded }) {
  const { sets, sessionsById, index, settings, actions, historyIds } = gym
  useWakeLock()

  const sessionSets = useMemo(() => sets.filter(s => s.session_id === session.id), [sets, session.id])
  const [slots, setSlots] = useState(() => buildSlots(session, routine, sessionSets))
  const [drafts, setDrafts] = useState({})          // slotKey → [{ weight, reps }]
  const [editing, setEditing] = useState(null)      // { id, weight, reps }
  const [rest, setRest] = useState(null)            // { endsAt, total }
  const [toast, setToast] = useState(null)
  const [swapKey, setSwapKey] = useState(null)
  const [picker, setPicker] = useState(null)        // { kind: 'extra' } | { kind: 'swap', key }
  const [detail, setDetail] = useState(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const toastTimer = useRef(null)
  const closeRest = useCallback(() => setRest(null), []) // stable: RestTimer's effect depends on it

  useEffect(() => { writeLocal(slotsKey(session.id), slots) }, [slots, session.id])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const exOf = id => index.byId.get(id) || unknownExercise(id)
  const reById = useMemo(() => new Map((routine?.exercises || []).map(e => [e.id, e])), [routine])

  const targetOf = slot => {
    const re = slot.routineExerciseId ? reById.get(slot.routineExerciseId) : null
    const base = { ...DEFAULT_TARGET, increment_kg: settings.default_increment_kg, rest_seconds: null }
    if (!re) return base
    // A swapped-in exercise keeps the planned sets/reps but not the planned start weight.
    return { ...base, ...re, start_weight_kg: slot.exerciseId === slot.plannedId ? re.start_weight_kg : null }
  }

  const infoOf = slot => {
    const target = targetOf(slot)
    const history = exerciseHistory(slot.exerciseId, sets, sessionsById, session.id)
    const hint = progressionHint(target, history)
    return { target, history, hint, logged: slotSets(slot, sessionSets) }
  }

  // Pre-fill: last session's weight/reps per set number; falls back to the start weight / hint.
  const defaultDrafts = (slot, info) => {
    const last = info.history[0] || []
    const n = Math.max(0, info.target.target_sets - info.logged.length)
    return Array.from({ length: n }, (_, j) => {
      const prev = last[info.logged.length + j] || last[last.length - 1]
      const w = prev ? prev.weight_kg : info.hint.weight
      const r = prev ? prev.reps : info.target.rep_min
      return { weight: w == null ? '' : String(Number(w)), reps: String(r ?? '') }
    })
  }
  const draftsOf = (slot, info) => drafts[slot.key] ?? defaultDrafts(slot, info)
  const setDraftsFor = (key, rows) => setDrafts(d => ({ ...d, [key]: rows }))

  function showToast(text) {
    setToast(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  async function logSet(slot, info, j) {
    const rows = draftsOf(slot, info)
    const row = rows[j]
    // An empty weight field is almost always a mistake on a first-time exercise; 0 must be typed for bodyweight.
    if (String(row.weight).trim() === '') return setError(`Enter a weight for ${exOf(slot.exerciseId).name} (0 for bodyweight).`)
    const weight = parseFloat(row.weight) || 0
    const reps = parseInt(row.reps, 10)
    if (!Number.isFinite(reps) || reps < 0) return setError('Enter the reps first.')
    setError(null); setBusy(true)
    const setNumber = sessionSets.filter(s => s.exercise_id === slot.exerciseId).length + 1
    const prior = sets.filter(s => s.exercise_id === slot.exerciseId)
    const res = await actions.addSet({
      session_id: session.id, exercise_id: slot.exerciseId, set_number: setNumber, weight_kg: weight, reps,
      routine_exercise_id: slot.routineExerciseId,
      swapped_from_exercise_id: slot.plannedId && slot.plannedId !== slot.exerciseId ? slot.plannedId : null,
      is_adhoc: slot.adhoc,
    })
    setBusy(false)
    if (res.error) return setError(res.error.message || 'Could not save the set')
    setDraftsFor(slot.key, rows.filter((_, k) => k !== j))
    const prs = detectSetPRs({ weight_kg: weight, reps }, prior)
    if (prs.length) showToast(`🏆 New PR · ${exOf(slot.exerciseId).name} · ${prLabel(prs[0])}`)
    const sec = info.target.rest_seconds ?? settings.default_rest_seconds
    if (sec > 0) setRest({ endsAt: restUntil(sec), total: sec })
  }

  async function saveEdit() {
    const weight = parseFloat(editing.weight) || 0
    const reps = parseInt(editing.reps, 10)
    if (!Number.isFinite(reps)) return
    const res = await actions.updateSet(editing.id, { weight_kg: weight, reps })
    if (res.error) setError(res.error.message); else setEditing(null)
  }

  async function deleteSet(id) {
    const res = await actions.deleteSet(id)
    if (res.error) setError(res.error.message); else setEditing(null)
  }

  function chooseSwap(key, ex) {
    setSlots(list => list.map(s => (s.key === key ? { ...s, exerciseId: ex.id } : s)))
    setDrafts(d => { const n = { ...d }; delete n[key]; return n })
    setSwapKey(null); setPicker(null); setDetail(null)
  }

  function addExtra(ex) {
    setSlots(list => [...list, { key: extraKey(ex.id), routineExerciseId: null, plannedId: null, exerciseId: ex.id, adhoc: true }])
    setPicker(null); setDetail(null)
  }

  async function finish() {
    setBusy(true)
    const res = await actions.finishSession(session, settings.hr_max)
    setBusy(false)
    if (res.error) return setError(res.error.message || 'Could not finish')
    writeLocal(slotsKey(session.id), null)
    onFinished(session.id, res.hrStatus)
  }

  async function discard() {
    setBusy(true)
    const res = await actions.deleteSession(session.id)
    setBusy(false)
    if (res.error) return setError(res.error.message)
    writeLocal(slotsKey(session.id), null)
    onDiscarded()
  }

  const infos = slots.map(s => infoOf(s))
  const currentIdx = slots.findIndex((s, i) => draftsOf(s, infos[i]).length > 0)

  const header = (
    <>
      <button type="button" onClick={onMinimize} style={{ ...iconBtn, border: 'none' }} aria-label="Minimise session">▾</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.routine_name || 'Session'}</div>
        <Elapsed session={session} count={sessionSets.length} />
      </div>
      <button type="button" onClick={() => setFinishOpen(true)} className="btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: '0.8rem' }}>Finish</button>
    </>
  )

  return (
    <FullScreen header={header}>
      <div style={{ padding: '14px 14px 150px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {slots.length === 0 && (
          <div className="card"><Empty>Free session — add whatever you do with “+ Add exercise”.</Empty></div>
        )}
        {slots.map((slot, i) => (
          <SlotCard
            key={slot.key} slot={slot} info={infos[i]} ex={exOf(slot.exerciseId)} planned={slot.plannedId ? exOf(slot.plannedId) : null}
            current={i === currentIdx} rows={draftsOf(slot, infos[i])} defaultRest={settings.default_rest_seconds} sets={sets} exOf={exOf} busy={busy} editing={editing}
            onRows={rows => setDraftsFor(slot.key, rows)}
            onLog={j => logSet(slot, infos[i], j)}
            onEdit={setEditing} onSaveEdit={saveEdit} onDeleteSet={deleteSet}
            onSwap={() => setSwapKey(slot.key)}
            onInfo={() => setDetail(exOf(slot.exerciseId))}
            onRemove={slot.adhoc && infos[i].logged.length === 0 ? () => setSlots(l => l.filter(s => s.key !== slot.key)) : null}
          />
        ))}

        <button type="button" className="btn-ghost" style={{ width: '100%', color: C.accent, borderColor: 'rgba(94,207,207,0.3)' }} onClick={() => setPicker({ kind: 'extra' })}>
          + Add exercise
        </button>
        {error && <div style={{ fontSize: '0.78rem', color: C.danger, textAlign: 'center' }}>{error}</div>}
      </div>

      {toast && (
        <div role="status" className="fade-up" style={{
          position: 'fixed', left: 16, right: 16, top: 'calc(max(12px, env(safe-area-inset-top)) + 62px)', zIndex: 39, maxWidth: 568, margin: '0 auto',
          background: '#2a2416', border: '1px solid rgba(240,201,106,0.4)', color: C.pr, borderRadius: 12, padding: '11px 14px',
          fontSize: '0.82rem', boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        }}>{toast}</div>
      )}

      {rest && <RestTimer key={rest.endsAt - rest.total * 1000} rest={rest} onChange={setRest} onDone={closeRest} />}

      {swapKey && (() => {
        const slot = slots.find(s => s.key === swapKey)
        return (
          <SwapSheet slot={slot} planned={exOf(slot.plannedId || slot.exerciseId)} current={exOf(slot.exerciseId)} all={index.all}
            historyIds={historyIds} sets={sets} onClose={() => setSwapKey(null)} onChoose={ex => chooseSwap(slot.key, ex)}
            onSearch={() => { setPicker({ kind: 'swap', key: slot.key }); setSwapKey(null) }} />
        )
      })()}

      {picker && (
        <FullScreen z={45} header={<>
          <button type="button" onClick={() => setPicker(null)} style={{ ...iconBtn, border: 'none' }} aria-label="Back">←</button>
          <div style={{ flex: 1, fontSize: '0.95rem', fontWeight: 600, color: C.text }}>{picker.kind === 'swap' ? 'Swap to…' : 'Add exercise'}</div>
        </>}>
          <div style={{ padding: 16 }}>
            <LibraryBrowser all={index.all} historyIds={historyIds} mode="pick" onOpen={setDetail}
              initialMuscle={picker.kind === 'swap' ? (exOf(slots.find(s => s.key === picker.key)?.plannedId).primary[0] || '') : ''}
              onSelect={ex => (picker.kind === 'swap' ? chooseSwap(picker.key, ex) : addExtra(ex))} />
          </div>
        </FullScreen>
      )}

      {detail && (
        <ExerciseDetail exercise={detail} sets={sets} sessionsById={sessionsById} weightEntries={weightEntries} z={10} onClose={() => setDetail(null)}
          selectLabel={picker ? (picker.kind === 'swap' ? 'Swap to this' : 'Add to session') : null}
          onSelect={ex => (picker?.kind === 'swap' ? chooseSwap(picker.key, ex) : addExtra(ex))} />
      )}

      {finishOpen && (
        <Sheet onClose={() => setFinishOpen(false)} z={10} title={sessionSets.length ? 'Finish session?' : 'Nothing logged yet'}>
          {sessionSets.length ? (
            <>
              <div style={{ fontSize: '0.82rem', color: C.muted, lineHeight: 1.5, marginBottom: 16 }}>
                {sessionSets.length} sets logged. The heart-rate summary is computed from your Inspire 3 for this session window.
                {currentIdx >= 0 && <> Un-logged planned sets are simply skipped.</>}
              </div>
              <button className="btn-primary" disabled={busy} onClick={finish}>{busy ? 'Saving…' : 'Finish & see summary'}</button>
              <button className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setFinishOpen(false)}>Keep training</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.82rem', color: C.muted, marginBottom: 16 }}>Discard this empty session?</div>
              <ConfirmRow text="Delete empty session" confirmLabel="Discard" onConfirm={discard} onCancel={() => setFinishOpen(false)} />
            </>
          )}
        </Sheet>
      )}
    </FullScreen>
  )
}

function Elapsed({ session, count }) {
  const now = useNow(1000)
  const sec = Math.max(0, Math.floor((now - new Date(session.started_at).getTime()) / 1000))
  const mm = Math.floor(sec / 60), ss = String(sec % 60).padStart(2, '0')
  return (
    <div className="mono" style={{ fontSize: '0.68rem', color: C.subtle }}>
      {mm >= 60 ? fmtDuration(durationMin(session, now)) : `${mm}:${ss}`} · {count} set{count === 1 ? '' : 's'}
    </div>
  )
}

function SlotCard({ slot, info, ex, planned, current, rows, defaultRest, sets, exOf, busy, editing, onRows, onLog, onEdit, onSaveEdit, onDeleteSet, onSwap, onInfo, onRemove }) {
  const { target, hint, logged, history } = info
  const step = Number(target.increment_kg) || 2.5
  const swapped = planned && planned.id !== ex.id
  const done = rows.length === 0 && logged.length > 0
  const repText = target.rep_min === target.rep_max ? `${target.rep_min}` : `${target.rep_min}–${target.rep_max}`
  const hintColor = hint.kind === 'increase' ? C.good : hint.kind === 'deload' ? C.danger : C.muted
  const canApply = hint.weight != null && rows.some(r => r.weight !== String(hint.weight) || r.reps !== String(hint.reps))

  return (
    <div className="card" style={{ padding: 12, borderColor: current ? 'rgba(94,207,207,0.35)' : undefined, opacity: done ? 0.75 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={onInfo} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
          <ExerciseThumb exercise={ex} size={42} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: C.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</span>
              {done && <span style={{ color: C.good, fontSize: '0.8rem' }}>✓</span>}
            </div>
            <div style={{ fontSize: '0.68rem', color: C.subtle, marginTop: 2 }}>
              {slot.adhoc ? 'Extra' : `${target.target_sets} × ${repText}`} · rest {target.rest_seconds ?? defaultRest}s
              {swapped && <> · <span style={{ color: C.warn }}>for {planned.name}</span></>}
            </div>
          </div>
        </button>
        {!slot.adhoc && <button type="button" onClick={onSwap} style={smallBtn(false)} aria-label={`Swap ${ex.name}`}>⇄ Swap</button>}
        {onRemove && <button type="button" onClick={onRemove} style={{ ...iconBtn, width: 28, height: 28 }} aria-label="Remove extra">✕</button>}
      </div>

      {history[0] && (
        <div className="mono" style={{ fontSize: '0.68rem', color: C.subtle, marginTop: 8 }}>
          Last: {history[0].map(s => `${fmtKg(s.weight_kg)}×${s.reps}`).join('  ')}
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: '0.72rem', color: hintColor, lineHeight: 1.35 }}>
            {hint.kind === 'increase' ? '↑ ' : hint.kind === 'deload' ? '↓ ' : ''}{hint.message}
          </span>
          {canApply && (
            <button type="button" onClick={() => onRows(rows.map(() => ({ weight: String(hint.weight), reps: String(hint.reps) })))}
              style={{ ...smallBtn(true, hintColor === C.muted ? C.accent : hintColor, 'rgba(255,255,255,0.06)'), flexShrink: 0 }}>Apply</button>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {logged.map((s, n) => {
          const prior = sets.filter(x => x.exercise_id === s.exercise_id && x.created_at < s.created_at)
          const pr = detectSetPRs(s, prior)[0]
          if (editing?.id === s.id) {
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '6px 0' }}>
                <span className="mono" style={{ width: 16, fontSize: '0.72rem', color: C.subtle }}>{n + 1}</span>
                <Stepper value={editing.weight} step={step} width={50} ariaLabel="weight kg" onChange={v => onEdit({ ...editing, weight: v })} />
                <Stepper value={editing.reps} step={1} width={34} inputMode="numeric" ariaLabel="reps" onChange={v => onEdit({ ...editing, reps: v })} />
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  <button type="button" onClick={onSaveEdit} style={smallBtn(true)}>Save</button>
                  <button type="button" onClick={() => onDeleteSet(s.id)} style={smallBtn(true, C.danger, C.dangerBg)}>Delete</button>
                  <button type="button" onClick={() => onEdit(null)} style={smallBtn(false)}>✕</button>
                </div>
              </div>
            )
          }
          return (
            <button key={s.id} type="button" onClick={() => onEdit({ id: s.id, weight: String(Number(s.weight_kg)), reps: String(s.reps) })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 8, background: 'rgba(110,200,122,0.06)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span className="mono" style={{ width: 16, fontSize: '0.72rem', color: C.subtle }}>{n + 1}</span>
              <span className="mono" style={{ fontSize: '0.9rem', color: C.text }}>{fmtKg(s.weight_kg)}<span style={{ fontSize: '0.66rem', color: C.muted }}> kg</span> × {s.reps}</span>
              {s.exercise_id !== slot.exerciseId && <span style={{ fontSize: '0.64rem', color: C.subtle }}>({exOf(s.exercise_id).name})</span>}
              {pr && <Badge color={C.pr} bg={C.prBg}>PR</Badge>}
              <span style={{ marginLeft: 'auto', color: C.good, fontSize: '0.8rem' }}>✓</span>
            </button>
          )
        })}

        {rows.map((r, j) => (
          <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="mono" style={{ width: 16, fontSize: '0.72rem', color: C.subtle }}>{logged.length + j + 1}</span>
            <Stepper value={r.weight} step={step} width={48} ariaLabel="weight kg" onChange={v => onRows(rows.map((x, k) => (k === j ? { ...x, weight: v } : x)))} />
            <span style={{ fontSize: '0.62rem', color: C.subtle }}>kg</span>
            <Stepper value={r.reps} step={1} width={30} inputMode="numeric" ariaLabel="reps" onChange={v => onRows(rows.map((x, k) => (k === j ? { ...x, reps: v } : x)))} />
            <button type="button" disabled={busy} onClick={() => onLog(j)} aria-label={`Log set ${logged.length + j + 1}`}
              style={{ marginLeft: 'auto', width: 40, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer', background: j === 0 && current ? C.accent : C.accentBg, color: j === 0 && current ? '#0c0d0f' : C.accent, fontSize: '1rem', fontWeight: 700, flexShrink: 0 }}>✓</button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => {
            const lastRow = rows[rows.length - 1] || (logged.length ? { weight: String(Number(logged[logged.length - 1].weight_kg)), reps: String(logged[logged.length - 1].reps) } : { weight: hint.weight != null ? String(hint.weight) : '', reps: String(target.rep_min) })
            onRows([...rows, { ...lastRow }])
          }} style={smallBtn(false)}>+ Set</button>
          {rows.length > 0 && <button type="button" onClick={() => onRows(rows.slice(0, -1))} style={smallBtn(false)}>− Set</button>}
        </div>
      </div>
    </div>
  )
}

function RestTimer({ rest, onChange, onDone }) {
  const now = useNow(250)
  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000))
  const over = left === 0
  useEffect(() => {
    if (!over) return
    try { navigator.vibrate?.([200, 100, 200]) } catch { /* unsupported */ }
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [over, onDone])
  const pct = Math.min(100, Math.max(0, (1 - (rest.endsAt - now) / (rest.total * 1000)) * 100))
  const adjust = d => onChange({ endsAt: Math.max(now, rest.endsAt + d * 1000), total: Math.max(1, rest.total + d) })
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 38, maxWidth: 600, margin: '0 auto',
      background: over ? '#14251a' : 'rgba(20,22,24,0.97)', borderTop: `1px solid ${over ? 'rgba(110,200,122,0.4)' : C.borderHover}`,
      padding: '10px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    }}>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: over ? C.good : C.accent, transition: 'width 0.25s linear' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...label, fontSize: '0.62rem' }}>{over ? 'REST OVER' : 'REST'}</div>
          <div className="mono" style={{ fontSize: '1.5rem', color: over ? C.good : C.text, lineHeight: 1.1 }}>
            {over ? 'Go! 💪' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}
          </div>
        </div>
        {!over && <button type="button" onClick={() => adjust(-15)} style={smallBtn(false)}>−15</button>}
        {!over && <button type="button" onClick={() => adjust(15)} style={smallBtn(false)}>+15</button>}
        <button type="button" onClick={onDone} style={smallBtn(true)}>{over ? 'Close' : 'Skip'}</button>
      </div>
    </div>
  )
}

const SWAP_FILTERS = ['', 'machine', 'cable', 'dumbbell', 'barbell', 'body only']

function SwapSheet({ slot, planned, current, all, historyIds, sets, onClose, onChoose, onSearch }) {
  const [equip, setEquip] = useState('')
  const alts = useMemo(() => findAlternatives(planned, all, { historyIds, limit: 60 }), [planned, all, historyIds])
  const shown = alts.filter(a => !equip || a.ex.equipment === equip).slice(0, 25)
  const lastTop = id => {
    const mine = sets.filter(s => s.exercise_id === id)
    if (!mine.length) return null
    const last = mine.reduce((a, b) => (a.created_at > b.created_at ? a : b))
    return `${fmtKg(last.weight_kg)}×${last.reps}`
  }
  return (
    <Sheet onClose={onClose} z={10} title="Machine taken? Swap">
      <div style={{ fontSize: '0.74rem', color: C.subtle, marginBottom: 10 }}>
        Same primary muscles as <span style={{ color: C.text }}>{planned.name}</span>: <span style={{ textTransform: 'capitalize' }}>{planned.primary.join(', ') || '—'}</span>
      </div>
      {slot.plannedId && current.id !== slot.plannedId && (
        <button type="button" className="btn-ghost" style={{ width: '100%', marginBottom: 10 }} onClick={() => onChoose(planned)}>↩ Back to {planned.name}</button>
      )}
      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 6, marginBottom: 6 }}>
        {SWAP_FILTERS.map(f => <Chip key={f || 'all'} active={equip === f} onClick={() => setEquip(f)}>{f ? titleCase(f) : 'All'}</Chip>)}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {shown.length === 0 && <Empty>No alternatives with this filter.</Empty>}
        {shown.map(({ ex, exact }, i) => (
          <button key={ex.id} type="button" onClick={() => onChoose(ex)} disabled={ex.id === current.id}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', background: ex.id === current.id ? C.accentBg : 'none', border: 'none', borderTop: i ? `1px solid ${C.divider}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
            <ExerciseThumb exercise={ex} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: '0.84rem', color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</span>
                {ex.source === 'custom' && <Badge>MINE</Badge>}
              </div>
              <div style={{ fontSize: '0.66rem', color: C.subtle, marginTop: 2 }}>
                {titleCase(ex.equipment)}{exact ? ' · same muscles' : ` · ${ex.primary.join(', ')}`}
              </div>
            </div>
            {lastTop(ex.id) && <span className="mono" style={{ fontSize: '0.68rem', color: C.muted }}>{lastTop(ex.id)}</span>}
          </button>
        ))}
      </div>
      <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={onSearch}>Search the whole library…</button>
    </Sheet>
  )
}
