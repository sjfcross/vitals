// Exercise photos (free-exercise-db start/end frames, loaded on demand) with a crossfade
// "animation" between the two frames. Each frame tries jsDelivr, then raw GitHub; if every
// source fails — or the exercise has no photos — the SVG stick figure is shown instead.
import { useState } from 'react'
import { imageCandidates } from '../../lib/gymLibrary'
import { StickFigure } from './StickFigure'
import { C } from './gymStyles'

const XFADE_CSS = `
@keyframes gymXfade { 0%, 38% { opacity: 0 } 50%, 88% { opacity: 1 } 100% { opacity: 0 } }
.gym-xfade-top { animation: gymXfade 3.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .gym-xfade-top { animation: none; opacity: 0; } }
`

// One <img> walking through its candidate URLs. Reports final failure via onFail.
function FallbackImg({ path, alt, onFail, onLoad, style, className, loading = 'lazy' }) {
  const urls = imageCandidates(path)
  const [i, setI] = useState(0)
  if (!urls.length || i >= urls.length) return null
  return (
    <img
      src={urls[i]} alt={alt} loading={loading} decoding="async" className={className} style={style}
      onLoad={onLoad}
      onError={() => { if (i + 1 >= urls.length) onFail?.(); setI(i + 1) }}
    />
  )
}

// Large media block for the detail view. Remount with key={exercise.id} when the exercise changes.
export function ExerciseAnimation({ exercise, height }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const imgs = exercise.images || []
  const box = {
    position: 'relative', width: '100%', aspectRatio: height ? undefined : '3 / 2', height,
    borderRadius: 12, overflow: 'hidden', background: imgs.length && !failed ? '#f4f4f2' : C.elevated,
  }
  if (!imgs.length || failed) {
    return (
      <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '58%', maxWidth: 220 }}><StickFigure exercise={exercise} /></div>
        <span className="mono" style={{ position: 'absolute', bottom: 8, right: 10, fontSize: '0.58rem', color: C.subtle }}>
          {imgs.length ? 'images unavailable' : 'illustration'}
        </span>
      </div>
    )
  }
  const imgStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }
  return (
    <div style={box}>
      <style>{XFADE_CSS}</style>
      <FallbackImg path={imgs[0]} alt={`${exercise.name} — start`} loading="eager" style={imgStyle} onLoad={() => setLoaded(true)} onFail={() => setFailed(true)} />
      {imgs[1] && <FallbackImg path={imgs[1]} alt={`${exercise.name} — end`} loading="eager" className="gym-xfade-top" style={imgStyle} />}
      {!loaded && (
        <div className="mono" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#8a8d90', letterSpacing: '0.08em' }}>
          LOADING…
        </div>
      )}
    </div>
  )
}

// Small square thumbnail for lists (start frame only).
export function ExerciseThumb({ exercise, size = 44 }) {
  const [failed, setFailed] = useState(false)
  const img = exercise?.images?.[0]
  const box = {
    width: size, height: size, borderRadius: 9, overflow: 'hidden', flexShrink: 0,
    background: img && !failed ? '#f4f4f2' : C.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${C.border}`,
  }
  return (
    <div style={box}>
      {img && !failed
        ? <FallbackImg path={img} alt="" onFail={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ width: '78%' }}><StickFigure exercise={exercise} animate={false} /></div>}
    </div>
  )
}
