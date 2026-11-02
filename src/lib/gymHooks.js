import { useCallback, useEffect, useMemo, useState } from 'react'
import { gymApi, isMissingTable, GYM_MOCK } from './gymApi'
import { buildIndex, loadLibrary } from './gymLibrary'
import { computeHrSummary, hrWindowOpen } from './gymLogic'

// Ticking clock for elapsed timers etc. (Date.now() must not be called during render.)
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const EMPTY = { settings: null, customs: [], routines: [], sessions: [], sets: [] }

export function useGym({ onSyncHr } = {}) {
  const [state, setState] = useState({ status: 'loading', error: null, missingTables: false, library: [], ...EMPTY })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadLibrary(), gymApi.loadAll()])
      .then(([library, res]) => {
        if (cancelled) return
        if (res.error) {
          setState(s => ({ ...s, status: 'error', library, error: res.error, missingTables: isMissingTable(res.error) }))
        } else {
          setState({ status: 'ready', error: null, missingTables: false, library, ...res.data })
        }
      })
      .catch(err => { if (!cancelled) setState(s => ({ ...s, status: 'error', error: { message: err.message } })) })
    return () => { cancelled = true }
  }, [reloadKey])

  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  const index = useMemo(() => buildIndex(state.library, state.customs), [state.library, state.customs])
  const sessionsById = useMemo(() => new Map(state.sessions.map(s => [s.id, s])), [state.sessions])
  const activeSession = useMemo(() => state.sessions.find(s => !s.ended_at) || null, [state.sessions])
  const historyIds = useMemo(() => new Set(state.sets.map(s => s.exercise_id)), [state.sets])

  const patch = useCallback(fn => setState(s => ({ ...s, ...fn(s) })), [])

  // ── mutators (each returns { data, error }) ──
  const actions = useMemo(() => {
    const replaceIn = (list, row) => list.map(x => (x.id === row.id ? row : x))

    async function saveSettings(values) {
      const res = await gymApi.saveSettings(values)
      if (!res.error) patch(s => ({ settings: { ...s.settings, ...values } }))
      return res
    }

    async function createCustom(row) {
      const res = await gymApi.createCustom(row)
      if (!res.error) patch(s => ({ customs: [...s.customs, res.data].sort((a, b) => a.name.localeCompare(b.name)) }))
      return res
    }

    async function updateCustom(id, values) {
      const res = await gymApi.updateCustom(id, values)
      if (!res.error) patch(s => ({ customs: replaceIn(s.customs, res.data) }))
      return res
    }

    async function saveRoutine(routine) {
      const res = await gymApi.saveRoutine(routine)
      if (!res.error) {
        patch(s => {
          const exists = s.routines.some(r => r.id === res.data.id)
          const routines = exists ? replaceIn(s.routines, res.data) : [...s.routines, res.data]
          return { routines: routines.sort((a, b) => a.rotation_order - b.rotation_order) }
        })
      }
      return res
    }

    async function deleteRoutine(id) {
      const res = await gymApi.deleteRoutine(id)
      if (!res.error) {
        patch(s => ({
          routines: s.routines.filter(r => r.id !== id),
          sessions: s.sessions.map(x => (x.routine_id === id ? { ...x, routine_id: null } : x)),
        }))
      }
      return res
    }

    async function startSession(routine) {
      const res = await gymApi.startSession({
        routine_id: routine?.id ?? null,
        routine_name: routine?.name ?? 'Free session',
        started_at: new Date().toISOString(),
      })
      if (!res.error) patch(s => ({ sessions: [res.data, ...s.sessions] }))
      return res
    }

    async function updateSession(id, values) {
      const res = await gymApi.updateSession(id, values)
      if (!res.error) patch(s => ({ sessions: replaceIn(s.sessions, res.data) }))
      return res
    }

    async function deleteSession(id) {
      const res = await gymApi.deleteSession(id)
      if (!res.error) patch(s => ({ sessions: s.sessions.filter(x => x.id !== id), sets: s.sets.filter(x => x.session_id !== id) }))
      return res
    }

    async function addSet(row) {
      const res = await gymApi.addSet(row)
      if (!res.error) patch(s => ({ sets: [...s.sets, res.data] }))
      return res
    }

    async function updateSet(id, values) {
      const res = await gymApi.updateSet(id, values)
      if (!res.error) patch(s => ({ sets: replaceIn(s.sets, res.data) }))
      return res
    }

    async function deleteSet(id) {
      const res = await gymApi.deleteSet(id)
      if (!res.error) patch(s => ({ sets: s.sets.filter(x => x.id !== id) }))
      return res
    }

    // Computes the HR summary for a finished session from heart_rate_intraday and stores it.
    // Returns { data: session, error, status: 'ok' | 'expired' | 'nodata' }.
    async function computeSessionHr(session, hrMax) {
      if (!session.ended_at) return { data: session, error: null, status: 'open' }
      if (!hrWindowOpen(session, Date.now())) return { data: session, error: null, status: 'expired' }
      if (onSyncHr && !GYM_MOCK) {
        // Pull the latest Fitbit samples first; a failed sync shouldn't block the summary.
        try { await onSyncHr() } catch (e) { console.warn('VITALS gym: HR sync before summary failed', e) }
      }
      const hr = await gymApi.fetchHr(session.started_at, session.ended_at)
      if (hr.error) return { data: session, error: hr.error, status: 'error' }
      const summary = computeHrSummary(hr.data, hrMax)
      if (!summary) return { data: session, error: null, status: 'nodata' }
      const res = await updateSession(session.id, { ...summary, hr_computed_at: new Date().toISOString() })
      return { ...res, status: res.error ? 'error' : 'ok' }
    }

    async function finishSession(session, hrMax) {
      const res = await updateSession(session.id, { ended_at: new Date().toISOString() })
      if (res.error) return { ...res, hrStatus: 'error' }
      const hr = await computeSessionHr(res.data, hrMax)
      return { data: hr.data, error: null, hrStatus: hr.status, hrError: hr.error }
    }

    return {
      saveSettings, createCustom, updateCustom, saveRoutine, deleteRoutine, startSession, updateSession,
      deleteSession, addSet, updateSet, deleteSet, computeSessionHr, finishSession,
    }
  }, [patch, onSyncHr])

  return { ...state, index, sessionsById, activeSession, historyIds, reload, actions }
}

export function useRecovery() {
  const [rows, setRows] = useState([])
  useEffect(() => {
    let cancelled = false
    gymApi.fetchRecovery().then(res => { if (!cancelled && !res.error) setRows(res.data || []) })
    return () => { cancelled = true }
  }, [])
  return rows
}

// Small localStorage helper (per-device conveniences only — e.g. un-logged swaps of the open session).
export function readLocal(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback }
}
export function writeLocal(key, value) {
  try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}
