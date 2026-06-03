import { useState, useRef } from 'react'
import dayjs from 'dayjs'
import { useWeekSleep } from '../hooks/useSleep'

const STAGE_ORDER = ['AWAKE', 'REM', 'LIGHT', 'DEEP']
const STAGE_COLOR = {
  AWAKE: '#e8784a',
  REM:   '#5ba4e6',
  LIGHT: '#b47fdb',
  DEEP:  '#3a5fa8',
}
const STAGE_LABEL = {
  AWAKE: 'Awake',
  REM:   'REM',
  LIGHT: 'Light',
  DEEP:  'Deep',
}

function fmt(min) {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function SleepTimeline({ sleep }) {
  if (!sleep?.stages?.length) return null

  const startMs = new Date(sleep.sleep_start).getTime()
  const endMs   = new Date(sleep.sleep_end).getTime()
  const totalMs = endMs - startMs
  const CHART_H = 100
  const ROW_H   = CHART_H / 4
  const stageY  = { AWAKE: 0, REM: ROW_H, LIGHT: ROW_H * 2, DEEP: ROW_H * 3 }

  // X-axis hour labels
  const startHour = new Date(sleep.sleep_start)
  startHour.setMinutes(0, 0, 0)
  startHour.setHours(startHour.getHours() + 1)
  const labels = []
  let t = startHour.getTime()
  while (t < endMs) {
    const pct = ((t - startMs) / totalMs) * 100
    const d = new Date(t)
    labels.push({ pct, label: `${d.getHours()}:00` })
    t += 3600000
  }

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Stage row labels */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {STAGE_ORDER.map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLOR[s] }} />
            <span style={{ fontSize: '0.62rem', color: '#9ca0a4' }}>{STAGE_LABEL[s]}</span>
          </div>
        ))}
      </div>

      {/* Timeline SVG */}
      <div style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 400 ${CHART_H}`} preserveAspectRatio="none" style={{ display: 'block', borderRadius: 6, overflow: 'hidden' }}>
          {/* Background rows */}
          {STAGE_ORDER.map((s, i) => (
            <rect key={s} x={0} y={i * ROW_H} width={400} height={ROW_H} fill={i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)'} />
          ))}

          {/* Stage segments */}
          {sleep.stages.map((seg, i) => {
            const x = ((new Date(seg.startTime).getTime() - startMs) / totalMs) * 400
            const w = ((new Date(seg.endTime).getTime() - new Date(seg.startTime).getTime()) / totalMs) * 400
            const y = stageY[seg.type] ?? 0
            return (
              <rect key={i} x={x} y={y + 2} width={Math.max(w, 1)} height={ROW_H - 4}
                fill={STAGE_COLOR[seg.type] ?? '#666'} rx={2} opacity={0.9} />
            )
          })}
        </svg>

        {/* Y axis labels */}
        <div style={{ position: 'absolute', right: -32, top: 0, height: CHART_H, display: 'flex', flexDirection: 'column' }}>
          {STAGE_ORDER.map(s => (
            <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '0.52rem', color: '#52575c', whiteSpace: 'nowrap' }}>{STAGE_LABEL[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* X axis labels */}
      <div style={{ position: 'relative', height: 18, marginTop: 4 }}>
        {labels.map(({ pct, label }) => (
          <span key={label} style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', fontSize: '0.58rem', color: '#52575c' }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Sleep({ sleep, date, today, onDateChange, onSync }) {
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const dateInputRef = useRef(null)
  const { weekData, reload: reloadWeek } = useWeekSleep(date)
  const isToday = date === today

  function handleDateChange(newDate) { onDateChange(newDate) }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const data = await onSync()
      setSyncMsg(data.synced > 0 ? `Synced ${data.synced} night${data.synced !== 1 ? 's' : ''}` : 'No new data')
      reloadWeek()
    } catch (err) {
      setSyncMsg('Sync failed')
      console.error('VITALS: sync sleep error', err)
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 3000)
    }
  }

  const asleepMin  = sleep?.asleep_min  ?? 0
  const deepMin    = sleep?.deep_min    ?? 0
  const remMin     = sleep?.rem_min     ?? 0
  const lightMin   = sleep?.light_min   ?? 0
  const awakeMin   = sleep?.awake_min   ?? 0
  const totalMin   = sleep?.duration_min ?? 0

  return (
    <div style={{ padding: '16px 16px 100px' }}>

      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono" style={{ fontSize: '0.78rem', color: isToday ? '#5ba4e6' : '#9ca0a4', letterSpacing: '0.04em' }}>
            {isToday ? 'TODAY' : dayjs(date).format('MMM D, YYYY')}
          </span>
          <button
            onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: '0.72rem', color: '#9ca0a4', lineHeight: 1.4 }}
          >📅</button>
          <input ref={dateInputRef} type="date" max={today} value={date}
            onChange={e => e.target.value && handleDateChange(e.target.value)}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isToday && (
            <button onClick={() => handleDateChange(today)}
              style={{ background: 'none', border: '1px solid rgba(91,164,230,0.35)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontSize: '0.68rem', color: '#5ba4e6', letterSpacing: '0.04em' }}>
              Back to today
            </button>
          )}
          <button onClick={handleSync} disabled={syncing}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '3px 9px', cursor: syncing ? 'default' : 'pointer', fontSize: '0.68rem', color: syncMsg ? '#7ec87e' : '#9ca0a4', letterSpacing: '0.04em', opacity: syncing ? 0.6 : 1 }}>
            {syncing ? 'Syncing…' : syncMsg ?? 'Sync Fitbit'}
          </button>
        </div>
      </div>

      {sleep ? (<>
        {/* Summary card */}
        <div className="card-lg fade-up stagger-1" style={{ padding: '20px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div className="mono" style={{ fontSize: '2rem', fontWeight: 500, color: '#f0eeea', lineHeight: 1 }}>
                {fmt(asleepMin)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6b6f73', marginTop: 4 }}>
                {dayjs(sleep.sleep_start).format('h:mm A')} – {dayjs(sleep.sleep_end).format('h:mm A')}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', textAlign: 'right' }}>
              {[['Deep', deepMin, '#3a5fa8'], ['REM', remMin, '#5ba4e6'], ['Light', lightMin, '#b47fdb'], ['Awake', awakeMin, '#e8784a']].map(([label, min, color]) => (
                <div key={label}>
                  <div className="mono" style={{ fontSize: '0.85rem', color, fontWeight: 500 }}>{fmt(min)}</div>
                  <div style={{ fontSize: '0.6rem', color: '#6b6f73' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stage proportion bar */}
          {totalMin > 0 && (
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 16, gap: 1 }}>
              {[['DEEP', deepMin, '#3a5fa8'], ['REM', remMin, '#5ba4e6'], ['LIGHT', lightMin, '#b47fdb'], ['AWAKE', awakeMin, '#e8784a']].map(([stage, min, color]) =>
                min > 0 ? <div key={stage} style={{ flex: min, background: color }} /> : null
              )}
            </div>
          )}

          <SleepTimeline sleep={sleep} />
        </div>

        {/* Weekly bar */}
        <div className="card fade-up stagger-2" style={{ padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 12 }}>WEEK — SLEEP</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
            {weekData.map((d, i) => {
              const h = d.asleep_min ? (d.asleep_min / 600) * 60 : 0
              const active = d.date === date
              return (
                <div key={i} onClick={() => handleDateChange(d.date)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <div style={{ width: '100%', height: `${h}px`, background: active ? '#5ba4e6' : 'rgba(255,255,255,0.1)', borderRadius: '3px 3px 0 0', transition: 'background 0.18s' }} />
                  <span style={{ fontSize: '0.62rem', color: active ? '#5ba4e6' : '#6b6f73' }}>{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </>) : (
        <div className="card fade-up stagger-1" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: '#52575c', marginBottom: 16 }}>No sleep data for this date</div>
          <button onClick={handleSync} disabled={syncing}
            style={{ background: 'rgba(91,164,230,0.12)', border: '1px solid rgba(91,164,230,0.25)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: '0.8rem', color: '#5ba4e6', fontFamily: 'inherit' }}>
            {syncing ? 'Syncing…' : 'Sync from Fitbit'}
          </button>
        </div>
      )}
    </div>
  )
}
