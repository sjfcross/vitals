import { useState } from 'react'
import { ComposedChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import dayjs from 'dayjs'

const RANGES = [
  { id: '1w', label: '1W', days: 7 },
  { id: '4w', label: '4W', days: 28 },
  { id: 'all', label: 'All', days: null },
]

export function Weight({ entries, latest, delta7, delta30, profile, onAdd, onDelete }) {
  const [kg, setKg] = useState('')
  const [time, setTime] = useState(dayjs().format('HH:mm'))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [range, setRange] = useState('1w')
  const [confirmId, setConfirmId] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  const height = profile?.height_cm
  const bmi = height && latest ? (latest.weight_kg / ((height / 100) ** 2)).toFixed(1) : null
  const bmiLabel = bmi
    ? bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese'
    : null

  const selectedRange = RANGES.find(r => r.id === range)
  const cutoff = selectedRange.days ? dayjs().subtract(selectedRange.days, 'day').format('YYYY-MM-DD') : null
  const filtered = cutoff ? entries.filter(e => e.date >= cutoff) : entries

  // One point per day (most recent reading if multiple)
  const uniqueDates = [...new Set(filtered.map(e => e.date))].sort()
  const lineData = uniqueDates.map(date => {
    const dayReadings = filtered
      .filter(e => e.date === date)
      .sort((a, b) => (b.time || '').localeCompare(a.time || ''))
    return { x: dayjs(date).valueOf(), kg: parseFloat(dayReadings[0].weight_kg) }
  })

  const xMax = dayjs().endOf('day').valueOf()
  const xMin = cutoff
    ? dayjs(cutoff).valueOf()
    : lineData.length > 0 ? lineData[0].x : dayjs().subtract(7, 'day').valueOf()

  const spanDays = selectedRange.days || (lineData.length > 1
    ? dayjs(xMax).diff(dayjs(lineData[0].x), 'day') : 28)
  const tickStep = spanDays <= 7 ? 1 : spanDays <= 28 ? 7 : spanDays <= 90 ? 14 : 30
  const xTicks = []
  let t = dayjs(xMin)
  while (t.valueOf() <= xMax) { xTicks.push(t.valueOf()); t = t.add(tickStep, 'day') }

  // Y axis: round to nearest 5 with padding
  const weights = lineData.map(d => d.kg)
  const rawMin = weights.length ? Math.min(...weights) : 60
  const rawMax = weights.length ? Math.max(...weights) : 100
  const pad = Math.max((rawMax - rawMin) * 0.3, 2)
  const yMin = Math.floor((rawMin - pad) / 5) * 5
  const yMax = Math.ceil((rawMax + pad) / 5) * 5
  const yTicks = []
  for (let v = yMin; v <= yMax; v += 5) yTicks.push(v)

  const renderTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const dateStr = dayjs(label).format('YYYY-MM-DD')
    const dayReadings = filtered.filter(e => e.date === dateStr)
    if (!dayReadings.length) return null
    return (
      <div style={{ background: '#1e2022', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem', fontFamily: 'DM Mono, monospace', minWidth: 120 }}>
        <div style={{ color: '#9ca0a4', marginBottom: 6, fontSize: '0.68rem' }}>{dayjs(label).format('MMM D, YYYY')}</div>
        {dayReadings.map((r, i) => (
          <div key={r.id} style={{ marginTop: i > 0 ? 6 : 0, paddingTop: i > 0 ? 6 : 0, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            {dayReadings.length > 1 && (
              <div style={{ color: '#6b6f73', fontSize: '0.62rem', marginBottom: 2 }}>{r.time?.slice(0, 5)}</div>
            )}
            <span style={{ color: '#f0c96a' }}>{parseFloat(r.weight_kg).toFixed(1)}</span>
            <span style={{ color: '#9ca0a4', fontSize: '0.68rem', marginLeft: 4 }}>kg</span>
          </div>
        ))}
      </div>
    )
  }

  async function handleSave() {
    if (!kg) return
    setSaving(true)
    try {
      await onAdd({
        date: dayjs().format('YYYY-MM-DD'),
        time: time || dayjs().format('HH:mm:ss'),
        weight_kg: parseFloat(kg),
      })
      setKg('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
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
        {latest && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '0.7rem', color: '#6b6f73' }}>
              {dayjs(latest.date).format('MMM D, YYYY')} at {latest.time?.slice(0, 5)}
            </div>
          </div>
        )}
      </div>

      {/* Deltas */}
      <div className="fade-up stagger-2" style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <DeltaCard label="7-DAY CHANGE" value={delta7} />
        <DeltaCard label="30-DAY CHANGE" value={delta30} />
      </div>

      {/* Chart */}
      {entries.length > 0 && (
        <div className="card fade-up stagger-3" style={{ padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em' }}>TREND</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {RANGES.map(r => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  style={{
                    padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', letterSpacing: '0.04em',
                    background: range === r.id ? 'rgba(240,201,106,0.18)' : 'transparent',
                    color: range === r.id ? '#f0c96a' : '#6b6f73',
                    transition: 'color 0.15s, background 0.15s',
                  }}
                >{r.label}</button>
              ))}
            </div>
          </div>
          {lineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={lineData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="x" type="number" scale="time"
                  domain={[xMin, xMax]} ticks={xTicks}
                  tickFormatter={ts => dayjs(ts).format('MMM D')}
                  tick={{ fontSize: 9, fill: '#6b6f73', fontFamily: 'DM Mono' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  yAxisId="left" orientation="left"
                  type="number" domain={[yMin, yMax]} ticks={yTicks}
                  tick={{ fontSize: 9, fill: '#6b6f73', fontFamily: 'DM Mono' }}
                  axisLine={false} tickLine={false} width={28}
                />
                <YAxis
                  yAxisId="right" orientation="right"
                  type="number" domain={[yMin, yMax]} ticks={yTicks}
                  tick={{ fontSize: 9, fill: '#6b6f73', fontFamily: 'DM Mono' }}
                  axisLine={false} tickLine={false} width={28}
                />
                {yTicks.map(v => (
                  <ReferenceLine key={v} yAxisId="left" y={v} stroke="rgba(255,255,255,0.05)" />
                ))}
                <Tooltip content={renderTooltip} />
                <Line
                  yAxisId="left" type="monotone" dataKey="kg" stroke="#f0c96a" strokeWidth={2}
                  dot={lineData.length === 1 ? { r: 4, fill: '#f0c96a' } : false}
                  activeDot={{ r: 4, fill: '#f0c96a' }}
                />
                <Line yAxisId="right" dataKey="kg" stroke="none" strokeWidth={0} dot={false} activeDot={false} legendType="none" tooltipType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#6b6f73' }}>No data for this range</span>
            </div>
          )}
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

      {/* History / manage entries */}
      {entries.length > 0 && (
        <div className="card fade-up stagger-4" style={{ padding: '16px', marginTop: 12 }}>
          <button
            onClick={() => { setShowHistory(v => !v); setConfirmId(null) }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em' }}>
              HISTORY &amp; EDIT <span style={{ color: '#6b6f73' }}>({entries.length})</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: '#6b6f73', transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
          </button>
          {showHistory && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
            {[...entries].reverse().map((e, i) => (
              <div
                key={e.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span className="mono" style={{ fontSize: '1rem', color: '#f0c96a' }}>
                    {parseFloat(e.weight_kg).toFixed(1)}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#9ca0a4' }}>kg</span>
                  <span style={{ fontSize: '0.72rem', color: '#6b6f73' }}>
                    {dayjs(e.date).format('MMM D, YYYY')}{e.time ? ` · ${e.time.slice(0, 5)}` : ''}
                  </span>
                </div>
                {confirmId === e.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => { onDelete(e.id); setConfirmId(null) }}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: '0.68rem', fontFamily: 'DM Mono, monospace',
                        background: 'rgba(232,120,74,0.18)', color: '#e8784a',
                      }}
                    >Delete</button>
                    <button
                      onClick={() => setConfirmId(null)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: '0.68rem', fontFamily: 'DM Mono, monospace',
                        background: 'transparent', color: '#6b6f73',
                      }}
                    >Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(e.id)}
                    aria-label="Delete entry"
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontSize: '0.82rem', lineHeight: 1, fontFamily: 'DM Mono, monospace',
                      background: 'transparent', color: '#6b6f73',
                    }}
                  >✕</button>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      )}
    </div>
  )
}
