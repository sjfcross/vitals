// Self-drawn animated stick figure — the licence-free fallback for exercises without photos
// (custom gym machines, the few library entries without images, or when images fail to load).
// Two side-view poses per movement pattern, interpolated with SMIL so it needs no JS timers.
import { C } from './gymStyles'

// Joint coordinates in a 100×100 box, ground at y = 92.
const STAND = { head: [50, 14], neck: [50, 23], hip: [50, 52], knee: [50, 72], foot: [50, 92] }
const POSES = {
  squat: [
    { ...STAND, elbow: [61, 27], hand: [73, 27] },
    { head: [47, 32], neck: [46, 40], hip: [34, 64], knee: [56, 70], foot: [50, 92], elbow: [57, 43], hand: [69, 43] },
  ],
  press: [
    { ...STAND, elbow: [40, 38], hand: [56, 31] },
    { ...STAND, elbow: [64, 27], hand: [79, 26] },
  ],
  pull: [
    { ...STAND, hip: [52, 52], neck: [49, 23], head: [48, 14], elbow: [63, 31], hand: [78, 33] },
    { ...STAND, hip: [52, 52], neck: [51, 23], head: [51, 14], elbow: [37, 40], hand: [52, 34] },
  ],
  hinge: [
    { ...STAND, elbow: [52, 38], hand: [53, 50] },
    { head: [74, 32], neck: [67, 35], hip: [46, 54], knee: [49, 72], foot: [50, 92], elbow: [66, 48], hand: [65, 60] },
  ],
}

const SEGMENTS = [['neck', 'hip'], ['hip', 'knee'], ['knee', 'foot'], ['neck', 'elbow'], ['elbow', 'hand']]

function motionFor(ex) {
  const p = ex?.primary || []
  const has = (...m) => m.some(x => p.includes(x))
  if (has('quadriceps', 'glutes', 'hamstrings', 'adductors', 'abductors', 'calves')) return 'squat'
  if (has('lats', 'middle back', 'biceps', 'traps', 'forearms')) return 'pull'
  if (has('abdominals', 'lower back', 'neck')) return 'hinge'
  return 'press'
}

const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function StickFigure({ exercise, size = '100%', animate = true, color = C.accent }) {
  const [a, b] = POSES[motionFor(exercise)]
  const dur = '2.4s'
  const live = animate && !reducedMotion
  const anim = (attr, v1, v2) => live && v1 !== v2
    ? <animate attributeName={attr} values={`${v1};${v2};${v1}`} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
    : null
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${exercise?.name || 'Exercise'} — movement illustration`} style={{ display: 'block' }}>
      <line x1="18" y1="92.5" x2="82" y2="92.5" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round" />
      <g stroke={color} strokeWidth="4" strokeLinecap="round" fill="none">
        {SEGMENTS.map(([p, q]) => (
          <line key={p + q} x1={a[p][0]} y1={a[p][1]} x2={a[q][0]} y2={a[q][1]}>
            {anim('x1', a[p][0], b[p][0])}{anim('y1', a[p][1], b[p][1])}
            {anim('x2', a[q][0], b[q][0])}{anim('y2', a[q][1], b[q][1])}
          </line>
        ))}
      </g>
      <circle cx={a.head[0]} cy={a.head[1]} r="6.5" fill={color}>
        {anim('cx', a.head[0], b.head[0])}{anim('cy', a.head[1], b.head[1])}
      </circle>
      {/* handle / weight at the hands */}
      <circle cx={a.hand[0]} cy={a.hand[1]} r="3.4" fill="#f0eeea" opacity="0.85">
        {anim('cx', a.hand[0], b.hand[0])}{anim('cy', a.hand[1], b.hand[1])}
      </circle>
    </svg>
  )
}
