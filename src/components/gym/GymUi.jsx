// Small presentational building blocks shared by the gym screens.
import { C, label, smallBtn } from './gymStyles'

export function SectionLabel({ children, right, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, ...style }}>
      <div style={label}>{children}</div>
      {right}
    </div>
  )
}

export function Chip({ children, active, onClick, color, bg, style }) {
  return (
    <button type="button" onClick={onClick} style={{ ...smallBtn(active, color, bg), ...style }}>
      {children}
    </button>
  )
}

export function Segmented({ options, value, onChange, style }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 3, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 10, ...style }}>
      {options.map(o => {
        const active = o.id === value
        return (
          <button
            key={o.id} type="button" onClick={() => onChange(o.id)}
            style={{
              flex: 1, padding: '7px 6px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: '0.74rem', fontFamily: 'DM Sans, sans-serif', fontWeight: active ? 600 : 400,
              background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: active ? C.text : C.subtle,
              transition: 'color 0.15s, background 0.15s',
            }}
          >{o.label}</button>
        )
      })}
    </div>
  )
}

export function MuscleTags({ primary = [], secondary = [], size = 'sm' }) {
  const fs = size === 'sm' ? '0.64rem' : '0.7rem'
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {primary.map(m => (
        <span key={'p' + m} style={{ fontSize: fs, padding: '2px 7px', borderRadius: 5, background: C.accentBg, color: C.accent, textTransform: 'capitalize' }}>{m}</span>
      ))}
      {secondary.map(m => (
        <span key={'s' + m} style={{ fontSize: fs, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', color: C.muted, textTransform: 'capitalize' }}>{m}</span>
      ))}
    </div>
  )
}

export function Badge({ children, color = C.accent, bg = C.accentBg }) {
  return (
    <span className="mono" style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: 5, background: bg, color, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

// Bottom sheet using the app's existing .sheet / .sheet-backdrop classes.
export function Sheet({ onClose, children, z = 0, title, right }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} style={z ? { zIndex: 40 + z } : undefined} />
      <div className="sheet" role="dialog" aria-modal="true" style={{ ...(z ? { zIndex: 50 + z } : null), maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.14)' }} />
        </div>
        {(title || right) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 4px', gap: 8 }}>
            <div style={{ fontSize: '0.98rem', fontWeight: 600, color: C.text, minWidth: 0 }}>{title}</div>
            {right}
          </div>
        )}
        <div style={{ padding: '8px 18px 22px' }}>{children}</div>
      </div>
    </>
  )
}

// Full-screen overlay (session, routine editor, pickers). Keeps the app-shell width.
export function FullScreen({ children, z = 30, header }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: z, background: '#0c0d0f',
      display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto',
      animation: 'fadeIn 0.18s ease',
    }}>
      {header && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
          borderBottom: `1px solid ${C.divider}`, background: 'rgba(12,13,15,0.92)', flexShrink: 0,
        }}>{header}</div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>{children}</div>
    </div>
  )
}

export function Empty({ children, style }) {
  return (
    <div style={{ padding: '22px 12px', textAlign: 'center', color: C.subtle, fontSize: '0.8rem', lineHeight: 1.5, ...style }}>{children}</div>
  )
}

// −/+ stepper around a numeric input. Value is kept as a string so the user can type freely.
export function Stepper({ value, onChange, step = 1, min = 0, inputMode = 'decimal', width = 64, ariaLabel, color = C.text }) {
  const n = parseFloat(value)
  const bump = d => {
    const base = Number.isFinite(n) ? n : 0
    const next = Math.max(min, Math.round((base + d) * 100) / 100)
    onChange(String(next))
  }
  const btn = {
    width: 30, height: 36, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer',
    fontSize: '1rem', fontFamily: 'DM Mono, monospace', flexShrink: 0,
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 9 }}>
      <button type="button" aria-label={`decrease ${ariaLabel}`} style={btn} onClick={() => bump(-step)}>−</button>
      <input
        aria-label={ariaLabel}
        className="mono"
        inputMode={inputMode}
        value={value}
        onChange={e => onChange(e.target.value.replace(',', '.'))}
        onFocus={e => e.target.select()}
        style={{ width, textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', color, fontSize: '0.95rem', padding: '8px 0' }}
      />
      <button type="button" aria-label={`increase ${ariaLabel}`} style={btn} onClick={() => bump(step)}>+</button>
    </div>
  )
}

export function ConfirmRow({ text, confirmLabel = 'Delete', onConfirm, onCancel, danger = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', borderRadius: 10, background: danger ? C.dangerBg : C.accentBg }}>
      <span style={{ fontSize: '0.78rem', color: danger ? C.danger : C.accent }}>{text}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={onConfirm} style={{ ...smallBtn(true, danger ? C.danger : C.accent, 'rgba(0,0,0,0.25)') }}>{confirmLabel}</button>
        <button type="button" onClick={onCancel} style={smallBtn(false)}>Cancel</button>
      </div>
    </div>
  )
}

export function StatTile({ label: l, value, unit, sub, color = C.text }) {
  return (
    <div className="card" style={{ padding: '12px 12px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.62rem', color: C.muted, letterSpacing: '0.05em', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>
      <div className="mono" style={{ fontSize: '1.2rem', color, lineHeight: 1 }}>
        {value}{unit && <span style={{ fontSize: '0.66rem', color: C.muted, marginLeft: 3 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: '0.64rem', color: C.subtle, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  )
}
