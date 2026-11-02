import { useMemo, useState } from 'react'
import { searchExercises, MUSCLES, EQUIPMENT, CATEGORIES, titleCase } from '../../lib/gymLibrary'
import { ExerciseThumb } from './ExerciseMedia'
import { Badge, Chip, Empty } from './GymUi'
import { C, fieldLabel } from './gymStyles'

const PAGE = 40

// mode 'browse': tapping a row calls onOpen (detail view).
// mode 'pick':   tapping a row calls onSelect; the ⓘ button opens the detail view.
export function LibraryBrowser({ all, historyIds, mode = 'browse', onOpen, onSelect, onCreateCustom, initialMuscle = '', autoFocus = false }) {
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState(initialMuscle)
  const [equipment, setEquipment] = useState('')
  const [category, setCategory] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [limit, setLimit] = useState(PAGE)

  const results = useMemo(() => {
    let r = searchExercises(all, { q, muscle, equipment, category })
    if (onlyMine) r = r.filter(e => e.source === 'custom' || historyIds?.has(e.id))
    return r
  }, [all, q, muscle, equipment, category, onlyMine, historyIds])

  const reset = fn => v => { fn(v); setLimit(PAGE) }

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input
          className="input" type="search" value={q} autoFocus={autoFocus}
          onChange={e => reset(setQ)(e.target.value)}
          placeholder={`Search ${all.length} exercises…`}
          style={{ paddingLeft: 34 }}
        />
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.subtle, fontSize: '0.85rem', pointerEvents: 'none' }}>⌕</span>
      </div>

      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 6, marginBottom: 8, scrollbarWidth: 'none' }}>
        <Chip active={!muscle} onClick={() => reset(setMuscle)('')}>All</Chip>
        {MUSCLES.map(m => (
          <Chip key={m} active={muscle === m} onClick={() => reset(setMuscle)(muscle === m ? '' : m)}>{titleCase(m)}</Chip>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 12, alignItems: 'end' }}>
        <div>
          <label style={fieldLabel}>EQUIPMENT</label>
          <select className="input" value={equipment} onChange={e => reset(setEquipment)(e.target.value)} style={{ padding: '8px 10px', fontSize: '0.8rem' }}>
            <option value="">Any</option>
            {EQUIPMENT.map(e => <option key={e} value={e}>{titleCase(e)}</option>)}
          </select>
        </div>
        <div>
          <label style={fieldLabel}>TYPE</label>
          <select className="input" value={category} onChange={e => reset(setCategory)(e.target.value)} style={{ padding: '8px 10px', fontSize: '0.8rem' }}>
            <option value="">Any</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{titleCase(c)}</option>)}
          </select>
        </div>
        <Chip active={onlyMine} onClick={() => reset(setOnlyMine)(!onlyMine)} style={{ padding: '9px 10px' }}>Mine</Chip>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: '0.66rem', color: C.subtle }}>{results.length} result{results.length === 1 ? '' : 's'}</span>
        {onCreateCustom && (
          <button type="button" onClick={onCreateCustom} style={{ background: 'none', border: 'none', color: C.accent, fontSize: '0.74rem', cursor: 'pointer', padding: 0 }}>
            + Custom exercise
          </button>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {results.length === 0 && (
          <Empty>
            No match. {onCreateCustom && <>Gym-specific machine? <button type="button" onClick={onCreateCustom} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 'inherit', padding: 0 }}>Add it as a custom exercise</button>.</>}
          </Empty>
        )}
        {results.slice(0, limit).map((ex, i) => (
          <div key={ex.id} style={{ display: 'flex', alignItems: 'center', borderTop: i ? `1px solid ${C.divider}` : 'none' }}>
            <button
              type="button"
              onClick={() => (mode === 'pick' ? onSelect?.(ex) : onOpen?.(ex))}
              style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <ExerciseThumb exercise={ex} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.86rem', color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</span>
                  {ex.source === 'custom' && <Badge>MINE</Badge>}
                  {ex.source !== 'custom' && historyIds?.has(ex.id) && <Badge color={C.muted} bg="rgba(255,255,255,0.05)">DONE</Badge>}
                </div>
                <div style={{ fontSize: '0.7rem', color: C.subtle, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'capitalize' }}>
                  {ex.primary.join(', ') || '—'} · {ex.equipment}
                </div>
              </div>
            </button>
            {mode === 'pick' && onOpen && (
              <button type="button" aria-label={`Details for ${ex.name}`} onClick={() => onOpen(ex)}
                style={{ background: 'none', border: 'none', color: C.subtle, cursor: 'pointer', padding: '10px 14px', fontSize: '0.9rem' }}>ⓘ</button>
            )}
          </div>
        ))}
        {results.length > limit && (
          <button type="button" onClick={() => setLimit(l => l + PAGE * 2)}
            style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)', border: 'none', borderTop: `1px solid ${C.divider}`, color: C.muted, cursor: 'pointer', fontSize: '0.78rem' }}>
            Show more ({results.length - limit} left)
          </button>
        )}
      </div>
    </div>
  )
}
