import { useState } from 'react'
import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'
import dayjs from 'dayjs'

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
  const [range, setRange] = useState('4w')

  const classification = latest ? classifyBP(latest.systolic, latest.diastolic) : null

  const selectedRange = RANGES.find(r => r.id === range)
  const cutoff = selectedRange.days ? dayjs().subtract(selectedRange.days, 'day').format('YYYY-MM-DD') : null
  const filtered = cutoff ? entries.filter(e => e.date >= cutoff) : entries

  const chartData = filtered.map(e => ({
    date: dayjs(e.date).format('MMM D'),
    sys: e.systolic,
    dia: e.diastolic,
  }))

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
      {entries.length > 1 && (
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
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b6f73', fontFamily: 'DM Mono' }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 5) - 1)} />
                <ReferenceLine y={120} stroke="rgba(240,201,106,0.2)" strokeDasharray="3 3" />
                <ReferenceLine y={80} stroke="rgba(91,164,230,0.2)" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{ background: '#1e2022', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.78rem', fontFamily: 'DM Mono' }}
                  labelStyle={{ color: '#9ca0a4' }}
                  formatter={(v, name) => [`${v} mmHg`, name === 'sys' ? 'Systolic' : 'Diastolic']}
                  itemStyle={{ color: '#f0eeea' }}
                />
                <Line type="monotone" dataKey="sys" stroke="#e87a8a" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#e87a8a' }} />
                <Line type="monotone" dataKey="dia" stroke="#5ba4e6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#5ba4e6' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#6b6f73' }}>Not enough data for this range</span>
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
    </div>
  )
}
