// Gym tab — library, routines, guided sessions, history. Self-contained: all gym state lives in
// useGym(); App.jsx only passes `today`, the weight history (relative strength) and the HR sync.
import { useState } from 'react'
import { useGym, readLocal, writeLocal } from '../lib/gymHooks'
import { GYM_MOCK, resetMockData } from '../lib/gymApi'
import { LibraryBrowser } from '../components/gym/LibraryBrowser'
import { ExerciseDetail } from '../components/gym/ExerciseDetail'
import { CustomExerciseForm } from '../components/gym/CustomExerciseForm'
import { RoutineEditor } from '../components/gym/RoutineEditor'
import { SessionView } from '../components/gym/SessionView'
import { SessionSummary } from '../components/gym/SessionSummary'
import { Segmented, Sheet } from '../components/gym/GymUi'
import { C, fieldLabel, iconBtn } from '../components/gym/gymStyles'
import { GymToday } from './GymToday'
import { GymRoutines } from './GymRoutines'
import { GymHistory } from './GymHistory'

const VIEWS = [
  { id: 'today', label: 'Today' },
  { id: 'library', label: 'Library' },
  { id: 'routines', label: 'Routines' },
  { id: 'history', label: 'History' },
]
const VIEW_KEY = 'vitals-gym-view'

export function Gym({ today, weightEntries = [], onSyncHr }) {
  const gym = useGym({ onSyncHr })
  const [view, setViewState] = useState(() => readLocal(VIEW_KEY, 'today'))
  const [detail, setDetail] = useState(null)              // exercise object
  const [customForm, setCustomForm] = useState(null)      // { row } | { row: null }
  const [routineEdit, setRoutineEdit] = useState(null)    // { routine } (routine null → new)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [summary, setSummary] = useState(null)            // { id, justFinished, hrStatus }
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState(null)

  const setView = v => { setViewState(v); writeLocal(VIEW_KEY, v) }

  if (gym.status === 'loading') {
    return <div className="mono" style={{ padding: 40, textAlign: 'center', color: C.subtle, fontSize: '0.78rem', letterSpacing: '0.1em' }}>LOADING GYM…</div>
  }
  if (gym.status === 'error') {
    return (
      <div style={{ padding: '16px 16px 100px' }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ color: C.danger, fontSize: '0.74rem', letterSpacing: '0.08em' }}>
            {gym.missingTables ? 'GYM TABLES NOT FOUND' : 'COULD NOT LOAD GYM DATA'}
          </div>
          <div style={{ fontSize: '0.82rem', color: C.muted, lineHeight: 1.55, marginTop: 10 }}>
            {gym.missingTables
              ? <>The database migration hasn’t been applied yet. Run <code className="mono" style={{ color: C.text }}>supabase/migrations/20261102120000_gym.sql</code> against the project (see README → Gym), then retry.</>
              : gym.error?.message}
          </div>
          <button className="btn-ghost" style={{ marginTop: 14 }} onClick={gym.reload}>Retry</button>
        </div>
      </div>
    )
  }

  const { actions, settings } = gym
  const active = gym.activeSession
  const activeRoutine = active ? gym.routines.find(r => r.id === active.routine_id) || null : null
  const summarySession = summary ? gym.sessionsById.get(summary.id) : null

  async function startSession(routine) {
    if (active) { setSessionOpen(true); return }
    const res = await actions.startSession(routine)
    if (res.error) setError(res.error.message || 'Could not start the session')
    else { setError(null); setSessionOpen(true) }
  }

  async function saveCustom(row) {
    const res = customForm?.row ? await actions.updateCustom(customForm.row.id, row) : await actions.createCustom(row)
    if (!res.error) { setCustomForm(null); setDetail(null) }
    return res
  }

  const openExercise = ex => setDetail(ex)

  return (
    <div style={{ padding: '14px 16px 100px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <Segmented options={VIEWS} value={view} onChange={setView} style={{ flex: 1 }} />
        <button type="button" style={iconBtn} onClick={() => setSettingsOpen(true)} aria-label="Gym settings">⚙</button>
      </div>

      {GYM_MOCK && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: 'rgba(240,201,106,0.08)', border: '1px solid rgba(240,201,106,0.2)', marginBottom: 12 }}>
          <span className="mono" style={{ fontSize: '0.62rem', color: C.warn, letterSpacing: '0.06em' }}>DEMO DATA</span>
          <span style={{ fontSize: '0.68rem', color: C.muted, flex: 1 }}>Mock mode — nothing is saved to Supabase.</span>
        </div>
      )}
      {error && <div style={{ fontSize: '0.78rem', color: C.danger, marginBottom: 10 }}>{error}</div>}

      {view === 'today' && (
        <GymToday gym={gym} today={today}
          onStart={startSession} onResume={() => setSessionOpen(true)}
          onOpenSession={id => setSummary({ id })} onOpenExercise={openExercise}
          onGoRoutines={() => { setView('routines'); setRoutineEdit({ routine: null }) }} onGoLibrary={() => setView('library')} />
      )}
      {view === 'library' && (
        <LibraryBrowser all={gym.index.all} historyIds={gym.historyIds} onOpen={openExercise} onCreateCustom={() => setCustomForm({ row: null })} />
      )}
      {view === 'routines' && (
        <GymRoutines gym={gym} onEditRoutine={r => setRoutineEdit({ routine: r })} onNewCustom={() => setCustomForm({ row: null })} onOpenExercise={openExercise} />
      )}
      {view === 'history' && (
        <GymHistory gym={gym} onOpenSession={id => setSummary({ id })} onOpenExercise={openExercise} />
      )}

      {routineEdit && (
        <RoutineEditor routine={routineEdit.routine} routines={gym.routines} gym={gym} weightEntries={weightEntries}
          onClose={() => setRoutineEdit(null)}
          onSave={async r => { const res = await actions.saveRoutine(r); if (!res.error) setRoutineEdit(null); return res }}
          onDelete={async r => { const res = await actions.deleteRoutine(r.id); if (!res.error) setRoutineEdit(null); else setError(res.error.message) }} />
      )}

      {sessionOpen && active && (
        <SessionView key={active.id} session={active} routine={activeRoutine} gym={gym} weightEntries={weightEntries}
          onMinimize={() => setSessionOpen(false)}
          onFinished={(id, hrStatus) => { setSessionOpen(false); setSummary({ id, justFinished: true, hrStatus }) }}
          onDiscarded={() => setSessionOpen(false)} />
      )}

      {summarySession && (
        <SessionSummary session={summarySession} gym={gym} justFinished={summary.justFinished} hrStatus={summary.hrStatus}
          onClose={() => setSummary(null)} onOpenExercise={openExercise}
          onDelete={async s => { const res = await actions.deleteSession(s.id); if (!res.error) setSummary(null); else setError(res.error.message) }} />
      )}

      {detail && (
        <ExerciseDetail exercise={detail} sets={gym.sets} sessionsById={gym.sessionsById} weightEntries={weightEntries} z={summarySession ? 10 : 0}
          onClose={() => setDetail(null)}
          onEditCustom={ex => setCustomForm({ row: ex.row })}
          onArchiveCustom={async ex => { const res = await actions.updateCustom(ex.row.id, { archived: true }); if (!res.error) setDetail(null) }} />
      )}

      {customForm && (
        <CustomExerciseForm initial={customForm.row} library={gym.library} z={20} onClose={() => setCustomForm(null)} onSave={saveCustom} />
      )}

      {settingsOpen && <GymSettings settings={settings} onSave={actions.saveSettings} onClose={() => setSettingsOpen(false)} onReload={gym.reload} />}
    </div>
  )
}

function GymSettings({ settings, onSave, onClose, onReload }) {
  const [hrMax, setHrMax] = useState(String(settings.hr_max))
  const [rest, setRest] = useState(String(settings.default_rest_seconds))
  const [inc, setInc] = useState(String(settings.default_increment_kg))
  const [msg, setMsg] = useState(null)

  async function save() {
    const values = {
      hr_max: Math.min(230, Math.max(120, parseInt(hrMax, 10) || 185)),
      default_rest_seconds: Math.min(900, Math.max(0, parseInt(rest, 10) || 90)),
      default_increment_kg: Math.max(0.25, parseFloat(inc.replace(',', '.')) || 2.5),
    }
    const res = await onSave(values)
    if (res.error) setMsg(res.error.message); else onClose()
  }

  return (
    <Sheet onClose={onClose} title="Gym settings">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={fieldLabel}>MAX HEART RATE (BPM)</label>
          <input className="input mono" inputMode="numeric" value={hrMax} onChange={e => setHrMax(e.target.value)} />
          <div style={{ fontSize: '0.66rem', color: C.subtle, marginTop: 5, lineHeight: 1.45 }}>
            Used for HR zones (Z1 50–60 % … Z5 90–100 %). “220 − age” is a rough start; the highest value you’ve seen in a hard effort is better.
            Only new summaries use a changed value.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={fieldLabel}>DEFAULT REST (S)</label>
            <input className="input mono" inputMode="numeric" value={rest} onChange={e => setRest(e.target.value)} />
          </div>
          <div>
            <label style={fieldLabel}>DEFAULT +KG STEP</label>
            <input className="input mono" inputMode="decimal" value={inc} onChange={e => setInc(e.target.value)} />
          </div>
        </div>
        {msg && <div style={{ fontSize: '0.76rem', color: C.danger }}>{msg}</div>}
        <button className="btn-primary" onClick={save}>Save</button>
        {GYM_MOCK && (
          <button className="btn-ghost" onClick={() => { resetMockData(); onReload(); onClose() }}>Reset demo data</button>
        )}
      </div>
    </Sheet>
  )
}
