// Gym data layer. Same async interface for both backends; every call resolves to
// { data, error } like supabase-js, never throws.
//
//   • Supabase (default when VITE_SUPABASE_URL is set) — tables from
//     supabase/migrations/20261102120000_gym.sql, RLS-scoped to the signed-in user.
//   • Mock (auto when VITE_SUPABASE_URL is missing, or forced with VITE_GYM_MOCK=1) —
//     in-memory store seeded with demo data, persisted to localStorage when available.
import { supabase } from './supabase'
import { createSeed, emptyHr, mockHrSamples, mockId, mockRecovery } from './gymMock'

export const GYM_MOCK = !import.meta.env.VITE_SUPABASE_URL
  || import.meta.env.VITE_GYM_MOCK === '1'
  || (typeof window !== 'undefined' && window.__VITALS_GYM_MOCK__ === true) // set by the dev-only gym-preview.html

const SETTINGS_DEFAULTS = { hr_max: 185, default_rest_seconds: 90, default_increment_kg: 2.5 }

// PostgREST "relation does not exist" (migration not applied yet).
export function isMissingTable(error) {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message || '')
}

const ROUTINE_EX_FIELDS = ['exercise_id', 'position', 'target_sets', 'rep_min', 'rep_max', 'start_weight_kg', 'increment_kg', 'progression', 'rest_seconds', 'notes']
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]))

// ─────────────────────────────────────────────────────────────────────────────
// Supabase backend
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAllRows(build, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    rows.push(...data)
    if (data.length < pageSize) return { data: rows, error: null }
  }
}

const supabaseApi = {
  async loadAll() {
    const [settings, customs, routines, routineExercises, sessions, sets] = await Promise.all([
      supabase.from('gym_settings').select('*').maybeSingle(),
      supabase.from('gym_custom_exercises').select('*').order('name'),
      supabase.from('gym_routines').select('*').order('rotation_order').order('created_at'),
      supabase.from('gym_routine_exercises').select('*').order('position'),
      fetchAllRows(() => supabase.from('gym_sessions').select('*').order('started_at', { ascending: false })),
      fetchAllRows(() => supabase.from('gym_sets').select('*').order('created_at')),
    ])
    const error = [settings, customs, routines, routineExercises, sessions, sets].find(r => r.error)?.error
    if (error) return { data: null, error }
    return {
      data: {
        settings: { ...SETTINGS_DEFAULTS, ...(settings.data || {}) },
        customs: customs.data,
        routines: nestRoutines(routines.data, routineExercises.data),
        sessions: sessions.data,
        sets: sets.data,
      },
      error: null,
    }
  },

  async saveSettings(values) {
    const row = pick(values, ['hr_max', 'default_rest_seconds', 'default_increment_kg'])
    row.updated_at = new Date().toISOString()
    // user_id defaults to auth.uid(); pass it explicitly so the upsert's conflict target is unambiguous.
    const { data: { session } } = await supabase.auth.getSession()
    return supabase.from('gym_settings').upsert({ ...row, user_id: session?.user?.id }, { onConflict: 'user_id' }).select().single()
  },

  createCustom(row) {
    return supabase.from('gym_custom_exercises').insert(row).select().single()
  },

  updateCustom(id, patch) {
    return supabase.from('gym_custom_exercises').update(patch).eq('id', id).select().single()
  },

  // Saves routine + its exercises. Exercises are diffed (update kept ids, insert new, delete
  // removed) rather than replaced, so historical sets keep their routine_exercise_id link.
  async saveRoutine(routine) {
    const head = pick(routine, ['name', 'schedule_type', 'weekdays', 'rotation_order', 'notes', 'archived'])
    let saved
    if (routine.id) {
      const r = await supabase.from('gym_routines').update(head).eq('id', routine.id).select().single()
      if (r.error) return r
      saved = r.data
    } else {
      const r = await supabase.from('gym_routines').insert(head).select().single()
      if (r.error) return r
      saved = r.data
    }
    const { data: existing, error: exErr } = await supabase.from('gym_routine_exercises').select('id').eq('routine_id', saved.id)
    if (exErr) return { data: null, error: exErr }
    const wanted = (routine.exercises || []).map((e, i) => ({ ...e, position: i }))
    const keepIds = new Set(wanted.filter(e => e.id).map(e => e.id))
    const toDelete = existing.map(e => e.id).filter(id => !keepIds.has(id))
    if (toDelete.length) {
      const { error } = await supabase.from('gym_routine_exercises').delete().in('id', toDelete)
      if (error) return { data: null, error }
    }
    for (const e of wanted.filter(e => e.id)) {
      const { error } = await supabase.from('gym_routine_exercises').update(pick(e, ROUTINE_EX_FIELDS)).eq('id', e.id)
      if (error) return { data: null, error }
    }
    const inserts = wanted.filter(e => !e.id).map(e => ({ ...pick(e, ROUTINE_EX_FIELDS), routine_id: saved.id }))
    if (inserts.length) {
      const { error } = await supabase.from('gym_routine_exercises').insert(inserts)
      if (error) return { data: null, error }
    }
    const { data: exercises, error } = await supabase.from('gym_routine_exercises').select('*').eq('routine_id', saved.id).order('position')
    if (error) return { data: null, error }
    return { data: { ...saved, exercises }, error: null }
  },

  deleteRoutine(id) {
    return supabase.from('gym_routines').delete().eq('id', id)
  },

  startSession(row) {
    return supabase.from('gym_sessions').insert(row).select().single()
  },

  updateSession(id, patch) {
    return supabase.from('gym_sessions').update(patch).eq('id', id).select().single()
  },

  deleteSession(id) {
    return supabase.from('gym_sessions').delete().eq('id', id)
  },

  addSet(row) {
    return supabase.from('gym_sets').insert(row).select().single()
  },

  updateSet(id, patch) {
    return supabase.from('gym_sets').update(patch).eq('id', id).select().single()
  },

  deleteSet(id) {
    return supabase.from('gym_sets').delete().eq('id', id)
  },

  // Raw 5 s samples from heart_rate_intraday for a window → [{ t: ms, bpm }].
  async fetchHr(startIso, endIso) {
    const res = await fetchAllRows(() => supabase
      .from('heart_rate_intraday')
      .select('timestamp, bpm')
      .gte('timestamp', startIso)
      .lte('timestamp', endIso)
      .order('timestamp', { ascending: true }))
    if (res.error) return res
    return { data: res.data.map(r => ({ t: new Date(r.timestamp).getTime(), bpm: r.bpm })), error: null }
  },

  fetchRecovery() {
    return supabase.from('activity').select('date, resting_hr_bpm, hrv_rmssd').order('date', { ascending: false }).limit(14)
      .then(r => (r.error ? r : { data: [...r.data].reverse(), error: null }))
  },
}

function nestRoutines(routines, routineExercises) {
  return routines.map(r => ({
    ...r,
    exercises: routineExercises.filter(e => e.routine_id === r.id).sort((a, b) => a.position - b.position),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock backend
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_KEY = 'vitals-gym-mock-v1'
let mockDb = null

function mockLoadDb() {
  if (mockDb) return mockDb
  try {
    const raw = localStorage.getItem(MOCK_KEY)
    if (raw) mockDb = JSON.parse(raw)
  } catch { /* storage blocked → in-memory only */ }
  if (!mockDb) mockDb = createSeed(Date.now())
  return mockDb
}

function mockPersist() {
  try { localStorage.setItem(MOCK_KEY, JSON.stringify(mockDb)) } catch { /* in-memory only */ }
}

export function resetMockData() {
  mockDb = createSeed(Date.now())
  mockPersist()
}

const delay = (v) => new Promise(res => setTimeout(() => res(v), 60))
const ok = data => delay({ data: structuredClone(data), error: null })
const fail = message => delay({ data: null, error: { message } })

const mockApi = {
  loadAll() {
    const db = mockLoadDb()
    return ok({
      settings: { ...SETTINGS_DEFAULTS, ...db.settings },
      customs: [...db.customs].sort((a, b) => a.name.localeCompare(b.name)),
      routines: nestRoutines([...db.routines].sort((a, b) => a.rotation_order - b.rotation_order), db.routineExercises),
      sessions: [...db.sessions].sort((a, b) => b.started_at.localeCompare(a.started_at)),
      sets: [...db.sets].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    })
  },

  saveSettings(values) {
    const db = mockLoadDb()
    db.settings = { ...db.settings, ...pick(values, ['hr_max', 'default_rest_seconds', 'default_increment_kg']) }
    mockPersist()
    return ok(db.settings)
  },

  createCustom(row) {
    const db = mockLoadDb()
    const r = { archived: false, secondary_muscles: [], category: 'strength', ...row, id: mockId(), created_at: new Date().toISOString() }
    db.customs.push(r); mockPersist()
    return ok(r)
  },

  updateCustom(id, patch) {
    const db = mockLoadDb()
    const r = db.customs.find(c => c.id === id)
    if (!r) return fail('Custom exercise not found')
    Object.assign(r, patch); mockPersist()
    return ok(r)
  },

  saveRoutine(routine) {
    const db = mockLoadDb()
    const head = pick(routine, ['name', 'schedule_type', 'weekdays', 'rotation_order', 'notes', 'archived'])
    let r = routine.id && db.routines.find(x => x.id === routine.id)
    if (r) Object.assign(r, head)
    else { r = { notes: '', archived: false, weekdays: [], ...head, id: mockId(), created_at: new Date().toISOString() }; db.routines.push(r) }
    const wanted = (routine.exercises || []).map((e, i) => ({ ...e, position: i }))
    const keep = new Set(wanted.filter(e => e.id).map(e => e.id))
    db.routineExercises = db.routineExercises.filter(e => e.routine_id !== r.id || keep.has(e.id))
    for (const e of wanted) {
      const existing = e.id && db.routineExercises.find(x => x.id === e.id)
      if (existing) Object.assign(existing, pick(e, ROUTINE_EX_FIELDS))
      else db.routineExercises.push({ ...pick(e, ROUTINE_EX_FIELDS), id: mockId(), routine_id: r.id })
    }
    // Mirror ON DELETE SET NULL for removed slots.
    const live = new Set(db.routineExercises.map(e => e.id))
    db.sets.forEach(s => { if (s.routine_exercise_id && !live.has(s.routine_exercise_id)) s.routine_exercise_id = null })
    mockPersist()
    return ok({ ...r, exercises: db.routineExercises.filter(e => e.routine_id === r.id).sort((a, b) => a.position - b.position) })
  },

  deleteRoutine(id) {
    const db = mockLoadDb()
    const exIds = new Set(db.routineExercises.filter(e => e.routine_id === id).map(e => e.id))
    db.routines = db.routines.filter(r => r.id !== id)
    db.routineExercises = db.routineExercises.filter(e => e.routine_id !== id)
    db.sessions.forEach(s => { if (s.routine_id === id) s.routine_id = null })
    db.sets.forEach(s => { if (exIds.has(s.routine_exercise_id)) s.routine_exercise_id = null })
    mockPersist()
    return ok(null)
  },

  startSession(row) {
    const db = mockLoadDb()
    const now = new Date().toISOString()
    const s = { notes: '', ended_at: null, ...emptyHr(), started_at: now, ...row, id: mockId(), created_at: now }
    db.sessions.push(s); mockPersist()
    return ok(s)
  },

  updateSession(id, patch) {
    const db = mockLoadDb()
    const s = db.sessions.find(x => x.id === id)
    if (!s) return fail('Session not found')
    Object.assign(s, patch); mockPersist()
    return ok(s)
  },

  deleteSession(id) {
    const db = mockLoadDb()
    db.sessions = db.sessions.filter(s => s.id !== id)
    db.sets = db.sets.filter(s => s.session_id !== id)
    mockPersist()
    return ok(null)
  },

  addSet(row) {
    const db = mockLoadDb()
    const s = { routine_exercise_id: null, swapped_from_exercise_id: null, is_adhoc: false, ...row, id: mockId(), created_at: new Date().toISOString() }
    db.sets.push(s); mockPersist()
    return ok(s)
  },

  updateSet(id, patch) {
    const db = mockLoadDb()
    const s = db.sets.find(x => x.id === id)
    if (!s) return fail('Set not found')
    Object.assign(s, patch); mockPersist()
    return ok(s)
  },

  deleteSet(id) {
    const db = mockLoadDb()
    db.sets = db.sets.filter(s => s.id !== id); mockPersist()
    return ok(null)
  },

  fetchHr(startIso, endIso) {
    const db = mockLoadDb()
    // Seed the synthetic curve with the session that owns this window (stable per session).
    const owner = db.sessions.find(s => s.started_at === startIso)
    return ok(mockHrSamples(startIso, endIso, Date.now(), owner?.id || startIso))
  },

  fetchRecovery() {
    return ok(mockRecovery(Date.now()))
  },
}

export const gymApi = GYM_MOCK ? mockApi : supabaseApi
