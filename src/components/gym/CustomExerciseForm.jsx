import { useMemo, useState } from 'react'
import { MUSCLES, EQUIPMENT, titleCase, searchExercises } from '../../lib/gymLibrary'
import { ExerciseThumb } from './ExerciseMedia'
import { Chip, Sheet } from './GymUi'
import { C, fieldLabel } from './gymStyles'

// Create / edit a gym-specific exercise. `initial` is a custom row (edit) or undefined (new).
export function CustomExerciseForm({ initial, library, onSave, onClose, z = 0 }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [primary, setPrimary] = useState(initial?.primary_muscles ?? [])
  const [secondary, setSecondary] = useState(initial?.secondary_muscles ?? [])
  const [equipment, setEquipment] = useState(initial?.equipment ?? 'machine')
  const [mechanic, setMechanic] = useState(initial?.mechanic ?? '')
  const [force, setForce] = useState(initial?.force ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [basedOn, setBasedOn] = useState(initial?.based_on ?? '')
  const [likeQ, setLikeQ] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const basedEx = useMemo(() => library.find(e => e.id === basedOn), [library, basedOn])
  const suggestions = useMemo(() => {
    if (likeQ.trim().length < 2) return []
    return searchExercises(library, { q: likeQ }).slice(0, 6)
  }, [library, likeQ])

  const toggle = (list, setList, m, other, setOther) => {
    if (list.includes(m)) setList(list.filter(x => x !== m))
    else { setList([...list, m]); if (other.includes(m)) setOther(other.filter(x => x !== m)) }
  }

  // Picking a "looks like" exercise pre-fills empty fields from it.
  function chooseBase(ex) {
    setBasedOn(ex.id); setLikeQ('')
    if (!primary.length) setPrimary(ex.primary)
    if (!secondary.length) setSecondary(ex.secondary)
    if (!mechanic && ex.mechanic) setMechanic(ex.mechanic)
    if (!force && ex.force) setForce(ex.force)
  }

  async function save() {
    if (!name.trim() || !primary.length) return
    setSaving(true); setError(null)
    const res = await onSave({
      name: name.trim(), primary_muscles: primary, secondary_muscles: secondary, equipment,
      mechanic: mechanic || null, force: force || null, notes: notes.trim() || null, based_on: basedOn || null,
      category: 'strength',
    })
    setSaving(false)
    if (res?.error) setError(res.error.message || 'Save failed')
  }

  return (
    <Sheet onClose={onClose} z={z} title={initial ? 'Edit custom exercise' : 'New custom exercise'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={fieldLabel}>NAME</label>
          <input className="input" value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="e.g. Chest press (Gym80, #7)" autoFocus />
        </div>

        <div>
          <label style={fieldLabel}>PRIMARY MUSCLES <span style={{ color: C.danger }}>*</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {MUSCLES.map(m => <Chip key={m} active={primary.includes(m)} onClick={() => toggle(primary, setPrimary, m, secondary, setSecondary)}>{titleCase(m)}</Chip>)}
          </div>
          <div style={{ fontSize: '0.64rem', color: C.subtle, marginTop: 5 }}>Swaps suggest exercises sharing these.</div>
        </div>

        <div>
          <label style={fieldLabel}>SECONDARY MUSCLES</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {MUSCLES.filter(m => !primary.includes(m)).map(m => (
              <Chip key={m} active={secondary.includes(m)} color={C.muted} bg="rgba(255,255,255,0.1)" onClick={() => toggle(secondary, setSecondary, m, primary, setPrimary)}>{titleCase(m)}</Chip>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={fieldLabel}>EQUIPMENT</label>
            <select className="input" value={equipment} onChange={e => setEquipment(e.target.value)} style={{ padding: '9px 8px', fontSize: '0.8rem' }}>
              {EQUIPMENT.map(e => <option key={e} value={e}>{titleCase(e)}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>MECHANIC</label>
            <select className="input" value={mechanic} onChange={e => setMechanic(e.target.value)} style={{ padding: '9px 8px', fontSize: '0.8rem' }}>
              <option value="">–</option><option value="compound">Compound</option><option value="isolation">Isolation</option>
            </select>
          </div>
          <div>
            <label style={fieldLabel}>FORCE</label>
            <select className="input" value={force} onChange={e => setForce(e.target.value)} style={{ padding: '9px 8px', fontSize: '0.8rem' }}>
              <option value="">–</option><option value="push">Push</option><option value="pull">Pull</option><option value="static">Static</option>
            </select>
          </div>
        </div>

        <div>
          <label style={fieldLabel}>LOOKS LIKE (OPTIONAL — BORROWS PHOTOS & HOW-TO)</label>
          {basedEx ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, background: C.elevated, border: `1px solid ${C.border}` }}>
              <ExerciseThumb exercise={basedEx} size={36} />
              <span style={{ flex: 1, fontSize: '0.82rem', color: C.text }}>{basedEx.name}</span>
              <button type="button" onClick={() => setBasedOn('')} style={{ background: 'none', border: 'none', color: C.subtle, cursor: 'pointer' }} aria-label="Clear">✕</button>
            </div>
          ) : (
            <>
              <input className="input" value={likeQ} onChange={e => setLikeQ(e.target.value)} placeholder="Search library, e.g. chest press" />
              {suggestions.length > 0 && (
                <div className="card-elevated" style={{ marginTop: 6, overflow: 'hidden' }}>
                  {suggestions.map((s, i) => (
                    <button key={s.id} type="button" onClick={() => chooseBase(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', background: 'none', border: 'none', borderTop: i ? `1px solid ${C.divider}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <ExerciseThumb exercise={s} size={30} />
                      <span style={{ fontSize: '0.8rem', color: C.text }}>{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label style={fieldLabel}>NOTES</label>
          <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Seat height, pin position, machine number…" />
        </div>

        {error && <div style={{ fontSize: '0.76rem', color: C.danger }}>{error}</div>}
        <button className="btn-primary" disabled={saving || !name.trim() || !primary.length} onClick={save}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add exercise'}
        </button>
      </div>
    </Sheet>
  )
}
