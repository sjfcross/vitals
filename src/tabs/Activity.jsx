import { useState } from 'react'
import { BarChart, Bar, Cell, ResponsiveContainer } from 'recharts'
import dayjs from 'dayjs'
import { useWeekActivity } from '../hooks/useActivity'

export function Activity({ activity, profile, date, onSave }) {
  const [form, setForm] = useState({
    steps: activity?.steps || '',
    km: activity?.km || '',
    active_minutes: activity?.active_minutes || '',
    workout_type: activity?.workout_type || '',
    workout_duration_min: activity?.workout_duration_min || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const weekData = useWeekActivity(date)

  const steps = activity?.steps || 0
  const target = profile?.target_steps || 10000

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function handleSave() {
    setSaving(true)
    await onSave({
      steps: form.steps ? parseInt(form.steps) : null,
      km: form.km ? parseFloat(form.km) : null,
      active_minutes: form.active_minutes ? parseInt(form.active_minutes) : null,
      workout_type: form.workout_type || null,
      workout_duration_min: form.workout_duration_min ? parseInt(form.workout_duration_min) : null,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      {/* Steps ring */}
      <div className="card-lg fade-up stagger-1" style={{ padding: '20px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="#b47fdb" strokeWidth="7" strokeLinecap="round"
              strokeDasharray={`${Math.min(steps / target, 1) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
              transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="mono" style={{ fontSize: '1.1rem', fontWeight: 500, color: '#f0eeea', lineHeight: 1 }}>
              {steps.toLocaleString()}
            </span>
            <span style={{ fontSize: '0.6rem', color: '#6b6f73', marginTop: 2 }}>steps</span>
          </div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: '1rem', color: '#b47fdb' }}>
            {activity?.km ? `${activity.km} km` : `${(steps * 0.00075).toFixed(2)} km`}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#9ca0a4', marginTop: 4 }}>
            {activity?.active_minutes ? `${activity.active_minutes} active min` : '—'}
          </div>
          {activity?.workout_type && (
            <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#9ca0a4', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '4px 8px', display: 'inline-block' }}>
              {activity.workout_type} {activity.workout_duration_min ? `· ${activity.workout_duration_min}min` : ''}
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: '0.72rem', color: '#6b6f73' }}>
            {Math.round((steps / target) * 100)}% of {target.toLocaleString()} goal
          </div>
        </div>
      </div>

      {/* Weekly steps chart */}
      <div className="card fade-up stagger-2" style={{ padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 12 }}>WEEK — STEPS</div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={weekData} barSize={24} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
            <Bar dataKey="steps" radius={[3, 3, 0, 0]}>
              {weekData.map((d, i) => (
                <Cell key={i} fill={d.date === date ? '#b47fdb' : 'rgba(255,255,255,0.1)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          {weekData.map((d, i) => (
            <span key={i} style={{ fontSize: '0.62rem', color: d.date === date ? '#b47fdb' : '#6b6f73', flex: 1, textAlign: 'center' }}>
              {d.label}
            </span>
          ))}
        </div>
      </div>

      {/* Entry form */}
      <div className="card fade-up stagger-3" style={{ padding: '16px' }}>
        <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 14 }}>LOG ACTIVITY</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['Steps', 'steps', 'number', '8500'],
            ['Distance (km)', 'km', 'number', '6.0'],
            ['Active minutes', 'active_minutes', 'number', '45'],
            ['Workout type', 'workout_type', 'text', 'Running'],
          ].map(([label, field, type, placeholder]) => (
            <div key={field}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#9ca0a4', marginBottom: 5 }}>{label.toUpperCase()}</label>
              <input className="input mono" type={type} value={form[field]} onChange={set(field)} placeholder={placeholder} />
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#9ca0a4', marginBottom: 5 }}>DURATION (MIN)</label>
            <input className="input mono" type="number" value={form.workout_duration_min} onChange={set('workout_duration_min')} placeholder="30" />
          </div>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: 16 }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save activity'}
        </button>
      </div>
    </div>
  )
}
