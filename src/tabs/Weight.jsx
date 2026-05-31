import { useState } from 'react'
import { LineChart, Line, XAxis, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts'
import dayjs from 'dayjs'

export function Weight({ entries, latest, delta7, delta30, profile, onAdd }) {
  const [kg, setKg] = useState('')
  const [time, setTime] = useState(dayjs().format('HH:mm'))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const height = profile?.height_cm
  const bmi = height && latest ? (latest.weight_kg / ((height / 100) ** 2)).toFixed(1) : null
  const bmiLabel = bmi
    ? bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese'
    : null

  const chartData = entries.map(e => ({
    date: dayjs(e.date).format('MMM D'),
    kg: parseFloat(e.weight_kg),
  }))

  const weights = entries.map(e => parseFloat(e.weight_kg))
  const minW = weights.length ? Math.min(...weights) - 0.5 : 0
  const maxW = weights.length ? Math.max(...weights) + 0.5 : 100

  async function handleSave() {
    if (!kg) return
    setSaving(true)
    await onAdd({
      date: dayjs().format('YYYY-MM-DD'),
      time: time || dayjs().format('HH:mm:ss'),
      weight_kg: parseFloat(kg),
    })
    setKg('')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const DeltaCard = ({ label, value }) => (
    <div className="card" style={{ padding: '14px 16px', flex: 1 }}>
      <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: '1.4rem', color: value === null ? '#6b6f73' : parseFloat(value) <= 0 ? '#6ec87a' : '#e8784a' }}>
        {value === null ? '–' : `${parseFloat(value) > 0 ? '+' : ''}${value} kg`}
      </div>
    </div>
  )

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      {/* Current weight */}
      <div className="card-lg fade-up stagger-1" style={{ padding: '20px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 6 }}>CURRENT WEIGHT</div>
            <div className="mono" style={{ fontSize: '2.5rem', fontWeight: 500, color: '#f0c96a', lineHeight: 1 }}>
              {latest ? latest.weight_kg : '–'}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca0a4', marginTop: 4 }}>kg</div>
          </div>
          {bmi && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 6 }}>BMI</div>
              <div className="mono" style={{ fontSize: '1.8rem', color: '#f0eeea', lineHeight: 1 }}>{bmi}</div>
              <div style={{ fontSize: '0.72rem', color: '#9ca0a4', marginTop: 4 }}>{bmiLabel}</div>
            </div>
          )}
        </div>
      </div>

      {/* Deltas */}
      <div className="fade-up stagger-2" style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <DeltaCard label="7-DAY CHANGE" value={delta7} />
        <DeltaCard label="30-DAY CHANGE" value={delta30} />
      </div>

      {/* Line chart */}
      {chartData.length > 1 && (
        <div className="card fade-up stagger-3" style={{ padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 12 }}>30-DAY TREND</div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b6f73', fontFamily: 'DM Mono' }} axisLine={false} tickLine={false}
                interval={Math.floor(chartData.length / 5)} />
              <Tooltip
                contentStyle={{ background: '#1e2022', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.78rem', fontFamily: 'DM Mono' }}
                labelStyle={{ color: '#9ca0a4' }}
                itemStyle={{ color: '#f0c96a' }}
                formatter={v => [`${v} kg`, '']}
              />
              <Line type="monotone" dataKey="kg" stroke="#f0c96a" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#f0c96a' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Entry form */}
      <div className="card fade-up stagger-4" style={{ padding: '16px' }}>
        <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 14 }}>LOG WEIGHT</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#9ca0a4', marginBottom: 5 }}>WEIGHT (KG)</label>
            <input className="input mono" type="number" step="0.1" value={kg} onChange={e => setKg(e.target.value)} placeholder="72.5" autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#9ca0a4', marginBottom: 5 }}>TIME</label>
            <input className="input mono" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving || !kg} style={{ marginTop: 16 }}>
          {saving ? 'Saving…' : saved ? '✓ Logged' : 'Log weight'}
        </button>
      </div>
    </div>
  )
}
