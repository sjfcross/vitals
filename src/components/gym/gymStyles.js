// Shared tokens for the Gym tab. Palette follows README "Color palette"; the gym accent reuses
// the existing --fibre teal so the tab has its own identity without new colours.
export const C = {
  accent: '#5ecfcf',
  accentBg: 'rgba(94,207,207,0.14)',
  pr: '#f0c96a',
  prBg: 'rgba(240,201,106,0.14)',
  hr: '#e87a8a',
  good: '#6ec87a',
  warn: '#f0c96a',
  danger: '#e8784a',
  dangerBg: 'rgba(232,120,74,0.16)',
  text: '#f0eeea',
  muted: '#9ca0a4',
  subtle: '#6b6f73',
  faint: '#52575c',
  card: '#141618',
  elevated: '#1c1e20',
  border: 'rgba(255,255,255,0.07)',
  borderHover: 'rgba(255,255,255,0.14)',
  divider: 'rgba(255,255,255,0.06)',
}

export const label = { fontSize: '0.7rem', color: C.muted, letterSpacing: '0.05em' }
export const fieldLabel = { display: 'block', fontSize: '0.68rem', color: C.muted, marginBottom: 5, letterSpacing: '0.04em' }
export const mono = { fontFamily: 'DM Mono, monospace' }

export const smallBtn = (active = false, color = C.accent, bg = C.accentBg) => ({
  padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
  fontSize: '0.7rem', fontFamily: 'DM Mono, monospace', letterSpacing: '0.03em',
  background: active ? bg : 'rgba(255,255,255,0.04)',
  color: active ? color : C.muted,
  transition: 'color 0.15s, background 0.15s',
  whiteSpace: 'nowrap',
})

export const iconBtn = {
  width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 9, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted,
  cursor: 'pointer', fontSize: '0.9rem', flexShrink: 0,
}

export const tooltipBox = {
  background: '#1e2022', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  padding: '8px 12px', fontSize: '0.75rem', fontFamily: 'DM Mono, monospace',
}
