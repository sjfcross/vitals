export function CircularRing({ label, value, target, color, unit = '' }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0
  const r = 38
  const circ = 2 * Math.PI * r
  const dash = pct * circ

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          <circle
            cx="48" cy="48" r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform="rotate(-90 48 48)"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="mono" style={{ fontSize: '1rem', fontWeight: 500, color: '#f0eeea', lineHeight: 1 }}>
            {value.toLocaleString()}
          </span>
          <span style={{ fontSize: '0.6rem', color: '#6b6f73', marginTop: 1 }}>
            / {target.toLocaleString()}{unit}
          </span>
        </div>
      </div>
      <span style={{ fontSize: '0.7rem', color: '#9ca0a4', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
    </div>
  )
}
