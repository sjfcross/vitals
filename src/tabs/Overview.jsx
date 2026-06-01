import { useState, useRef } from 'react'
import { BarChart, Bar, Cell, ResponsiveContainer, ReferenceLine } from 'recharts'
import dayjs from 'dayjs'
import { CircularRing } from '../components/CircularRing'
import { LogMealSheet } from '../components/LogMealSheet'
import { useWeekMeals } from '../hooks/useMeals'

function handleDelete(id, name, onDeleteMeal) {
  if (window.confirm(`Delete "${name}"?`)) onDeleteMeal(id)
}

export function Overview({ meals, activity, profile, date, today, onAddMeal, onDeleteMeal, onDateChange }) {
  const [showLog, setShowLog] = useState(false)
  const dateInputRef = useRef(null)
  const weekData = useWeekMeals(date)
  const isToday = date === today

  const targets = {
    calories: profile?.target_calories || 2000,
    sodium: profile?.target_sodium_mg || 2500,
    protein: profile?.target_protein_g || 150,
    steps: profile?.target_steps || 10000,
  }

  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    sodium: acc.sodium + (m.sodium_mg || 0),
    protein: acc.protein + (m.protein_g || 0),
  }), { calories: 0, sodium: 0, protein: 0 })

  const steps = activity?.steps || 0
  const km = activity?.km || (steps * 0.00075).toFixed(2)

  return (
    <div style={{ padding: '0 16px 100px' }}>

      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono" style={{ fontSize: '0.78rem', color: isToday ? '#e8784a' : '#9ca0a4', letterSpacing: '0.04em' }}>
            {isToday ? 'TODAY' : dayjs(date).format('MMM D, YYYY')}
          </span>
          <button
            onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: '0.72rem', color: '#9ca0a4', lineHeight: 1.4 }}
            title="Pick a date"
          >
            📅
          </button>
          <input
            ref={dateInputRef}
            type="date"
            max={today}
            value={date}
            onChange={e => e.target.value && onDateChange(e.target.value)}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
          />
        </div>
        {!isToday && (
          <button
            onClick={() => onDateChange(today)}
            style={{ background: 'none', border: '1px solid rgba(232,120,74,0.35)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontSize: '0.68rem', color: '#e8784a', letterSpacing: '0.04em' }}
          >
            Back to today
          </button>
        )}
      </div>

      {/* Rings */}
      <div className="card fade-up stagger-1" style={{ display: 'flex', justifyContent: 'space-around', padding: '20px 0', marginTop: 16, marginBottom: 0, borderRadius: 'var(--radius-lg)' }}>
        <CircularRing label="Calories" value={totals.calories} target={targets.calories} color="var(--calories)" />
        <CircularRing label="Sodium" value={totals.sodium} target={targets.sodium} color="var(--sodium)" unit="mg" />
        <CircularRing label="Protein" value={Math.round(totals.protein)} target={targets.protein} color="var(--protein)" unit="g" />
      </div>

      {/* Steps + Weight row */}
      <div className="fade-up stagger-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10, marginTop: 10 }}>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 8 }}>STEPS</div>
          <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 500, color: '#b47fdb' }}>
            {steps.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b6f73', marginTop: 2 }}>{km} km</div>
          <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${Math.min(steps / targets.steps, 1) * 100}%`, background: '#b47fdb', borderRadius: 2, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize: '0.68rem', color: '#6b6f73', marginTop: 4 }}>goal: {targets.steps.toLocaleString()}</div>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 8 }}>ACTIVE</div>
          <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 500, color: '#f0c96a' }}>
            {activity?.active_minutes || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b6f73', marginTop: 2 }}>minutes</div>
          {activity?.workout_type && (
            <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#9ca0a4', background: 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '3px 7px', display: 'inline-block' }}>
              {activity.workout_type}
            </div>
          )}
        </div>
      </div>

      {/* Weekly calorie bar chart */}
      <div className="card fade-up stagger-3" style={{ padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 12 }}>WEEK — CALORIES</div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={weekData} barSize={24} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
            <ReferenceLine y={targets.calories} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <Bar dataKey="kcal" radius={[3, 3, 0, 0]}>
              {weekData.map((d, i) => (
                <Cell key={i} fill={d.date === date ? '#e8784a' : 'rgba(255,255,255,0.1)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          {weekData.map((d, i) => (
            <span key={i} style={{ fontSize: '0.62rem', color: d.date === date ? '#e8784a' : '#6b6f73', flex: 1, textAlign: 'center' }}>
              {d.label}
            </span>
          ))}
        </div>
      </div>

      {/* Meal list */}
      <div className="fade-up stagger-4">
        <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 10 }}>{isToday ? "TODAY'S MEALS" : `${dayjs(date).format('MMM D').toUpperCase()} — MEALS`}</div>
        {meals.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6b6f73', fontSize: '0.85rem', padding: '24px 0' }}>
            No meals logged yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {meals.map(m => (
              <div key={m.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{m.emoji || '🍽️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f0eeea', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.name}
                  </div>
                  {m.description && (
                    <div style={{ fontSize: '0.72rem', color: '#9ca0a4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.description}
                    </div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: '#6b6f73', marginTop: 2 }}>
                    {m.time?.slice(0, 5)}
                    {m.source === 'claude' && <span style={{ marginLeft: 6, color: '#6ec87a' }}>✨ AI</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div>
                    {m.calories && <div className="mono" style={{ fontSize: '0.85rem', color: '#e8784a' }}>{m.calories} kcal</div>}
                    {m.sodium_mg && <div className="mono" style={{ fontSize: '0.72rem', color: '#5ba4e6' }}>{m.sodium_mg}mg Na</div>}
                  </div>
                  <button
                    onClick={() => handleDelete(m.id, m.name, onDeleteMeal)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '0.85rem', color: '#6b6f73', lineHeight: 1 }}
                    title="Delete meal"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log meal CTA */}
      <div style={{
        position: 'fixed',
        bottom: 'max(76px, calc(60px + env(safe-area-inset-bottom)))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(calc(100% - 32px), 448px)',
      }}>
        <button className="btn-primary fade-up stagger-5" onClick={() => setShowLog(true)}>
          + Log meal
        </button>
      </div>

      {showLog && (
        <LogMealSheet
          date={date}
          onClose={() => setShowLog(false)}
          onSave={onAddMeal}
        />
      )}
    </div>
  )
}
