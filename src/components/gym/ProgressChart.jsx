import { ComposedChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import dayjs from 'dayjs'
import { fmtKg } from '../../lib/gymLogic'
import { C, tooltipBox } from './gymStyles'

// Per-session best estimated 1RM (solid) and top-set weight (dashed) for one exercise.
// One y-axis: both series are kilograms. Dashed vs solid keeps them apart without colour.
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={tooltipBox}>
      <div style={{ color: C.muted, marginBottom: 6, fontSize: '0.68rem' }}>{dayjs(d.x).format('ddd, MMM D')}</div>
      {d.e1rm != null && <div style={{ color: C.text }}><span style={{ color: C.accent }}>●</span> e1RM {fmtKg(d.e1rm)} kg</div>}
      <div style={{ color: C.text, marginTop: 2 }}><span style={{ color: C.pr }}>●</span> Top {fmtKg(d.top)} kg × {d.reps}</div>
      <div style={{ color: C.subtle, marginTop: 4, fontSize: '0.66rem' }}>{d.sets} sets · {d.volume} kg volume</div>
    </div>
  )
}

export function ProgressChart({ series, height = 170 }) {
  if (series.length < 2) {
    return (
      <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.76rem', color: C.subtle, textAlign: 'center' }}>
        {series.length === 1 ? 'One session logged — the trend appears after the next one.' : 'No sessions logged yet.'}
      </div>
    )
  }
  const hasE1rm = series.some(d => d.e1rm != null)
  const vals = series.flatMap(d => [d.e1rm, d.top]).filter(v => v != null && v > 0)
  const lo = vals.length ? Math.min(...vals) : 0
  const hi = vals.length ? Math.max(...vals) : 10
  const step = hi - lo > 60 ? 20 : hi - lo > 25 ? 10 : 5
  const yMin = Math.max(0, Math.floor((lo - step / 2) / step) * step)
  const yMax = Math.ceil((hi + step / 2) / step) * step
  const yTicks = []
  for (let v = yMin; v <= yMax; v += step) yTicks.push(v)

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={series} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="x" type="number" scale="time" domain={['dataMin', 'dataMax']}
            tickFormatter={ts => dayjs(ts).format('MMM D')} tickCount={4}
            tick={{ fontSize: 9, fill: C.subtle, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false}
          />
          <YAxis
            type="number" domain={[yMin, yMax]} ticks={yTicks}
            tick={{ fontSize: 9, fill: C.subtle, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} width={30}
          />
          {yTicks.map(v => <ReferenceLine key={v} y={v} stroke="rgba(255,255,255,0.05)" />)}
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
          {hasE1rm && (
            <Line type="monotone" dataKey="e1rm" stroke={C.accent} strokeWidth={2} connectNulls
              dot={{ r: 2.5, fill: C.accent, strokeWidth: 0 }} activeDot={{ r: 4.5, fill: C.accent, stroke: C.card, strokeWidth: 2 }} isAnimationActive={false} />
          )}
          <Line type="linear" dataKey="top" stroke={C.pr} strokeWidth={2} strokeDasharray="4 3"
            dot={false} activeDot={{ r: 4.5, fill: C.pr, stroke: C.card, strokeWidth: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 6, fontSize: '0.66rem', color: C.muted }}>
        {hasE1rm && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke={C.accent} strokeWidth="2" /></svg> Est. 1RM
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke={C.pr} strokeWidth="2" strokeDasharray="4 3" /></svg> Top set
        </span>
      </div>
    </div>
  )
}
