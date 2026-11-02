import { useState } from 'react'
import { WEEKDAYS, rotationLetter } from '../../lib/gymLogic'
import { unknownExercise } from '../../lib/gymLibrary'
import { LibraryBrowser } from './LibraryBrowser'
import { ExerciseDetail } from './ExerciseDetail'
import { CustomExerciseForm } from './CustomExerciseForm'
import { ExerciseThumb } from './ExerciseMedia'
import { Chip, ConfirmRow, Empty, FullScreen, Segmented } from './GymUi'
import { C, fieldLabel, iconBtn, label } from './gymStyles'

let keySeq = 0
const nextKey = () => `k${++keySeq}`

const toForm = (e, settings) => ({
  key: e.id || nextKey(),
  id: e.id,
  exercise_id: e.exercise_id,
  target_sets: String(e.target_sets ?? 3),
  rep_min: String(e.rep_min ?? 8),
  rep_max: String(e.rep_max ?? 12),
  start_weight_kg: e.start_weight_kg == null ? '' : String(e.start_weight_kg),
  increment_kg: String(e.increment_kg ?? settings.default_increment_kg ?? 2.5),
  progression: e.progression ?? 'double',
  rest_seconds: e.rest_seconds == null ? '' : String(e.rest_seconds),
  notes: e.notes ?? '',
})

const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d }
const dec = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null }

export function RoutineEditor({ routine, routines, gym, weightEntries, onSave, onDelete, onClose }) {
  const { index, historyIds, settings, sets, sessionsById, actions, library } = gym
  const rotationCount = routines.filter(r => r.schedule_type === 'rotation' && r.id !== routine?.id).length
  const [name, setName] = useState(routine?.name ?? '')
  const [scheduleType, setScheduleType] = useState(routine?.schedule_type ?? 'rotation')
  const [weekdays, setWeekdays] = useState(routine?.weekdays ?? [])
  const [rotationOrder, setRotationOrder] = useState(routine?.rotation_order ?? rotationCount)
  const [exercises, setExercises] = useState(() => (routine?.exercises ?? []).map(e => toForm(e, settings)))
  const [picking, setPicking] = useState(false)
  const [detail, setDetail] = useState(null)
  const [customForm, setCustomForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const exOf = id => index.byId.get(id) || unknownExercise(id)
  const update = (key, field, value) => setExercises(list => list.map(e => (e.key === key ? { ...e, [field]: value } : e)))
  const move = (i, d) => setExercises(list => {
    const j = i + d
    if (j < 0 || j >= list.length) return list
    const next = [...list];[next[i], next[j]] = [next[j], next[i]]
    return next
  })

  function addExercise(ex) {
    setExercises(list => [...list, toForm({ exercise_id: ex.id, increment_kg: ex.equipment === 'dumbbell' ? 2 : settings.default_increment_kg }, settings)])
    setPicking(false); setDetail(null)
  }

  async function save() {
    setError(null)
    if (!name.trim()) return setError('Give the routine a name.')
    if (scheduleType === 'weekdays' && !weekdays.length) return setError('Pick at least one weekday.')
    const rows = exercises.map(e => {
      const repMin = Math.max(1, int(e.rep_min, 8))
      const repMax = e.progression === 'linear' ? repMin : Math.max(repMin, int(e.rep_max, repMin))
      return {
        id: e.id, exercise_id: e.exercise_id,
        target_sets: Math.min(20, Math.max(1, int(e.target_sets, 3))),
        rep_min: repMin, rep_max: repMax,
        start_weight_kg: dec(e.start_weight_kg),
        increment_kg: dec(e.increment_kg) > 0 ? dec(e.increment_kg) : 2.5,
        progression: e.progression,
        rest_seconds: e.rest_seconds === '' ? null : Math.min(900, Math.max(0, int(e.rest_seconds, 90))),
        notes: e.notes || null,
      }
    })
    setSaving(true)
    const res = await onSave({
      id: routine?.id, name: name.trim(), schedule_type: scheduleType,
      weekdays: scheduleType === 'weekdays' ? [...weekdays].sort((a, b) => a - b) : [],
      rotation_order: Number(rotationOrder) || 0, exercises: rows,
    })
    setSaving(false)
    if (res?.error) setError(res.error.message || 'Save failed')
  }

  const header = (
    <>
      <button type="button" onClick={onClose} style={{ ...iconBtn, border: 'none' }} aria-label="Close">✕</button>
      <div style={{ flex: 1, fontSize: '0.95rem', fontWeight: 600, color: C.text }}>{routine ? 'Edit routine' : 'New routine'}</div>
      <button type="button" onClick={save} disabled={saving} className="btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '0.82rem' }}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </>
  )

  const rotationSlots = Array.from({ length: rotationCount + 1 }, (_, i) => i)

  return (
    <FullScreen header={header}>
      <div style={{ padding: '16px 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={fieldLabel}>NAME</label>
          <input className="input" value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="e.g. A — Upper body" />
        </div>

        <div>
          <label style={fieldLabel}>SCHEDULE</label>
          <Segmented value={scheduleType} onChange={setScheduleType}
            options={[{ id: 'rotation', label: 'A/B/C rotation' }, { id: 'weekdays', label: 'Fixed weekdays' }]} />
          <div style={{ marginTop: 10 }}>
            {scheduleType === 'weekdays' ? (
              <div style={{ display: 'flex', gap: 5 }}>
                {WEEKDAYS.map(d => (
                  <Chip key={d.iso} active={weekdays.includes(d.iso)} style={{ flex: 1, padding: '8px 0' }}
                    onClick={() => setWeekdays(w => (w.includes(d.iso) ? w.filter(x => x !== d.iso) : [...w, d.iso]))}>{d.short}</Chip>
                ))}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {rotationSlots.map(i => (
                    <Chip key={i} active={Number(rotationOrder) === i} onClick={() => setRotationOrder(i)} style={{ minWidth: 38 }}>{rotationLetter(i)}</Chip>
                  ))}
                </div>
                <div style={{ fontSize: '0.66rem', color: C.subtle, marginTop: 6 }}>
                  Position in the rotation. After a session, the next letter is suggested.
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div style={{ ...label, marginBottom: 8 }}>EXERCISES ({exercises.length})</div>
          {exercises.length === 0 && <div className="card"><Empty>No exercises yet.</Empty></div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exercises.map((e, i) => {
              const ex = exOf(e.exercise_id)
              const linear = e.progression === 'linear'
              return (
                <div key={e.key} className="card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="mono" style={{ fontSize: '0.7rem', color: C.subtle, width: 14 }}>{i + 1}</span>
                    <button type="button" onClick={() => setDetail(ex)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                      <ExerciseThumb exercise={ex} size={36} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.84rem', color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
                        <div style={{ fontSize: '0.66rem', color: C.subtle, textTransform: 'capitalize' }}>{ex.primary.join(', ')}</div>
                      </div>
                    </button>
                    <button type="button" style={{ ...iconBtn, width: 28, height: 28 }} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                    <button type="button" style={{ ...iconBtn, width: 28, height: 28 }} onClick={() => move(i, 1)} disabled={i === exercises.length - 1} aria-label="Move down">↓</button>
                    <button type="button" style={{ ...iconBtn, width: 28, height: 28, color: C.danger }} onClick={() => setExercises(l => l.filter(x => x.key !== e.key))} aria-label="Remove">✕</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: linear ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
                    <Field label="SETS" value={e.target_sets} onChange={v => update(e.key, 'target_sets', v)} mode="numeric" />
                    <Field label={linear ? 'REPS' : 'REPS MIN'} value={e.rep_min} onChange={v => update(e.key, 'rep_min', v)} mode="numeric" />
                    {!linear && <Field label="REPS MAX" value={e.rep_max} onChange={v => update(e.key, 'rep_max', v)} mode="numeric" />}
                    <Field label="START KG" value={e.start_weight_kg} onChange={v => update(e.key, 'start_weight_kg', v)} placeholder="–" />
                    <Field label="+ KG" value={e.increment_kg} onChange={v => update(e.key, 'increment_kg', v)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6, marginTop: 6 }}>
                    <div>
                      <label style={fieldLabel}>PROGRESSION</label>
                      <select className="input" value={e.progression} onChange={ev => update(e.key, 'progression', ev.target.value)} style={{ padding: '8px', fontSize: '0.78rem' }}>
                        <option value="double">Double · range → +kg</option>
                        <option value="linear">Linear · fixed reps → +kg</option>
                      </select>
                    </div>
                    <Field label="REST S" value={e.rest_seconds} onChange={v => update(e.key, 'rest_seconds', v)} mode="numeric" placeholder={String(settings.default_rest_seconds)} />
                  </div>
                </div>
              )
            })}
          </div>
          <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 10, color: C.accent, borderColor: 'rgba(94,207,207,0.3)' }} onClick={() => setPicking(true)}>
            + Add exercise
          </button>
        </div>

        {error && <div style={{ fontSize: '0.78rem', color: C.danger }}>{error}</div>}

        {routine && onDelete && (
          confirmDelete
            ? <ConfirmRow text="Delete routine? Logged sessions are kept." onConfirm={() => onDelete(routine)} onCancel={() => setConfirmDelete(false)} />
            : <button type="button" className="btn-ghost" style={{ color: C.danger }} onClick={() => setConfirmDelete(true)}>Delete routine</button>
        )}
      </div>

      {picking && (
        <FullScreen z={45} header={<>
          <button type="button" onClick={() => setPicking(false)} style={{ ...iconBtn, border: 'none' }} aria-label="Back">←</button>
          <div style={{ flex: 1, fontSize: '0.95rem', fontWeight: 600, color: C.text }}>Add exercise</div>
        </>}>
          <div style={{ padding: 16 }}>
            <LibraryBrowser all={index.all} historyIds={historyIds} mode="pick" onSelect={addExercise} onOpen={setDetail} onCreateCustom={() => setCustomForm(true)} />
          </div>
        </FullScreen>
      )}
      {detail && (
        <ExerciseDetail exercise={detail} sets={sets} sessionsById={sessionsById} weightEntries={weightEntries} z={10}
          onClose={() => setDetail(null)} selectLabel={picking ? 'Add to routine' : null} onSelect={addExercise} />
      )}
      {customForm && (
        <CustomExerciseForm library={library} z={20} onClose={() => setCustomForm(false)}
          onSave={async row => {
            const res = await actions.createCustom(row)
            if (!res.error) { setCustomForm(false); addExercise({ id: 'custom:' + res.data.id, equipment: row.equipment }) }
            return res
          }} />
      )}
    </FullScreen>
  )
}

function Field({ label: l, value, onChange, mode = 'decimal', placeholder }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={{ ...fieldLabel, fontSize: '0.58rem', whiteSpace: 'nowrap' }}>{l}</label>
      <input className="input mono" inputMode={mode} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value.replace(',', '.'))}
        style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.84rem' }} />
    </div>
  )
}
