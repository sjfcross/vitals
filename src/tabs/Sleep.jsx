import { useState, useRef } from 'react'
import dayjs from 'dayjs'
import { useWeekSleep } from '../hooks/useSleep'
import { useRecoveryTrends } from '../hooks/useRecoveryTrends'

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

  // SVG coordinate space
  const W       = 400
  const H       = 120
  const LABEL_W = 34   // left margin for Y labels
  const CHART_W = W - LABEL_W
  const ROW_H   = H / 4
  const ROW_PAD = 3
  // Center Y of each row (for connectors)
  const stageIdx = { AWAKE: 0, REM: 1, LIGHT: 2, DEEP: 3 }
  const rowCY = (type) => stageIdx[type] * ROW_H + ROW_H / 2

  // x position in chart space (offset by LABEL_W)
  const xPos = (ms) => LABEL_W + ((ms - startMs) / totalMs) * CHART_W

  // X-axis hour labels
  const firstHour = new Date(sleep.sleep_start)
  firstHour.setMinutes(0, 0, 0)
  firstHour.setHours(firstHour.getHours() + 1)
  const xLabels = []
  let t = firstHour.getTime()
  while (t < endMs) {
    const d = new Date(t)
    xLabels.push({ x: xPos(t), label: `${d.getHours()}:00` })
    t += 3600000
  }

  // Connector lines between consecutive stages
  const connectors = []
  for (let i = 0; i < sleep.stages.length - 1; i++) {
    const cur  = sleep.stages[i]
    const next = sleep.stages[i + 1]
    if (cur.type === next.type) continue
    const cx  = xPos(new Date(cur.endTime).getTime())
    const cy1 = rowCY(cur.type)
    const cy2 = rowCY(next.type)
    connectors.push({ x: cx, y1: cy1, y2: cy2 })
  }

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {STAGE_ORDER.map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLOR[s] }} />
            <span style={{ fontSize: '0.62rem', color: '#9ca0a4' }}>{STAGE_LABEL[s]}</span>
          </div>
        ))}
      </div>

      {/* Timeline SVG — Y labels baked in, no outside div */}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        {/* Background row stripes */}
        {STAGE_ORDER.map((s, i) => (
          <rect key={s} x={LABEL_W} y={i * ROW_H} width={CHART_W} height={ROW_H}
            fill={i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.045)'} />
        ))}

        {/* Y axis labels */}
        {STAGE_ORDER.map((s, i) => (
          <text key={s} x={LABEL_W - 4} y={i * ROW_H + ROW_H / 2 + 1}
            textAnchor="end" dominantBaseline="middle"
            fontSize="7" fill="#52575c" fontFamily="inherit">
            {STAGE_LABEL[s]}
          </text>
        ))}

        {/* Connector lines between stage transitions */}
        {connectors.map((c, i) => (
          <line key={i} x1={c.x} y1={c.y1} x2={c.x} y2={c.y2}
            stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
        ))}

        {/* Stage blocks */}
        {sleep.stages.map((seg, i) => {
          const x = xPos(new Date(seg.startTime).getTime())
          const w = (new Date(seg.endTime).getTime() - new Date(seg.startTime).getTime()) / totalMs * CHART_W
          const y = stageIdx[seg.type] * ROW_H
          return (
            <rect key={i} x={x} y={y + ROW_PAD} width={Math.max(w, 1)} height={ROW_H - ROW_PAD * 2}
              fill={STAGE_COLOR[seg.type] ?? '#666'} rx={2} opacity={0.9} />
          )
        })}

        {/* X axis labels */}
        {xLabels.map(({ x, label }) => (
          <text key={label} x={x} y={H + 10} textAnchor="middle"
            fontSize="7" fill="#52575c" fontFamily="inherit">
            {label}
          </text>
        ))}
      </svg>
    </div>
  )
}

// Header (total asleep + per-stage minutes) followed by the stage timeline.
// Reused by the main night card and the nap overlay.
function SleepDetail({ sleep }) {
  const asleepMin = sleep?.asleep_min ?? 0
  const deepMin   = sleep?.deep_min   ?? 0
  const remMin    = sleep?.rem_min    ?? 0
  const lightMin  = sleep?.light_min  ?? 0
  const awakeMin  = sleep?.awake_min  ?? 0

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="mono" style={{ fontSize: '2rem', fontWeight: 500, color: '#f0eeea', lineHeight: 1 }}>
            {fmt(asleepMin)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6b6f73', marginTop: 4 }}>
            {dayjs(sleep.sleep_start).format('h:mm A')} – {dayjs(sleep.sleep_end).format('h:mm A')}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', textAlign: 'right' }}>
          {[['Deep', deepMin, '#3a5fa8'], ['REM', remMin, '#5ba4e6'], ['Light', lightMin, '#b47fdb'], ['Awake', awakeMin, '#e8784a']].map(([label, min, color]) => (
            <div key={label}>
              <div className="mono" style={{ fontSize: '0.85rem', color, fontWeight: 500 }}>{fmt(min)}</div>
              <div style={{ fontSize: '0.6rem', color: '#6b6f73' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      <SleepTimeline sleep={sleep} />
    </>
  )
}

// Full-screen overlay listing every nap for the currently-open day.
function NapView({ naps, date, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, background: '#0e0f11',
      overflowY: 'auto', padding: '16px 16px 40px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: '1.05rem', color: '#f0eeea', fontWeight: 500 }}>
            {naps.length === 1 ? 'Nap' : 'Naps'} · {dayjs(date).format('MMM D, YYYY')}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#6b6f73', marginTop: 2 }}>
            {naps.length} daytime session{naps.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.74rem', color: '#9ca0a4', fontFamily: 'inherit' }}>
          ✕ Close
        </button>
      </div>

      {naps.map((nap, i) => (
        <div key={nap.id ?? i} className="card-lg" style={{ padding: 20, marginBottom: 12 }}>
          <div style={{ fontSize: '0.62rem', color: '#e8a04a', letterSpacing: '0.06em', marginBottom: 12 }}>
            ☀️ NAP {naps.length > 1 ? `${i + 1} OF ${naps.length}` : ''}
          </div>
          <SleepDetail sleep={nap} />
        </div>
      ))}
    </div>
  )
}

function TrendChart({ data, field, color, label, unit, decimals = 0 }) {
  const vals = data.map(d => d[field]).filter(v => v != null)
  if (vals.length < 2) return (
    <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '0.68rem', color: '#52575c' }}>Not enough data yet</span>
    </div>
  )

  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const W = 400
  const H = 56
  const PAD = 4

  const points = data
    .filter(d => d[field] != null)
    .map((d, i, arr) => {
      const x = PAD + (i / (arr.length - 1)) * (W - PAD * 2)
      const y = H - PAD - ((d[field] - min) / range) * (H - PAD * 2)
      return `${x},${y}`
    })
    .join(' ')

  const latest = vals[vals.length - 1]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
          <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
          {/* Last point dot */}
          {(() => {
            const last = points.split(' ').pop()
            const [x, y] = last.split(',')
            return <circle cx={x} cy={y} r="3" fill={color} />
          })()}
        </svg>
      </div>
      <div style={{ minWidth: 52, textAlign: 'right' }}>
        <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 500, color, lineHeight: 1 }}>
          {latest.toFixed(decimals)}
        </div>
        <div style={{ fontSize: '0.6rem', color: '#6b6f73', marginTop: 2 }}>{unit}</div>
      </div>
    </div>
  )
}

export function Sleep({ sleep, naps = [], date, today, onDateChange, onSync }) {
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [showNaps, setShowNaps] = useState(false)
  const dateInputRef = useRef(null)
  const napTotal = naps.reduce((sum, n) => sum + (n.asleep_min ?? 0), 0)
  const { weekData, reload: reloadWeek } = useWeekSleep(date)
  const { data: recoveryData } = useRecoveryTrends(date)
  const isToday = date === today

  function handleDateChange(newDate) { setShowNaps(false); onDateChange(newDate) }

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

  const BAR_MAX_H = 72  // px, represents 10h

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
          <SleepDetail sleep={sleep} />

          {/* Nap button — opens the nap overlay for this day.
              marginTop clears the timeline's overflowing x-axis labels; width ≈ 1/3 of the graph. */}
          {naps.length > 0 && (
            <button onClick={() => setShowNaps(true)}
              style={{
                width: '33%', marginTop: 34, padding: '9px 12px',
                background: 'rgba(232,160,74,0.10)', border: '1px solid rgba(232,160,74,0.28)',
                borderRadius: 10, cursor: 'pointer', color: '#e8a04a', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                whiteSpace: 'nowrap',
              }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>
                ☀️ {naps.length} {naps.length === 1 ? 'nap' : 'naps'} · {fmt(napTotal)}
              </span>
              <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>›</span>
            </button>
          )}
        </div>

        {/* Weekly bar */}
        <div className="card fade-up stagger-2" style={{ padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 12 }}>WEEK — SLEEP</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: BAR_MAX_H + 20 }}>
            {weekData.map((d, i) => {
              const min = d.asleep_min || 0
              const barH = min ? Math.max((min / 600) * BAR_MAX_H, 16) : 0
              const active = d.date === date
              const label = fmt(min)
              return (
                <div key={i} onClick={() => handleDateChange(d.date)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{
                    width: '100%', height: `${barH}px`,
                    background: active ? '#5ba4e6' : 'rgba(255,255,255,0.1)',
                    borderRadius: '4px 4px 0 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.18s',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {min > 0 && barH >= 18 && (
                      <span style={{
                        fontSize: '0.52rem', fontWeight: 600, lineHeight: 1,
                        color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
                        whiteSpace: 'nowrap',
                        writingMode: barH < 32 ? 'vertical-rl' : 'horizontal-tb',
                        transform: barH < 32 ? 'rotate(180deg)' : 'none',
                      }}>
                        {label}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.62rem', color: active ? '#5ba4e6' : '#6b6f73' }}>{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </>) : (
        <div className="card fade-up stagger-1" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: '#52575c', marginBottom: 16 }}>
            {naps.length > 0 ? 'No night sleep recorded — naps only' : 'No sleep data for this date'}
          </div>
          {naps.length > 0 ? (
            <button onClick={() => setShowNaps(true)}
              style={{ background: 'rgba(232,160,74,0.12)', border: '1px solid rgba(232,160,74,0.28)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: '0.8rem', color: '#e8a04a', fontFamily: 'inherit' }}>
              ☀️ View {naps.length} {naps.length === 1 ? 'nap' : 'naps'} · {fmt(napTotal)}
            </button>
          ) : (
            <button onClick={handleSync} disabled={syncing}
              style={{ background: 'rgba(91,164,230,0.12)', border: '1px solid rgba(91,164,230,0.25)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: '0.8rem', color: '#5ba4e6', fontFamily: 'inherit' }}>
              {syncing ? 'Syncing…' : 'Sync from Fitbit'}
            </button>
          )}
        </div>
      )}

      {/* Recovery trends — 30 days */}
      {recoveryData.length >= 2 && (
        <div className="card fade-up stagger-3" style={{ padding: '14px 16px', marginTop: 12 }}>
          <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 14 }}>RECOVERY — 30 DAYS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { field: 'hrv_rmssd',     color: '#b47fdb', label: 'HRV',       unit: 'ms RMSSD', decimals: 1 },
              { field: 'resting_hr_bpm',color: '#e87a8a', label: 'Resting HR', unit: 'bpm avg',  decimals: 0 },
            ].map(({ field, color, label, unit, decimals }) => {
              const hasData = recoveryData.some(d => d[field] != null)
              if (!hasData) return null
              return (
                <div key={field}>
                  <div style={{ fontSize: '0.62rem', color: '#6b6f73', marginBottom: 4, letterSpacing: '0.03em' }}>{label}</div>
                  <TrendChart data={recoveryData} field={field} color={color} label={label} unit={unit} decimals={decimals} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showNaps && naps.length > 0 && (
        <NapView naps={naps} date={date} onClose={() => setShowNaps(false)} />
      )}
    </div>
  )
}
