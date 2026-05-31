import { useState } from 'react'
import dayjs from 'dayjs'

const EMOJIS = ['🍽️','🥗','🥩','🍳','🥪','🍜','🍱','🥡','🍕','🍔','🌮','🌯','🥙','🥘','🍲','🥣','🫕','🧆','🥚','🧇','🥞','🧈','🍞','🥐','🫓','🧀','🥦','🥕','🍎','🍌','🫐','🍇','🧃','☕','🫖','🥤']

function parsePaste(text) {
  const get = (patterns) => {
    for (const pat of patterns) {
      const m = text.match(pat)
      if (m) return parseFloat(m[1])
    }
    return ''
  }
  const description = text.match(/^description[:\s]+(.+)$/im)?.[1]?.trim() ?? ''
  return {
    description,
    calories: get([/calories?[:\s]+(\d+)/i]) || '',
    protein_g: get([/protein[:\s]+([\d.]+)/i]) || '',
    fat_g: get([/fat[:\s]+([\d.]+)/i, /total fat[:\s]+([\d.]+)/i]) || '',
    fat_saturated_g: get([/saturated[:\s]+([\d.]+)/i]) || '',
    carbs_g: get([/carbs?[:\s]+([\d.]+)/i, /carbohydrates?[:\s]+([\d.]+)/i]) || '',
    sugar_g: get([/sugars?[:\s]+([\d.]+)/i]) || '',
    sugar_added_g: get([/added sugar[:\s~]+([\d.]+)/i]) || '',
    fiber_g: get([/fi[b]?re[:\s]+([\d.]+)/i, /fiber[:\s]+([\d.]+)/i]) || '',
    sodium_mg: get([/sodium[:\s]+([\d.]+)/i]) || '',
  }
}

const EMPTY = {
  name: '', description: '', emoji: '🍽️', time: dayjs().format('HH:mm'),
  calories: '', protein_g: '', fat_g: '', fat_saturated_g: '',
  carbs_g: '', sugar_g: '', sugar_added_g: '', fiber_g: '', sodium_mg: '',
  source: 'manual',
}

export function LogMealSheet({ onClose, onSave, date }) {
  const [mode, setMode] = useState('choose')
  const [pasteText, setPasteText] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)

  function handlePaste(e) {
    const text = e.target.value
    setPasteText(text)
    if (text.length > 20) {
      const parsed = parsePaste(text)
      setForm(f => ({ ...f, ...parsed, source: 'claude' }))
      setMode('form')
    }
  }

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const meal = {
      date,
      time: form.time || dayjs().format('HH:mm:ss'),
      name: form.name.trim(),
      description: form.description || null,
      emoji: form.emoji,
      source: form.source,
      calories: form.calories ? parseInt(form.calories) : null,
      protein_g: form.protein_g ? parseFloat(form.protein_g) : null,
      fat_g: form.fat_g ? parseFloat(form.fat_g) : null,
      fat_saturated_g: form.fat_saturated_g ? parseFloat(form.fat_saturated_g) : null,
      carbs_g: form.carbs_g ? parseFloat(form.carbs_g) : null,
      sugar_g: form.sugar_g ? parseFloat(form.sugar_g) : null,
      sugar_added_g: form.sugar_added_g ? parseFloat(form.sugar_added_g) : null,
      fiber_g: form.fiber_g ? parseFloat(form.fiber_g) : null,
      sodium_mg: form.sodium_mg ? parseInt(form.sodium_mg) : null,
    }
    await onSave(meal)
    setSaving(false)
    onClose()
  }

  const numField = (label, field, unit, color) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: '0.7rem', color: color || '#9ca0a4', letterSpacing: '0.04em' }}>
        {label} {unit && <span style={{ color: '#6b6f73' }}>({unit})</span>}
      </label>
      <input className="input mono" type="number" step="0.1" value={form[field]} onChange={set(field)} placeholder="—" />
    </div>
  )

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f0eeea' }}>Log meal</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca0a4', fontSize: '1.2rem', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        {mode === 'choose' && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="card" onClick={() => setMode('paste')} style={{
              padding: '18px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)',
              background: 'var(--elevated)', borderRadius: 12,
            }}>
              <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>✨</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f0eeea' }}>Paste from Claude</div>
              <div style={{ fontSize: '0.78rem', color: '#9ca0a4', marginTop: 4 }}>
                Paste Claude's nutrition analysis — auto-fills all fields
              </div>
            </button>
            <button className="card" onClick={() => setMode('form')} style={{
              padding: '18px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)',
              background: 'var(--elevated)', borderRadius: 12,
            }}>
              <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>✏️</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f0eeea' }}>Manual entry</div>
              <div style={{ fontSize: '0.78rem', color: '#9ca0a4', marginTop: 4 }}>Enter macros by hand</div>
            </button>
          </div>
        )}

        {mode === 'paste' && (
          <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '0.8rem', color: '#9ca0a4' }}>
              Paste Claude's response below — fields will auto-fill when detected.
            </div>
            <textarea
              className="input"
              rows={8}
              value={pasteText}
              onChange={handlePaste}
              placeholder={`Description: beef burger with fries\nCalories: 620 kcal\nProtein: 38g\nFat: 22g\nCarbs: 68g\nSodium: 780mg\nSugar: 12g\nAdded sugar: ~2g\nFibre: 4g`}
              autoFocus
            />
            <button className="btn-primary" onClick={() => setMode('form')} disabled={!pasteText.trim()}>
              Continue to review →
            </button>
            <button className="btn-ghost" onClick={() => setMode('choose')}>Back</button>
          </div>
        )}

        {mode === 'form' && (
          <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {form.source === 'claude' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(110,200,122,0.1)', border: '1px solid rgba(110,200,122,0.3)', borderRadius: 6, padding: '5px 10px', alignSelf: 'flex-start' }}>
                <span style={{ fontSize: '0.7rem', color: '#6ec87a', letterSpacing: '0.04em' }}>✨ AI analysis</span>
              </div>
            )}

            {form.source === 'claude' && form.description && (
              <p className="mono" style={{ fontSize: '0.85rem', color: '#9ca0a4', margin: 0 }}>
                "{form.description}"
              </p>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca0a4', marginBottom: 5 }}>DESCRIPTION</label>
              <input className="input" type="text" value={form.description} onChange={set('description')} placeholder="e.g. beef burger with fries" maxLength={120} />
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca0a4', marginBottom: 5 }}>MEAL NAME</label>
                <input className="input" type="text" value={form.name} onChange={set('name')} placeholder="e.g. Chicken caesar salad" autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca0a4', marginBottom: 5 }}>EMOJI</label>
                <button onClick={() => setEmojiOpen(!emojiOpen)} style={{
                  width: 42, height: 42, background: 'var(--elevated)', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: '1.2rem', cursor: 'pointer',
                }}>
                  {form.emoji}
                </button>
              </div>
            </div>

            {emojiOpen && (
              <div style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => { setForm(f => ({ ...f, emoji: e })); setEmojiOpen(false) }}
                    style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', padding: 3, borderRadius: 4,
                      background: form.emoji === e ? 'rgba(255,255,255,0.1)' : 'none' }}>
                    {e}
                  </button>
                ))}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca0a4', marginBottom: 5 }}>TIME</label>
              <input className="input mono" type="time" value={form.time} onChange={set('time')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {numField('Calories', 'calories', 'kcal', '#e8784a')}
              {numField('Sodium', 'sodium_mg', 'mg', '#5ba4e6')}
              {numField('Protein', 'protein_g', 'g', '#6ec87a')}
              {numField('Fat', 'fat_g', 'g', '#c97fd4')}
              {numField('Sat. fat', 'fat_saturated_g', 'g')}
              {numField('Carbs', 'carbs_g', 'g', '#f0c96a')}
              {numField('Sugar', 'sugar_g', 'g')}
              {numField('Added sugar', 'sugar_added_g', 'g')}
              {numField('Fibre', 'fiber_g', 'g', '#5ecfcf')}
            </div>

            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving…' : 'Save meal'}
              </button>
              <button className="btn-ghost" onClick={() => setMode('choose')}>Back</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
