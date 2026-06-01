import dayjs from 'dayjs'

const TABS = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'nutrition', label: 'Nutrition', icon: '⬡' },
  { id: 'activity', label: 'Activity', icon: '◈' },
  { id: 'weight', label: 'Weight', icon: '◷' },
  { id: 'bp', label: 'BP', icon: '♡' },
]

export function Layout({ tab, setTab, date, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0c0d0f', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px 12px',
        paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(12,13,15,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        flexShrink: 0,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span className="mono" style={{ fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.14em', color: '#f0eeea' }}>
          VITALS
        </span>
        <span className="mono" style={{
          fontSize: '0.7rem', color: '#6b6f73',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
          padding: '3px 9px', borderRadius: 6, letterSpacing: '0.04em',
        }}>
          {dayjs(date).format('MMM D, YYYY')}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {children}
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{
        display: 'flex',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(12,13,15,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        flexShrink: 0,
        padding: '4px 8px',
      }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 3, padding: '8px 4px 6px',
                background: active ? 'rgba(255,255,255,0.07)' : 'none',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'color 0.18s cubic-bezier(0.23,1,0.32,1), background 0.18s cubic-bezier(0.23,1,0.32,1)',
                color: active ? '#f0eeea' : '#52575c',
              }}
            >
              <span style={{ fontSize: '1rem', lineHeight: 1, transition: 'transform 0.18s cubic-bezier(0.23,1,0.32,1)', transform: active ? 'scale(1.12)' : 'scale(1)' }}>{t.icon}</span>
              <span style={{ fontSize: '0.58rem', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: active ? 600 : 400 }}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
