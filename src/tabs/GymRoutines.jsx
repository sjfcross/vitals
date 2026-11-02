import { WEEKDAYS, rotationLetter } from '../lib/gymLogic'
import { unknownExercise } from '../lib/gymLibrary'
import { ExerciseThumb } from '../components/gym/ExerciseMedia'
import { Badge, Empty, SectionLabel } from '../components/gym/GymUi'
import { C } from '../components/gym/gymStyles'

export function GymRoutines({ gym, onEditRoutine, onNewCustom, onOpenExercise }) {
  const { routines, index } = gym
  const exOf = id => index.byId.get(id) || unknownExercise(id)
  const rotation = routines.filter(r => r.schedule_type === 'rotation').sort((a, b) => a.rotation_order - b.rotation_order)
  const weekly = routines.filter(r => r.schedule_type === 'weekdays')
  const customs = index.customs.filter(c => !c.archived)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SectionLabel right={<button type="button" onClick={() => onEditRoutine(null)} style={{ background: 'none', border: 'none', color: C.accent, fontSize: '0.76rem', cursor: 'pointer', padding: 0 }}>+ New routine</button>}>
          ROUTINES
        </SectionLabel>
        {routines.length === 0 && (
          <div className="card"><Empty>No routines yet. A/B/C rotation (“next one after the last”) or fixed weekdays — both work.</Empty></div>
        )}
        {rotation.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.64rem', color: C.subtle, letterSpacing: '0.05em' }}>ROTATION</div>
            {rotation.map((r, i) => <RoutineCard key={r.id} r={r} tag={rotationLetter(i)} exOf={exOf} onEdit={onEditRoutine} />)}
          </div>
        )}
        {weekly.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: rotation.length ? 12 : 0 }}>
            <div style={{ fontSize: '0.64rem', color: C.subtle, letterSpacing: '0.05em' }}>FIXED WEEKDAYS</div>
            {weekly.map(r => <RoutineCard key={r.id} r={r} tag={WEEKDAYS.filter(d => r.weekdays.includes(d.iso)).map(d => d.short).join(' ')} exOf={exOf} onEdit={onEditRoutine} />)}
          </div>
        )}
      </div>

      <div>
        <SectionLabel right={<button type="button" onClick={onNewCustom} style={{ background: 'none', border: 'none', color: C.accent, fontSize: '0.76rem', cursor: 'pointer', padding: 0 }}>+ Custom exercise</button>}>
          MY GYM'S MACHINES
        </SectionLabel>
        <div className="card" style={{ overflow: 'hidden' }}>
          {customs.length === 0 && <Empty>Machines that aren’t in the library (brand-specific, plate-loaded, …) go here.</Empty>}
          {customs.map((c, i) => (
            <button key={c.id} type="button" onClick={() => onOpenExercise(c)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', background: 'none', border: 'none', borderTop: i ? `1px solid ${C.divider}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
              <ExerciseThumb exercise={c} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.84rem', color: C.text }}>{c.name}</div>
                <div style={{ fontSize: '0.68rem', color: C.subtle, textTransform: 'capitalize', marginTop: 2 }}>{c.primary.join(', ')} · {c.equipment}</div>
              </div>
              <Badge>MINE</Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function RoutineCard({ r, tag, exOf, onEdit }) {
  return (
    <button type="button" onClick={() => onEdit(r)} className="card"
      style={{ display: 'block', width: '100%', padding: 14, cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="mono" style={{ minWidth: 30, height: 30, padding: '0 6px', borderRadius: 8, background: C.accentBg, color: C.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem' }}>{tag}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.92rem', color: C.text, fontWeight: 500 }}>{r.name}</div>
          <div style={{ fontSize: '0.68rem', color: C.subtle, marginTop: 2 }}>{r.exercises.length} exercises · {r.exercises.reduce((a, e) => a + e.target_sets, 0)} sets</div>
        </div>
        <span style={{ color: C.subtle, fontSize: '0.8rem' }}>✎</span>
      </div>
      {r.exercises.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 10, overflow: 'hidden' }}>
          {r.exercises.slice(0, 7).map(e => <ExerciseThumb key={e.id} exercise={exOf(e.exercise_id)} size={30} />)}
          {r.exercises.length > 7 && <span className="mono" style={{ fontSize: '0.66rem', color: C.subtle, alignSelf: 'center', marginLeft: 4 }}>+{r.exercises.length - 7}</span>}
        </div>
      )}
    </button>
  )
}
