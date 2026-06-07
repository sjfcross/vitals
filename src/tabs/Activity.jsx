import { useState, useEffect, useRef, useMemo } from 'react'
import { BarChart, Bar, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import dayjs from 'dayjs'
import { useWeekActivity } from '../hooks/useActivity'
import { useHeartRateIntraday } from '../hooks/useHeartRateIntraday'

function HrTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { x, bpm } = payload[0].payload
  const d = new Date(x)
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: '#1e2022', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', fontSize: '0.75rem' }}>
      <div className="mono" style={{ color: '#e87a8a' }}>{bpm} bpm</div>
      <div style={{ color: '#9ca0a4', marginTop: 2 }}>{timeStr}</div>
    </div>
  )
}

function formatHrTick(ts) {
  const d = new Date(ts)
  const h = d.getHours()
  const hh = String(h).padStart(2, '0')
  return h === 0 ? `${d.toLocaleDateString([], { weekday: 'short' })} 00` : `${hh}:00`
}

export function Activity({ activity, profile, date, today, onSave, onDateChange, onSync, onSyncHr }) {
  const [form, setForm] = useState({
    steps: activity?.steps || '',
    km: activity?.km || '',
    active_minutes: activity?.active_minutes || '',
    workout_type: activity?.workout_type || '',
    workout_duration_min: activity?.workout_duration_min || '',
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [hrSyncing, setHrSyncing] = useState(false)
  const [hrSyncMsg, setHrSyncMsg] = useState(null)
  const dateInputRef = useRef(null)
  const { weekData, reload: reloadWeek } = useWeekActivity(date)
  const { hrData, reload: reloadHr } = useHeartRateIntraday()
  const isToday = date === today

  useEffect(() => {
    setForm({
      steps: activity?.steps || '',
      km: activity?.km || '',
      active_minutes: activity?.active_minutes || '',
      workout_type: activity?.workout_type || '',
      workout_duration_min: activity?.workout_duration_min || '',
    })
    setDirty(false)
  }, [activity])

  const steps = activity?.steps || 0
  const target = profile?.target_steps || 10000

  function set(field) {
    return e => {
      setForm(f => ({ ...f, [field]: e.target.value }))
      setDirty(true)
    }
  }

  function handleDateChange(newDate) {
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return
    onDateChange(newDate)
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await onSave({
      steps: form.steps ? parseInt(form.steps) : null,
      km: form.km ? parseFloat(form.km) : null,
      active_minutes: form.active_minutes ? parseInt(form.active_minutes) : null,
      workout_type: form.workout_type || null,
      workout_duration_min: form.workout_duration_min ? parseInt(form.workout_duration_min) : null,
    })
    setSaving(false)
    if (!error) {
      setDirty(false)
      setSaved(true)
      reloadWeek()
      setTimeout(() => setSaved(false), 2000)
    } else {
      console.error('VITALS: save activity error', error)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const data = await onSync()
      setSyncMsg(data.synced > 0 ? `Synced ${data.synced} day${data.synced !== 1 ? 's' : ''}` : 'No new data')
      reloadWeek()
    } catch (err) {
      setSyncMsg('Sync failed')
      console.error('VITALS: sync error', err)
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 3000)
    }
  }

  async function handleSyncHr() {
    setHrSyncing(true)
    setHrSyncMsg(null)
    try {
      const data = await onSyncHr()
      setHrSyncMsg(data.inserted > 0 ? `+${data.inserted} pts` : 'Up to date')
      reloadHr()
    } catch (err) {
      setHrSyncMsg('Failed')
      console.error('VITALS: HR sync error', err)
    } finally {
      setHrSyncing(false)
      setTimeout(() => setHrSyncMsg(null), 3000)
    }
  }

  // Generate 6h-aligned ticks across the 48h window
  const hrTicks = useMemo(() => {
    if (!hrData.length) return []
    const sixH = 6 * 60 * 60 * 1000
    const start = hrData[0].x
    const end = hrData[hrData.length - 1].x
    const ticks = []
    const first = Math.ceil(start / sixH) * sixH
    for (let t = first; t <= end; t += sixH) ticks.push(t)
    return ticks
  }, [hrData])

  const hrDomain = useMemo(() => {
    if (!hrData.length) return [40, 120]
    const bpms = hrData.map(d => d.bpm)
    const lo = Math.floor(Math.min(...bpms) / 10) * 10 - 10
    const hi = Math.ceil(Math.max(...bpms) / 10) * 10 + 10
    return [Math.max(0, lo), hi]
  }, [hrData])

  return (
    <div style={{ padding: '16px 16px 100px' }}>

      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono" style={{ fontSize: '0.78rem', color: isToday ? '#b47fdb' : '#9ca0a4', letterSpacing: '0.04em' }}>
            {isToday ? 'TODAY' : dayjs(date).format('MMM D, YYYY')}
          </span>
          <button
            onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: '0.72rem', color: '#9ca0a4', lineHeight: 1.4 }}
            title="Pick a date"
          >
            📅
          </button>
          <input
            ref={dateInputRef}
            type="date"
            max={today}
            value={date}
            onChange={e => e.target.value && handleDateChange(e.target.value)}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isToday && (
            <button
              onClick={() => handleDateChange(today)}
              style={{ background: 'none', border: '1px solid rgba(180,127,219,0.35)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontSize: '0.68rem', color: '#b47fdb', letterSpacing: '0.04em' }}
            >
              Back to today
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '3px 9px', cursor: syncing ? 'default' : 'pointer', fontSize: '0.68rem', color: syncMsg ? '#7ec87e' : '#9ca0a4', letterSpacing: '0.04em', opacity: syncing ? 0.6 : 1 }}
          >
            {syncing ? 'Syncing…' : syncMsg ?? 'Sync Fitbit'}
          </button>
        </div>
      </div>

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
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div className="mono" style={{ fontSize: '1rem', color: '#b47fdb' }}>
              {activity?.km ? `${activity.km} km` : `${(steps * 0.00075).toFixed(2)} km`}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca0a4' }}>
              {activity?.active_minutes ? `${activity.active_minutes} active min` : '—'}
            </div>
          </div>
          {activity?.resting_hr_bpm != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <span style={{ fontSize: '0.72rem', color: '#e87a8a' }}>♥</span>
              <span className="mono" style={{ fontSize: '0.85rem', color: '#e87a8a' }}>{activity.resting_hr_bpm}</span>
              <span style={{ fontSize: '0.68rem', color: '#6b6f73' }}>bpm resting</span>
            </div>
          )}
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

      {/* Heart rate 48h chart */}
      <div className="card fade-up stagger-3" style={{ padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em' }}>HEART RATE — 48H</div>
          <button
            onClick={handleSyncHr}
            disabled={hrSyncing}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '3px 9px', cursor: hrSyncing ? 'default' : 'pointer', fontSize: '0.68rem', color: hrSyncMsg ? '#7ec87e' : '#9ca0a4', letterSpacing: '0.04em', opacity: hrSyncing ? 0.6 : 1 }}
          >
            {hrSyncing ? 'Syncing…' : hrSyncMsg ?? 'Sync HR'}
          </button>
        </div>

        {hrData.length === 0 ? (
          <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#6b6f73' }}>No HR data yet — tap Sync HR</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={hrData} margin={{ top: 4, bottom: 0, left: -20, right: 4 }}>
              <defs>
                <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e87a8a" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#e87a8a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="x"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                ticks={hrTicks}
                tickFormatter={formatHrTick}
                tick={{ fill: '#6b6f73', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={hrDomain}
                tick={{ fill: '#6b6f73', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickCount={4}
              />
              <Tooltip content={<HrTooltip />} />
              <Area
                type="monotoneX"
                dataKey="bpm"
                stroke="#e87a8a"
                strokeWidth={1.5}
                fill="url(#hrGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Entry form */}
      <div className="card fade-up stagger-4" style={{ padding: '16px' }}>
        <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 14 }}>{isToday ? 'LOG ACTIVITY' : `${dayjs(date).format('MMM D').toUpperCase()} — ACTIVITY`}</div>
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
