// Exercise library: bundled free-exercise-db metadata (Unlicense) + the user's custom exercises.
// Images are NOT bundled — they load on demand from a CDN pinned to the same commit as the JSON.

export const FREE_EXERCISE_DB_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
const IMG_CDN = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${FREE_EXERCISE_DB_COMMIT}/exercises/`
const IMG_RAW = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${FREE_EXERCISE_DB_COMMIT}/exercises/`

// Candidate URLs for one image path, in the order to try them (jsDelivr first, GitHub raw fallback).
export function imageCandidates(path) {
  return path ? [IMG_CDN + path, IMG_RAW + path] : []
}

export const MUSCLES = [
  'chest', 'shoulders', 'triceps', 'biceps', 'forearms', 'lats', 'middle back', 'lower back', 'traps',
  'neck', 'abdominals', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors',
]

export const EQUIPMENT = [
  'machine', 'cable', 'barbell', 'dumbbell', 'body only', 'kettlebells', 'e-z curl bar', 'bands',
  'medicine ball', 'exercise ball', 'foam roll', 'other', 'none',
]

export const CATEGORIES = ['strength', 'powerlifting', 'olympic weightlifting', 'strongman', 'plyometrics', 'cardio', 'stretching']

export const CUSTOM_PREFIX = 'custom:'
export const isCustomId = id => typeof id === 'string' && id.startsWith(CUSTOM_PREFIX)

export function titleCase(s) {
  return (s || '').replace(/\b\w/g, c => c.toUpperCase())
}

function normalizeLibrary(e) {
  return {
    id: e.id,
    name: e.name,
    primary: e.primaryMuscles || [],
    secondary: e.secondaryMuscles || [],
    equipment: e.equipment || 'none',
    category: e.category || 'strength',
    level: e.level,
    force: e.force,
    mechanic: e.mechanic,
    instructions: e.instructions || [],
    images: e.images || [],
    source: 'library',
  }
}

let libraryPromise = null
// ~870 KB of JSON (≈160 KB gzipped) → loaded as its own chunk the first time the Gym tab needs it.
export function loadLibrary() {
  if (!libraryPromise) {
    libraryPromise = import('../data/free-exercise-db.json')
      .then(m => m.default.map(normalizeLibrary))
      .catch(err => { libraryPromise = null; throw err })
  }
  return libraryPromise
}

export function customToExercise(row, libraryById) {
  const base = row.based_on ? libraryById?.get(row.based_on) : null
  return {
    id: CUSTOM_PREFIX + row.id,
    name: row.name,
    primary: row.primary_muscles || [],
    secondary: row.secondary_muscles || [],
    equipment: row.equipment || 'machine',
    category: row.category || 'strength',
    level: null,
    force: row.force || base?.force || null,
    mechanic: row.mechanic || base?.mechanic || null,
    instructions: base?.instructions || [],
    images: base?.images || [],
    notes: row.notes || '',
    basedOn: row.based_on || null,
    archived: !!row.archived,
    source: 'custom',
    row,
  }
}

// Placeholder for ids that no longer resolve (e.g. library bumped, custom row missing).
export function unknownExercise(id) {
  return {
    id, name: isCustomId(id) ? 'Custom exercise' : String(id).replace(/_/g, ' '),
    primary: [], secondary: [], equipment: 'other', category: 'strength', instructions: [], images: [],
    source: 'unknown',
  }
}

export function buildIndex(library, customRows) {
  const libById = new Map(library.map(e => [e.id, e]))
  const customs = customRows.map(r => customToExercise(r, libById))
  const all = [...customs, ...library]
  const byId = new Map(all.map(e => [e.id, e]))
  return { all, byId, customs }
}

// ── Search ───────────────────────────────────────────────────────────────────

export function searchExercises(all, { q = '', muscle = '', equipment = '', category = '', includeArchived = false } = {}) {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const res = all.filter(e => {
    if (!includeArchived && e.archived) return false
    if (muscle && !e.primary.includes(muscle) && !e.secondary.includes(muscle)) return false
    if (equipment && e.equipment !== equipment) return false
    if (category && e.category !== category) return false
    if (!tokens.length) return true
    const hay = `${e.name} ${e.primary.join(' ')} ${e.equipment}`.toLowerCase()
    return tokens.every(t => hay.includes(t))
  })
  const ql = q.toLowerCase().trim()
  const rank = e => (e.source === 'custom' ? 0 : 2)
    + (muscle && !e.primary.includes(muscle) ? 1 : 0) // primary-muscle hits before secondary
    - (ql && e.name.toLowerCase().startsWith(ql) ? 2 : 0)
  return res.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

// ── Swap alternatives ────────────────────────────────────────────────────────
// Candidates must share at least one primary muscle. Exact primary-muscle match ranks
// highest; the user's own custom machines and exercises they've done before get a boost
// (they actually exist in this gym).
export function findAlternatives(ex, all, { historyIds = new Set(), limit = 40 } = {}) {
  if (!ex || !ex.primary.length) return []
  const prim = new Set(ex.primary)
  const out = []
  for (const c of all) {
    if (c.id === ex.id || c.archived) continue
    if (c.category === 'stretching' && ex.category !== 'stretching') continue
    const overlap = c.primary.filter(m => prim.has(m)).length
    if (!overlap) continue
    let score = overlap * 20
    const exact = overlap === prim.size && c.primary.length === prim.size
    if (exact) score += 100
    else if (overlap === prim.size) score += 60
    score += c.secondary.filter(m => ex.secondary.includes(m)).length * 5
    if (c.mechanic && c.mechanic === ex.mechanic) score += 10
    if (c.force && c.force === ex.force) score += 5
    if (c.equipment === ex.equipment) score += 12 // machine taken → another machine is the easiest swap
    if (['strength', 'powerlifting'].includes(c.category)) score += 10
    if (c.source === 'custom') score += 15
    if (historyIds.has(c.id)) score += 10
    out.push({ ex: c, score, exact })
  }
  return out.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name)).slice(0, limit)
}
