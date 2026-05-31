import dayjs from 'dayjs'

const TABS = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'nutrition', label: 'Nutrition', icon: '⬡' },
  { id: 'activity', label: 'Activity', icon: '◈' },
  { id: 'weight', label: 'Weight', icon: '◷' },
]

export function Layout({ tab, setTab, date, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0e0f11', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px 12px',
        paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <span className="mono" style={{ fontSize: '1rem', fontWeight: 500, letterSpacing: '0.12em', color: '#f0eeea' }}>
          VITALS
        </span>
        <span className="mono" style={{
          fontSize: '0.72rem', color: '#9ca0a4',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)',
          padding: '4px 10px', borderRadius: 6, letterSpacing: '0.04em',
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
        borderTop: '1px solid rgba(255,255,255,0.05)',
        background: '#0e0f11',
        flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '10px 4px 8px', background: 'none', border: 'none',
              cursor: 'pointer', transition: 'color 0.15s',
              color: tab === t.id ? '#f0eeea' : '#6b6f73',
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: '0.6rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
