// Pure gym logic — no React, no Supabase. Everything here is deterministic given its inputs,
// so it behaves identically in mock and real mode.

export const HR_RETENTION_MS = 48 * 60 * 60 * 1000 // heart_rate_intraday keeps 48 h
export const DEFAULT_TARGET = { target_sets: 3, rep_min: 8, rep_max: 12, increment_kg: 2.5, progression: 'double' }

const num = v => (v == null || v === '' ? null : Number(v))

// ── Weights ──────────────────────────────────────────────────────────────────

export function roundTo(weight, step) {
  if (!step || step <= 0) return Math.round(weight * 100) / 100
  return Math.round(Math.round(weight / step) * step * 100) / 100
}

export function fmtKg(w) {
  const n = num(w)
  if (n == null) return '–'
  return Number.isInteger(n) ? String(n) : n.toFixed(n * 10 % 1 === 0 ? 1 : 2)
}

// ── Estimated 1RM ────────────────────────────────────────────────────────────
// Epley: w · (1 + reps/30). Unreliable above ~12 reps and meaningless for unloaded sets,
// so those return null (PRs then fall back to weight / reps).
export const E1RM_MAX_REPS = 12

export function e1rm(weight, reps) {
  const w = num(weight), r = num(reps)
  if (!w || !r || r < 1 || r > E1RM_MAX_REPS) return null
  if (r === 1) return w
  return Math.round(w * (1 + r / 30) * 10) / 10
}

// ── PRs ──────────────────────────────────────────────────────────────────────

function bestOf(sets) {
  let best = { e1rm: null, weight: null, reps: null, bwReps: null }
  for (const s of sets) {
    const w = num(s.weight_kg) ?? 0, r = num(s.reps) ?? 0
    if (r <= 0) continue
    const est = e1rm(w, r)
    if (est != null && (best.e1rm == null || est > best.e1rm)) best.e1rm = est
    if (w > 0 && (best.weight == null || w > best.weight)) best.weight = w
    if (w === 0 && (best.bwReps == null || r > best.bwReps)) best.bwReps = r
  }
  return best
}

export function exerciseBest(sets) { return bestOf(sets) }

// PRs a single new set sets against `priorSets` (same exercise, everything logged before it).
// No prior history → no PR (the first time you do an exercise isn't a record, it's a baseline).
export function detectSetPRs(set, priorSets) {
  if (!priorSets.length) return []
  const prev = bestOf(priorSets)
  const w = num(set.weight_kg) ?? 0, r = num(set.reps) ?? 0
  if (r <= 0) return []
  const out = []
  const est = e1rm(w, r)
  if (est != null && prev.e1rm != null && est > prev.e1rm) out.push({ type: 'e1rm', value: est, prev: prev.e1rm })
  if (w > 0 && prev.weight != null && w > prev.weight) out.push({ type: 'weight', value: w, prev: prev.weight })
  if (w === 0 && prev.bwReps != null && r > prev.bwReps) out.push({ type: 'reps', value: r, prev: prev.bwReps })
  return out
}

// PRs achieved in a session: best in-session vs best of all sessions that started before it.
export function sessionPRs(session, allSets, sessionsById) {
  const start = new Date(session.started_at).getTime()
  const inSession = allSets.filter(s => s.session_id === session.id)
  const byEx = groupBy(inSession, s => s.exercise_id)
  const out = []
  for (const [exerciseId, sets] of byEx) {
    const prior = allSets.filter(s => {
      if (s.exercise_id !== exerciseId || s.session_id === session.id) return false
      const sess = sessionsById.get(s.session_id)
      return sess && new Date(sess.started_at).getTime() < start
    })
    if (!prior.length) continue
    const now = bestOf(sets), prev = bestOf(prior)
    if (now.e1rm != null && prev.e1rm != null && now.e1rm > prev.e1rm) out.push({ exerciseId, type: 'e1rm', value: now.e1rm, prev: prev.e1rm })
    if (now.weight != null && prev.weight != null && now.weight > prev.weight) out.push({ exerciseId, type: 'weight', value: now.weight, prev: prev.weight })
    if (now.bwReps != null && prev.bwReps != null && now.bwReps > prev.bwReps) out.push({ exerciseId, type: 'reps', value: now.bwReps, prev: prev.bwReps })
  }
  return out
}

export function prLabel(pr) {
  if (pr.type === 'e1rm') return `e1RM ${fmtKg(pr.value)} kg`
  if (pr.type === 'weight') return `Heaviest ${fmtKg(pr.value)} kg`
  return `${pr.value} reps`
}

// ── History helpers ──────────────────────────────────────────────────────────

export function groupBy(arr, keyFn) {
  const m = new Map()
  for (const x of arr) {
    const k = keyFn(x)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(x)
  }
  return m
}

// Sets of `exerciseId` from the most recent *other* session that contains it, ordered by set no.
export function lastSessionSets(exerciseId, allSets, sessionsById, excludeSessionId = null) {
  let bestSession = null
  for (const s of allSets) {
    if (s.exercise_id !== exerciseId || s.session_id === excludeSessionId) continue
    const sess = sessionsById.get(s.session_id)
    if (!sess) continue
    if (!bestSession || new Date(sess.started_at) > new Date(bestSession.started_at)) bestSession = sess
  }
  if (!bestSession) return { session: null, sets: [] }
  const sets = allSets
    .filter(s => s.session_id === bestSession.id && s.exercise_id === exerciseId)
    .sort((a, b) => a.set_number - b.set_number)
  return { session: bestSession, sets }
}

// Per-session series for charts: best e1RM, top weight, volume.
export function exerciseSeries(exerciseId, allSets, sessionsById) {
  const bySession = groupBy(allSets.filter(s => s.exercise_id === exerciseId), s => s.session_id)
  const rows = []
  for (const [sid, sets] of bySession) {
    const sess = sessionsById.get(sid)
    if (!sess) continue
    const b = bestOf(sets)
    rows.push({
      x: new Date(sess.started_at).getTime(),
      sessionId: sid,
      e1rm: b.e1rm,
      top: b.weight ?? 0,
      reps: Math.max(...sets.map(s => num(s.reps) ?? 0)),
      volume: Math.round(sets.reduce((a, s) => a + (num(s.weight_kg) ?? 0) * (num(s.reps) ?? 0), 0)),
      sets: sets.length,
    })
  }
  return rows.sort((a, b) => a.x - b.x)
}

export function sessionVolume(sets) {
  return Math.round(sets.reduce((a, s) => a + (num(s.weight_kg) ?? 0) * (num(s.reps) ?? 0), 0))
}

// Body weight on or before a date (weight entries: [{date, weight_kg}], any order).
export function bodyweightOn(dateStr, weightEntries) {
  let best = null
  for (const e of weightEntries || []) {
    if (e.date <= dateStr && (!best || e.date > best.date)) best = e
  }
  return best ? Number(best.weight_kg) : null
}

// ── Progression ──────────────────────────────────────────────────────────────
// target: { target_sets, rep_min, rep_max, increment_kg, progression, start_weight_kg }
// history: array of per-session set arrays for this exercise, most recent FIRST.
//
// linear: fixed target reps (= rep_min). Hit it on all target sets at the working weight →
//         add one increment. Missed it three sessions running at the same weight → deload 10 %.
// double: rep range. Every target set at the working weight reached rep_max → add one
//         increment and drop back to rep_min; otherwise keep the weight and chase +1 rep.
export function progressionHint(target, history) {
  const t = { ...DEFAULT_TARGET, ...stripNulls(target) }
  const inc = num(t.increment_kg) || 2.5
  const last = history[0]
  if (!last || !last.length) {
    const w = num(t.start_weight_kg)
    return { kind: 'start', weight: w, reps: t.rep_min, message: w != null ? `Start at ${fmtKg(w)} kg × ${t.rep_min}` : 'First time — find a weight you can do for ' + repText(t) }
  }
  const working = Math.max(...last.map(s => num(s.weight_kg) ?? 0))
  const atWorking = last.filter(s => (num(s.weight_kg) ?? 0) === working)
  const goal = t.progression === 'linear' ? t.rep_min : t.rep_max
  const enoughSets = atWorking.length >= t.target_sets
  const allHit = enoughSets && atWorking.every(s => (num(s.reps) ?? 0) >= goal)

  if (working === 0) {
    // Bodyweight: progress reps, not load.
    const best = Math.max(...last.map(s => num(s.reps) ?? 0))
    return { kind: allHit ? 'increase' : 'hold', weight: 0, reps: best + 1, message: `Bodyweight — aim for ${best + 1} reps` }
  }

  if (allHit) {
    const next = Math.round((working + inc) * 100) / 100
    return {
      kind: 'increase', weight: next, reps: t.rep_min,
      message: t.progression === 'linear'
        ? `All ${t.target_sets}×${goal} done — go heavier: ${fmtKg(next)} kg`
        : `Top of range hit — go heavier: ${fmtKg(next)} kg × ${t.rep_min}`,
    }
  }

  if (t.progression === 'linear') {
    const recent = history.slice(0, 3)
    const stalled = recent.length === 3 && recent.every(sets => {
      const w = Math.max(...sets.map(s => num(s.weight_kg) ?? 0))
      const at = sets.filter(s => (num(s.weight_kg) ?? 0) === w)
      return w === working && !(at.length >= t.target_sets && at.every(s => (num(s.reps) ?? 0) >= goal))
    })
    if (stalled) {
      const next = roundTo(working * 0.9, inc)
      return { kind: 'deload', weight: next, reps: goal, message: `Stalled 3× at ${fmtKg(working)} kg — deload to ${fmtKg(next)} kg` }
    }
    return { kind: 'hold', weight: working, reps: goal, message: `Repeat ${fmtKg(working)} kg — get ${t.target_sets}×${goal}` }
  }

  const minReps = atWorking.length ? Math.min(...atWorking.map(s => num(s.reps) ?? 0)) : t.rep_min
  const aim = Math.min(t.rep_max, Math.max(t.rep_min, minReps + 1))
  return { kind: 'hold', weight: working, reps: aim, message: `Stay at ${fmtKg(working)} kg — aim for ${aim}+ reps (${repText(t)})` }
}

function repText(t) { return t.rep_min === t.rep_max ? `${t.rep_min} reps` : `${t.rep_min}–${t.rep_max} reps` }
function stripNulls(o) { return Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null)) }

// Per-session histories (most recent first) for an exercise, excluding a session.
export function exerciseHistory(exerciseId, allSets, sessionsById, excludeSessionId = null, limit = 5) {
  const bySession = groupBy(allSets.filter(s => s.exercise_id === exerciseId && s.session_id !== excludeSessionId), s => s.session_id)
  return [...bySession.entries()]
    .filter(([sid]) => sessionsById.has(sid))
    .sort((a, b) => new Date(sessionsById.get(b[0]).started_at) - new Date(sessionsById.get(a[0]).started_at))
    .slice(0, limit)
    .map(([, sets]) => sets.sort((a, b) => a.set_number - b.set_number))
}

// ── Scheduling ───────────────────────────────────────────────────────────────

export const WEEKDAYS = [
  { iso: 1, short: 'Mo' }, { iso: 2, short: 'Tu' }, { iso: 3, short: 'We' }, { iso: 4, short: 'Th' },
  { iso: 5, short: 'Fr' }, { iso: 6, short: 'Sa' }, { iso: 7, short: 'Su' },
]

export function isoWeekday(date) {
  const d = new Date(date).getDay()
  return d === 0 ? 7 : d
}

// Today's routine: a weekday routine scheduled today wins; otherwise the rotation routine
// after the one trained most recently (wrapping), or the first if none trained yet.
export function pickTodaysRoutine(routines, sessions, todayDate) {
  const active = routines.filter(r => !r.archived)
  const wd = isoWeekday(todayDate + 'T12:00:00')
  const byDay = active.find(r => r.schedule_type === 'weekdays' && (r.weekdays || []).includes(wd))
  if (byDay) return { routine: byDay, reason: 'weekday' }
  const rotation = active.filter(r => r.schedule_type === 'rotation').sort((a, b) => a.rotation_order - b.rotation_order)
  if (!rotation.length) return { routine: null, reason: null }
  const ids = new Set(rotation.map(r => r.id))
  const last = sessions
    .filter(s => s.ended_at && ids.has(s.routine_id))
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))[0]
  if (!last) return { routine: rotation[0], reason: 'rotation' }
  const idx = rotation.findIndex(r => r.id === last.routine_id)
  const next = rotation[(idx + 1) % rotation.length]
  // Trained the rotation today already → suggest the next one, and say what was done.
  if (localDate(last.started_at) === todayDate) {
    return { routine: next, reason: 'rotation', doneToday: rotation[idx] }
  }
  return { routine: next, reason: 'rotation' }
}

export function localDate(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function rotationLetter(index) { return String.fromCharCode(65 + (index % 26)) }

// ── Heart rate ───────────────────────────────────────────────────────────────

export const HR_ZONES = [
  { zone: 1, label: 'Z1', name: 'Very light', lo: 0.5, hi: 0.6, color: '#5ba4e6' },
  { zone: 2, label: 'Z2', name: 'Light', lo: 0.6, hi: 0.7, color: '#6ec87a' },
  { zone: 3, label: 'Z3', name: 'Moderate', lo: 0.7, hi: 0.8, color: '#f0c96a' },
  { zone: 4, label: 'Z4', name: 'Hard', lo: 0.8, hi: 0.9, color: '#e8784a' },
  { zone: 5, label: 'Z5', name: 'Maximum', lo: 0.9, hi: 10, color: '#e87a8a' },
]

const MAX_GAP_MS = 30 * 1000 // don't let a sync gap count as minutes in a zone

// samples: [{ t: ms, bpm }] (any order). Returns the gym_sessions HR columns, or null if
// there isn't enough data. Zone minutes are time-weighted: each sample owns the time until
// the next one (capped at 30 s).
export function computeHrSummary(samples, hrMax) {
  const pts = (samples || []).filter(p => p.bpm > 0).sort((a, b) => a.t - b.t)
  if (pts.length < 2) return null
  const zoneMs = [0, 0, 0, 0, 0]
  let sum = 0, max = 0
  for (let i = 0; i < pts.length; i++) {
    const { bpm } = pts[i]
    sum += bpm
    if (bpm > max) max = bpm
    const dt = i < pts.length - 1 ? Math.min(pts[i + 1].t - pts[i].t, MAX_GAP_MS) : 0
    const pct = bpm / hrMax
    const z = HR_ZONES.findIndex(zn => pct >= zn.lo && pct < zn.hi)
    if (z >= 0) zoneMs[z] += dt
  }
  const toMin = ms => Math.round(ms / 6000) / 10
  return {
    hr_avg: Math.round(sum / pts.length),
    hr_max: max,
    hr_zone1_min: toMin(zoneMs[0]),
    hr_zone2_min: toMin(zoneMs[1]),
    hr_zone3_min: toMin(zoneMs[2]),
    hr_zone4_min: toMin(zoneMs[3]),
    hr_zone5_min: toMin(zoneMs[4]),
    hr_max_ref: hrMax,
    hr_sample_count: pts.length,
  }
}

// Can the HR summary still be (re)computed? Needs the session start to be inside the
// 48 h retention window of heart_rate_intraday.
export function hrWindowOpen(session, nowMs) {
  return nowMs - new Date(session.started_at).getTime() < HR_RETENTION_MS
}

export function durationMin(session, nowMs) {
  const end = session.ended_at ? new Date(session.ended_at).getTime() : nowMs
  return Math.max(0, Math.round((end - new Date(session.started_at).getTime()) / 60000))
}

export function fmtDuration(min) {
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}
