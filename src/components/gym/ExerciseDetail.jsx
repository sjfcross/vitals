import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { exerciseBest, exerciseSeries, lastSessionSets, bodyweightOn, fmtKg } from '../../lib/gymLogic'
import { titleCase } from '../../lib/gymLibrary'
import { ExerciseAnimation } from './ExerciseMedia'
import { ProgressChart } from './ProgressChart'
import { Badge, MuscleTags, Sheet, StatTile, ConfirmRow } from './GymUi'
import { C, label } from './gymStyles'

export function ExerciseDetail({ exercise: ex, sets, sessionsById, weightEntries, onClose, z = 0, selectLabel, onSelect, onEditCustom, onArchiveCustom }) {
  const [showSteps, setShowSteps] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const mine = useMemo(() => sets.filter(s => s.exercise_id === ex.id && sessionsById.has(s.session_id)), [sets, ex.id, sessionsById])
  const best = useMemo(() => exerciseBest(mine), [mine])
  const series = useMemo(() => exerciseSeries(ex.id, sets, sessionsById), [ex.id, sets, sessionsById])
  const last = useMemo(() => lastSessionSets(ex.id, sets, sessionsById), [ex.id, sets, sessionsById])
  const bw = useMemo(() => bodyweightOn('9999-12-31', weightEntries), [weightEntries]) // latest weigh-in
  const rel = best.e1rm != null && bw ? (best.e1rm / bw).toFixed(2) : null

  const meta = [ex.equipment, ex.category, ex.level, ex.mechanic, ex.force].filter(Boolean)

  return (
    <Sheet onClose={onClose} z={z}>
      <ExerciseAnimation key={ex.id} exercise={ex} />

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: C.text, lineHeight: 1.25 }}>{ex.name}</div>
          <div style={{ fontSize: '0.72rem', color: C.subtle, marginTop: 4 }}>{meta.map(titleCase).join(' · ')}</div>
        </div>
        {ex.source === 'custom' && <Badge>MINE</Badge>}
      </div>

      <div style={{ marginTop: 10 }}><MuscleTags primary={ex.primary} secondary={ex.secondary} size="md" /></div>
      {ex.notes && <div style={{ marginTop: 10, fontSize: '0.8rem', color: C.muted, lineHeight: 1.45 }}>📝 {ex.notes}</div>}

      {selectLabel && onSelect && (
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => onSelect(ex)}>{selectLabel}</button>
      )}

      {/* Personal numbers */}
      <div style={{ ...label, marginTop: 20, marginBottom: 8 }}>YOUR NUMBERS</div>
      {mine.length ? (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <StatTile label="BEST e1RM" value={best.e1rm != null ? fmtKg(best.e1rm) : '–'} unit={best.e1rm != null ? 'kg' : ''} color={C.accent}
              sub={rel ? `${rel}× bodyweight` : 'Epley, ≤ 12 reps'} />
            <StatTile label={best.weight != null ? 'HEAVIEST' : 'MOST REPS'} value={best.weight != null ? fmtKg(best.weight) : (best.bwReps ?? '–')}
              unit={best.weight != null ? 'kg' : 'reps'} sub={`${series.length} session${series.length === 1 ? '' : 's'}`} />
          </div>
          {last.session && (
            <div className="card" style={{ padding: '10px 12px', marginTop: 8 }}>
              <div style={{ fontSize: '0.66rem', color: C.subtle, marginBottom: 4 }}>LAST · {dayjs(last.session.started_at).format('ddd, MMM D')}</div>
              <div className="mono" style={{ fontSize: '0.82rem', color: C.text }}>
                {last.sets.map(s => `${fmtKg(s.weight_kg)}×${s.reps}`).join('  ·  ')}
              </div>
            </div>
          )}
          <div className="card" style={{ padding: '12px 12px 10px', marginTop: 8 }}>
            <div style={{ ...label, marginBottom: 8 }}>PROGRESS</div>
            <ProgressChart series={series} />
          </div>
        </>
      ) : (
        <div style={{ fontSize: '0.78rem', color: C.subtle }}>Not logged yet.</div>
      )}

      {/* How-to */}
      {ex.instructions?.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <button type="button" onClick={() => setShowSteps(v => !v)}
            style={{ display: 'flex', width: '100%', justifyContent: 'space-between', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <span style={label}>HOW TO ({ex.instructions.length} STEPS)</span>
            <span style={{ fontSize: '0.75rem', color: C.subtle, transform: showSteps ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
          </button>
          {showSteps && (
            <ol style={{ margin: '10px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ex.instructions.map((s, i) => <li key={i} style={{ fontSize: '0.8rem', color: C.muted, lineHeight: 1.5 }}>{s}</li>)}
            </ol>
          )}
        </div>
      )}

      {ex.source === 'custom' && (onEditCustom || onArchiveCustom) && (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {confirmArchive ? (
            <ConfirmRow text="Hide from library? Logs are kept." confirmLabel="Archive"
              onConfirm={() => { onArchiveCustom(ex); setConfirmArchive(false) }} onCancel={() => setConfirmArchive(false)} />
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              {onEditCustom && <button className="btn-ghost" style={{ flex: 1 }} onClick={() => onEditCustom(ex)}>Edit</button>}
              {onArchiveCustom && <button className="btn-ghost" style={{ flex: 1, color: C.danger }} onClick={() => setConfirmArchive(true)}>Archive</button>}
            </div>
          )}
        </div>
      )}

      {ex.source === 'library' && (
        <div style={{ marginTop: 18, fontSize: '0.62rem', color: C.faint, lineHeight: 1.4 }}>
          Exercise data &amp; images: free-exercise-db (public domain).
        </div>
      )}
    </Sheet>
  )
}
