import { useState } from 'react'
import { ComposedChart, Line, Scatter, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'
import dayjs from 'dayjs'
import { DoctorView } from '../components/DoctorView'

const RANGES = [
  { id: '1w', label: '1W', days: 7 },
  { id: '4w', label: '4W', days: 28 },
  { id: 'all', label: 'All', days: null },
]


function classifyBP(sys, dia) {
  if (sys > 180 || dia > 120) return { label: 'Hypertensive Crisis', color: '#ff5a5a' }
  if (sys >= 140 || dia >= 90) return { label: 'High (Stage 2)', color: '#e8784a' }
  if (sys >= 130 || dia >= 80) return { label: 'High (Stage 1)', color: '#f0c96a' }
  if (sys >= 120 && dia < 80) return { label: 'Elevated', color: '#f0c96a' }
  return { label: 'Normal', color: '#6ec87a' }
}


export function BloodPressure({ entries, latest, onAdd }) {
  const [sys, setSys] = useState('')
  const [dia, setDia] = useState('')
  const [pulse, setPulse] = useState('')
  const [time, setTime] = useState(dayjs().format('HH:mm'))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [range, setRange] = useState('1w')
  const [doctorView, setDoctorView] = useState(false)

  const classification = latest ? classifyBP(latest.systolic, latest.diastolic) : null

  const selectedRange = RANGES.find(r => r.id === range)
  const cutoff = selectedRange.days ? dayjs().subtract(selectedRange.days, 'day').format('YYYY-MM-DD') : null
  const filtered = cutoff ? entries.filter(e => e.date >= cutoff) : entries

  // One data point per day for the line (first reading of the day)
  const uniqueDates = [...new Set(filtered.map(e => e.date))].sort()
  const lineData = uniqueDates.map(date => {
    const dayReadings = filtered
      .filter(e => e.date === date)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    return { x: dayjs(date).valueOf(), sys: dayReadings[0].systolic, dia: dayReadings[0].diastolic }
  })

  // Extra readings (2nd+ per day) as scatter dots
  const extraSys = [], extraDia = []
  uniqueDates.forEach(date => {
    const dayReadings = filtered
      .filter(e => e.date === date)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    dayReadings.slice(1).forEach(r => {
      extraSys.push({ x: dayjs(date).valueOf(), y: r.systolic })
      extraDia.push({ x: dayjs(date).valueOf(), y: r.diastolic })
    })
  })

  // Stable X-axis domain covering the full selected range
  const xMax = dayjs().endOf('day').valueOf()
  const xMin = cutoff
    ? dayjs(cutoff).valueOf()
    : lineData.length > 0 ? lineData[0].x : dayjs().subtract(7, 'day').valueOf()

  // Tick interval: daily for 1W, weekly for 4W+, auto for All
  const spanDays = selectedRange.days || (lineData.length > 1
    ? dayjs(xMax).diff(dayjs(lineData[0].x), 'day') : 7)
  const tickStep = spanDays <= 7 ? 1 : spanDays <= 28 ? 7 : spanDays <= 90 ? 14 : 30
  const xTicks = []
  let t = dayjs(xMin)
  while (t.valueOf() <= xMax) { xTicks.push(t.valueOf()); t = t.add(tickStep, 'day') }

  const yMin = 60
  const yMax = 220
  const yTicks = [60, 100, 140, 180, 220]

  const renderTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const dateStr = dayjs(label).format('YYYY-MM-DD')
    const dayReadings = filtered
      .filter(e => e.date === dateStr)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    if (!dayReadings.length) return null
    return (
      <div style={{ background: '#1e2022', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem', fontFamily: 'DM Mono, monospace', minWidth: 140 }}>
        <div style={{ color: '#9ca0a4', marginBottom: 6, fontSize: '0.68rem' }}>{dayjs(label).format('MMM D, YYYY')}</div>
        {dayReadings.map((r, i) => (
          <div key={r.id} style={{ marginTop: i > 0 ? 6 : 0, paddingTop: i > 0 ? 6 : 0, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <div style={{ color: '#6b6f73', fontSize: '0.62rem', marginBottom: 2 }}>{r.time?.slice(0, 5)}</div>
            <div>
              <span style={{ color: '#e87a8a' }}>{r.systolic}</span>
              <span style={{ color: '#6b6f73', margin: '0 2px' }}>/</span>
              <span style={{ color: '#5ba4e6' }}>{r.diastolic}</span>
              <span style={{ color: '#9ca0a4', fontSize: '0.68rem', marginLeft: 4 }}>mmHg</span>
              {r.pulse && <span style={{ color: '#9ca0a4', fontSize: '0.68rem', marginLeft: 6 }}>{r.pulse} bpm</span>}
            </div>
          </div>
        ))}
      </div>
    )
  }

  async function handleSave() {
    if (!sys || !dia) return
    setSaving(true)
    try {
      await onAdd({
        date: dayjs().format('YYYY-MM-DD'),
        time: time || dayjs().format('HH:mm:ss'),
        systolic: parseInt(sys, 10),
        diastolic: parseInt(dia, 10),
        pulse: pulse ? parseInt(pulse, 10) : null,
        notes: notes.trim() || null,
      })
      setSys('')
      setDia('')
      setPulse('')
      setNotes('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      {/* Latest reading */}
      <div className="card-lg fade-up stagger-1" style={{ padding: '20px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 6 }}>LATEST READING</div>
            {latest ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, lineHeight: 1 }}>
                  <span className="mono" style={{ fontSize: '2.5rem', fontWeight: 500, color: '#e87a8a' }}>{latest.systolic}</span>
                  <span className="mono" style={{ fontSize: '1.4rem', color: '#6b6f73', margin: '0 4px' }}>/</span>
                  <span className="mono" style={{ fontSize: '2.5rem', fontWeight: 500, color: '#5ba4e6' }}>{latest.diastolic}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9ca0a4', marginTop: 4 }}>mmHg</div>
              </>
            ) : (
              <div className="mono" style={{ fontSize: '2rem', color: '#6b6f73', lineHeight: 1 }}>–/–</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            {latest?.pulse && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 4 }}>PULSE</div>
                <div className="mono" style={{ fontSize: '1.4rem', color: '#f0eeea', lineHeight: 1 }}>{latest.pulse}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca0a4', marginTop: 2 }}>bpm</div>
              </div>
            )}
            {classification && (
              <div>
                <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 4 }}>STATUS</div>
                <div style={{ fontSize: '0.78rem', color: classification.color, fontWeight: 600 }}>{classification.label}</div>
              </div>
            )}
          </div>
        </div>
        {latest && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '0.7rem', color: '#6b6f73' }}>
              {dayjs(latest.date).format('MMM D, YYYY')} at {latest.time?.slice(0, 5)}
            </div>
            {latest.notes && (
              <div style={{ fontSize: '0.75rem', color: '#9ca0a4', marginTop: 5, fontStyle: 'italic' }}>
                {latest.notes}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      {entries.length > 0 && (
        <div className="card fade-up stagger-2" style={{ padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em' }}>TREND</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 2, background: '#e87a8a', borderRadius: 1 }} />
                  <span style={{ fontSize: '0.65rem', color: '#9ca0a4' }}>SYS</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 2, background: '#5ba4e6', borderRadius: 1 }} />
                  <span style={{ fontSize: '0.65rem', color: '#9ca0a4' }}>DIA</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {RANGES.map(r => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  style={{
                    padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', letterSpacing: '0.04em',
                    background: range === r.id ? 'rgba(232,122,138,0.18)' : 'transparent',
                    color: range === r.id ? '#e87a8a' : '#6b6f73',
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
                  yAxisId="left" orientation="left" mirror={false}
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
                <ReferenceLine yAxisId="left" y={60}  stroke="rgba(255,255,255,0.05)" />
                <ReferenceLine yAxisId="left" y={100} stroke="rgba(255,255,255,0.05)" />
                <ReferenceLine yAxisId="left" y={140} stroke="rgba(255,255,255,0.05)" />
                <ReferenceLine yAxisId="left" y={180} stroke="rgba(255,255,255,0.05)" />
                <ReferenceLine yAxisId="left" y={220} stroke="rgba(255,255,255,0.05)" />
                <Tooltip content={renderTooltip} />
                <Line yAxisId="left" type="monotone" dataKey="sys" stroke="#e87a8a" strokeWidth={2}
                  dot={lineData.length === 1 ? { r: 4, fill: '#e87a8a' } : false}
                  activeDot={{ r: 4, fill: '#e87a8a' }} />
                <Line yAxisId="left" type="monotone" dataKey="dia" stroke="#5ba4e6" strokeWidth={2}
                  dot={lineData.length === 1 ? { r: 4, fill: '#5ba4e6' } : false}
                  activeDot={{ r: 4, fill: '#5ba4e6' }} />
                <Line yAxisId="right" dataKey="sys" stroke="none" strokeWidth={0} dot={false} activeDot={false} legendType="none" tooltipType="none" />
                {extraSys.length > 0 && <Scatter yAxisId="left" data={extraSys} dataKey="y" fill="#e87a8a" opacity={0.35} name="Sys+" shape={({ cx, cy }) => <circle cx={cx} cy={cy} r={2.5} fill="#e87a8a" opacity={0.45} />} />}
                {extraDia.length > 0 && <Scatter yAxisId="left" data={extraDia} dataKey="y" fill="#5ba4e6" opacity={0.35} name="Dia+" shape={({ cx, cy }) => <circle cx={cx} cy={cy} r={2.5} fill="#5ba4e6" opacity={0.45} />} />}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#6b6f73' }}>No data for this range</span>
            </div>
          )}
          {(extraSys.length > 0 || extraDia.length > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca0a4', opacity: 0.5 }} />
              <span style={{ fontSize: '0.62rem', color: '#6b6f73', letterSpacing: '0.03em' }}>consecutive same-day readings</span>
            </div>
          )}
        </div>
      )}

      {/* Log form */}
      <div className="card fade-up stagger-3" style={{ padding: '16px', marginBottom: 12 }}>
        <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 14 }}>LOG READING</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#9ca0a4', marginBottom: 5 }}>SYSTOLIC</label>
            <input className="input mono" type="number" value={sys} onChange={e => setSys(e.target.value)} placeholder="120" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#9ca0a4', marginBottom: 5 }}>DIASTOLIC</label>
            <input className="input mono" type="number" value={dia} onChange={e => setDia(e.target.value)} placeholder="80" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#9ca0a4', marginBottom: 5 }}>PULSE (BPM)</label>
            <input className="input mono" type="number" value={pulse} onChange={e => setPulse(e.target.value)} placeholder="72" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#9ca0a4', marginBottom: 5 }}>TIME</label>
            <input className="input mono" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: '#9ca0a4', marginBottom: 5 }}>NOTES (optional)</label>
          <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. felt stressed, after exercise…" style={{ resize: 'none' }} />
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving || !sys || !dia} style={{ marginTop: 4 }}>
          {saving ? 'Saving…' : saved ? '✓ Logged' : 'Log reading'}
        </button>
      </div>

      {/* Doctor view button */}
      {entries.length > 0 && (
        <button
          onClick={() => setDoctorView(true)}
          style={{
            width: '100%', padding: '13px', borderRadius: 12, border: '1px solid rgba(91,164,230,0.3)',
            background: 'rgba(91,164,230,0.07)', color: '#5ba4e6', fontSize: '0.85rem',
            fontFamily: 'inherit', cursor: 'pointer', marginBottom: 12, letterSpacing: '0.02em',
          }}
        >
          Show at Doctor ›
        </button>
      )}

      {/* Recent readings */}
      {entries.length > 0 && (
        <div className="card fade-up stagger-4" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 12 }}>RECENT READINGS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[...entries].reverse().slice(0, 8).map((e, i) => {
              const cls = classifyBP(e.systolic, e.diastolic)
              return (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: i < Math.min(entries.length, 8) - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: '1rem', lineHeight: 1 }}>
                      <span style={{ color: '#e87a8a' }}>{e.systolic}</span>
                      <span style={{ color: '#6b6f73', margin: '0 3px' }}>/</span>
                      <span style={{ color: '#5ba4e6' }}>{e.diastolic}</span>
                      {e.pulse && <span style={{ color: '#9ca0a4', fontSize: '0.8rem', marginLeft: 8 }}>{e.pulse} bpm</span>}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#6b6f73', marginTop: 3 }}>
                      {dayjs(e.date).format('MMM D')} · {e.time?.slice(0, 5)}
                    </div>
                    {e.notes && (
                      <div style={{ fontSize: '0.72rem', color: '#9ca0a4', marginTop: 4, fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {e.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: cls.color }}>{cls.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {doctorView && <DoctorView entries={entries} onClose={() => setDoctorView(false)} />}
    </div>
  )
}
