import { HR_ZONES, hrWindowOpen } from '../../lib/gymLogic'
import { C, label } from './gymStyles'

// Session HR card: avg/max + minutes per zone (from the stored summary columns).
// `status` is the last compute result ('nodata' | 'expired' | 'error' | 'ok' | null).
export function HrSummary({ session, nowMs, onRefresh, refreshing, status }) {
  const has = session.hr_avg != null
  const canRefresh = !!session.ended_at && hrWindowOpen(session, nowMs) && onRefresh
  const zones = HR_ZONES.map(z => ({ ...z, min: Number(session[`hr_zone${z.zone}_min`] ?? 0) }))
  const total = zones.reduce((a, z) => a + z.min, 0)

  return (
    <div className="card" style={{ padding: '14px 14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: has ? 10 : 6 }}>
        <div style={label}>HEART RATE <span style={{ color: C.subtle }}>· INSPIRE 3</span></div>
        {canRefresh && (
          <button type="button" onClick={onRefresh} disabled={refreshing}
            style={{ background: 'none', border: 'none', color: C.hr, fontSize: '0.7rem', cursor: 'pointer', padding: 0 }}>
            {refreshing ? 'Syncing…' : has ? '↻ Recompute' : '↻ Sync & compute'}
          </button>
        )}
      </div>

      {has ? (
        <>
          <div style={{ display: 'flex', gap: 22, alignItems: 'baseline' }}>
            <div>
              <span className="mono" style={{ fontSize: '1.6rem', color: C.hr }}>{session.hr_avg}</span>
              <span style={{ fontSize: '0.68rem', color: C.muted, marginLeft: 4 }}>avg bpm</span>
            </div>
            <div>
              <span className="mono" style={{ fontSize: '1.15rem', color: C.text }}>{session.hr_max}</span>
              <span style={{ fontSize: '0.68rem', color: C.muted, marginLeft: 4 }}>max</span>
            </div>
          </div>
          {/* Stacked zone bar */}
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginTop: 12, background: 'rgba(255,255,255,0.04)' }} aria-hidden="true">
            {total > 0 && zones.filter(z => z.min > 0).map(z => (
              <div key={z.zone} style={{ flex: z.min, background: z.color, minWidth: 3 }} title={`${z.label} ${z.min} min`} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginTop: 8 }}>
            {zones.map(z => (
              <div key={z.zone} style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: '0.6rem', color: C.muted }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: z.color, display: 'inline-block' }} />{z.label}
                </div>
                <div className="mono" style={{ fontSize: '0.78rem', color: z.min > 0 ? C.text : C.faint, marginTop: 2 }}>{z.min.toFixed(z.min < 10 ? 1 : 0)}′</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.6rem', color: C.faint, marginTop: 8 }}>
            Zones = % of HRmax {session.hr_max_ref} · {session.hr_sample_count} samples
          </div>
        </>
      ) : (
        <div style={{ fontSize: '0.76rem', color: C.subtle, lineHeight: 1.5 }}>
          {!session.ended_at ? 'Computed when the session ends.'
            : !hrWindowOpen(session, nowMs) ? 'No summary — heart-rate samples are only kept for 48 h, and this session is older.'
              : status === 'error' ? 'Couldn’t read heart-rate data. Try again.'
                : 'No heart-rate samples for this window yet. Sync the Fitbit app on your phone, then tap “Sync & compute”.'}
        </div>
      )}
    </div>
  )
}
