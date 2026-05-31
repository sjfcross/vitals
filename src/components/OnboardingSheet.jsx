import { useState } from 'react'

export function OnboardingSheet({ onSave }) {
  const [height, setHeight] = useState('')
  const [calories, setCalories] = useState('2000')
  const [sodium, setSodium] = useState('2500')
  const [protein, setProtein] = useState('150')
  const [steps, setSteps] = useState('10000')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave({
      height_cm: height ? parseInt(height) : null,
      target_calories: parseInt(calories),
      target_sodium_mg: parseInt(sodium),
      target_protein_g: parseInt(protein),
      target_steps: parseInt(steps),
    })
    setSaving(false)
  }

  const field = (label, value, set, placeholder, unit) => (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca0a4', marginBottom: 5, letterSpacing: '0.04em' }}>
        {label} {unit && <span style={{ color: '#6b6f73' }}>({unit})</span>}
      </label>
      <input className="input mono" type="number" value={value} onChange={e => set(e.target.value)} placeholder={placeholder} />
    </div>
  )

  return (
    <>
      <div className="sheet-backdrop" />
      <div className="sheet" style={{ padding: '28px 20px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 500, color: '#f0eeea', letterSpacing: '0.08em' }}>
            VITALS
          </div>
          <div style={{ color: '#9ca0a4', fontSize: '0.85rem', marginTop: 6 }}>
            Set your daily targets
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {field('Height', height, setHeight, '175', 'cm')}
          {field('Calorie target', calories, setCalories, '2000', 'kcal')}
          {field('Sodium limit', sodium, setSodium, '2500', 'mg')}
          {field('Protein target', protein, setProtein, '150', 'g')}
          {field('Steps goal', steps, setSteps, '10000', 'steps')}
        </div>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save & continue'}
          </button>
          <button className="btn-ghost" onClick={() => onSave({})}>Skip for now</button>
        </div>
      </div>
    </>
  )
}
