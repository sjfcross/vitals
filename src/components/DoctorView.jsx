import dayjs from 'dayjs'

function classifyBP(sys, dia) {
  if (sys > 180 || dia > 120) return { label: 'Crisis', color: '#ff5a5a' }
  if (sys >= 140 || dia >= 90) return { label: 'High II', color: '#e8784a' }
  if (sys >= 130 || dia >= 80) return { label: 'High I', color: '#f0c96a' }
  if (sys >= 120 && dia < 80) return { label: 'Elevated', color: '#f0c96a' }
  return { label: 'Normal', color: '#6ec87a' }
}

function avg(arr) {
  return arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null
}

export function DoctorView({ entries, onClose }) {
  const sorted = [...entries].sort((a, b) =>
    b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '')
  )

  const last30 = entries.filter(e => e.date >= dayjs().subtract(30, 'day').format('YYYY-MM-DD'))
  const avgSys = avg(last30.map(e => e.systolic))
  const avgDia = avg(last30.map(e => e.diastolic))
  const avgPulse = avg(last30.filter(e => e.pulse).map(e => e.pulse))

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#0f1113',
      overflowY: 'auto',
      padding: '0 0 40px',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#0f1113',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f0eeea' }}>Blood Pressure Log</div>
          <div style={{ fontSize: '0.72rem', color: '#6b6f73', marginTop: 2 }}>
            {sorted.length} reading{sorted.length !== 1 ? 's' : ''} · as of {dayjs().format('MMM D, YYYY')}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8,
            color: '#9ca0a4', fontSize: '0.85rem', padding: '8px 14px',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Close</button>
      </div>

      {/* 30-day averages */}
      {last30.length > 0 && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.65rem', color: '#6b6f73', letterSpacing: '0.08em', marginBottom: 10 }}>30-DAY AVERAGE</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: 'rgba(232,122,138,0.08)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(232,122,138,0.15)' }}>
              <div style={{ fontSize: '0.65rem', color: '#9ca0a4', marginBottom: 4 }}>SYSTOLIC</div>
              <div className="mono" style={{ fontSize: '1.6rem', color: '#e87a8a', fontWeight: 500, lineHeight: 1 }}>{avgSys}</div>
              <div style={{ fontSize: '0.65rem', color: '#6b6f73', marginTop: 2 }}>mmHg</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(91,164,230,0.08)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(91,164,230,0.15)' }}>
              <div style={{ fontSize: '0.65rem', color: '#9ca0a4', marginBottom: 4 }}>DIASTOLIC</div>
              <div className="mono" style={{ fontSize: '1.6rem', color: '#5ba4e6', fontWeight: 500, lineHeight: 1 }}>{avgDia}</div>
              <div style={{ fontSize: '0.65rem', color: '#6b6f73', marginTop: 2 }}>mmHg</div>
            </div>
            {avgPulse && (
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: '0.65rem', color: '#9ca0a4', marginBottom: 4 }}>PULSE</div>
                <div className="mono" style={{ fontSize: '1.6rem', color: '#f0eeea', fontWeight: 500, lineHeight: 1 }}>{avgPulse}</div>
                <div style={{ fontSize: '0.65rem', color: '#6b6f73', marginTop: 2 }}>bpm</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ fontSize: '0.65rem', color: '#6b6f73', letterSpacing: '0.08em', marginBottom: 10 }}>ALL READINGS</div>
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 1fr',
            padding: '9px 14px',
            background: 'rgba(255,255,255,0.04)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}>
            {['DATE & TIME', 'BP (mmHg)', 'PULSE', 'STATUS'].map(h => (
              <div key={h} style={{ fontSize: '0.62rem', color: '#6b6f73', letterSpacing: '0.07em' }}>{h}</div>
            ))}
          </div>

          {sorted.map((e, i) => {
            const cls = classifyBP(e.systolic, e.diastolic)
            return (
              <div key={e.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 1fr',
                padding: '12px 14px',
                borderBottom: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#f0eeea' }}>{dayjs(e.date).format('MMM D, YYYY')}</div>
                  <div style={{ fontSize: '0.72rem', color: '#6b6f73', marginTop: 2 }}>{e.time?.slice(0, 5) || '–'}</div>
                </div>
                <div className="mono" style={{ fontSize: '1rem', lineHeight: 1 }}>
                  <span style={{ color: '#e87a8a' }}>{e.systolic}</span>
                  <span style={{ color: '#4a4e52' }}>/</span>
                  <span style={{ color: '#5ba4e6' }}>{e.diastolic}</span>
                </div>
                <div className="mono" style={{ fontSize: '0.9rem', color: '#9ca0a4' }}>{e.pulse || '–'}</div>
                <div style={{ fontSize: '0.72rem', color: cls.color, fontWeight: 600 }}>{cls.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
