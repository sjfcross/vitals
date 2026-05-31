import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

const DRV = {
  calories: 2000,
  protein_g: 50,
  fat_g: 65,
  fat_saturated_g: 20,
  carbs_g: 275,
  sugar_g: 50,
  fiber_g: 28,
  sodium_mg: 2300,
  calcium_mg: 1000,
  iron_mg: 18,
  potassium_mg: 4700,
  vitamin_c_mg: 90,
  vitamin_d_ug: 20,
}

function sum(meals, field) {
  return meals.reduce((a, m) => a + (m[field] || 0), 0)
}

function NutrientRow({ label, value, drv, unit, color, indent }) {
  const pct = drv > 0 ? Math.min(value / drv, 1) : 0
  const pctNum = drv > 0 ? Math.round((value / drv) * 100) : null
  const status = pctNum === null ? '–' : pctNum >= 80 ? '✓' : pctNum >= 50 ? '!' : '–'
  const statusColor = pctNum === null ? '#6b6f73' : pctNum >= 80 ? '#6ec87a' : pctNum >= 50 ? '#f0c96a' : '#6b6f73'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ width: 120, paddingLeft: indent ? 14 : 0, flexShrink: 0 }}>
        <span style={{ fontSize: indent ? '0.75rem' : '0.8rem', color: indent ? '#9ca0a4' : '#f0eeea' }}>{label}</span>
      </div>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: color || 'rgba(255,255,255,0.3)', borderRadius: 2, transition: 'width 0.5s' }} />
      </div>
      <div className="mono" style={{ width: 70, textAlign: 'right', fontSize: '0.78rem', color: '#f0eeea', flexShrink: 0 }}>
        {value % 1 === 0 ? value : value.toFixed(1)}{unit}
      </div>
      <div className="mono" style={{ width: 36, textAlign: 'right', fontSize: '0.72rem', color: '#9ca0a4', flexShrink: 0 }}>
        {pctNum !== null ? `${pctNum}%` : '–'}
      </div>
      <div style={{ width: 16, textAlign: 'center', fontSize: '0.75rem', color: statusColor, flexShrink: 0 }}>{status}</div>
    </div>
  )
}

export function Nutrition({ meals, profile }) {
  const targets = {
    calories: profile?.target_calories || 2000,
    sodium: profile?.target_sodium_mg || 2500,
    protein: profile?.target_protein_g || 150,
  }

  const t = {
    calories: Math.round(sum(meals, 'calories')),
    protein: sum(meals, 'protein_g'),
    fat: sum(meals, 'fat_g'),
    fat_sat: sum(meals, 'fat_saturated_g'),
    carbs: sum(meals, 'carbs_g'),
    sugar: sum(meals, 'sugar_g'),
    sugar_added: sum(meals, 'sugar_added_g'),
    fiber: sum(meals, 'fiber_g'),
    sodium: Math.round(sum(meals, 'sodium_mg')),
    calcium: Math.round(sum(meals, 'calcium_mg')),
    iron: sum(meals, 'iron_mg'),
    potassium: Math.round(sum(meals, 'potassium_mg')),
    vitamin_c: sum(meals, 'vitamin_c_mg'),
    vitamin_d: sum(meals, 'vitamin_d_ug'),
  }

  const macroTotal = t.protein * 4 + t.fat * 9 + t.carbs * 4
  const donutData = macroTotal > 0 ? [
    { name: 'Protein', value: Math.round(t.protein * 4), color: '#6ec87a' },
    { name: 'Fat', value: Math.round(t.fat * 9), color: '#c97fd4' },
    { name: 'Carbs', value: Math.round(t.carbs * 4), color: '#f0c96a' },
  ] : [{ name: 'Empty', value: 1, color: 'rgba(255,255,255,0.06)' }]

  const remaining = Math.max(0, targets.calories - t.calories)

  return (
    <div style={{ padding: '0 16px 100px' }}>
      {/* Calorie hero */}
      <div className="card-lg fade-up stagger-1" style={{ padding: '20px', marginBottom: 12, marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ width: 110, height: 110, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} innerRadius={35} outerRadius={52} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: 1 }}>
            <div className="mono" style={{ fontSize: '2rem', fontWeight: 500, color: '#e8784a', lineHeight: 1 }}>
              {t.calories.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9ca0a4', marginTop: 2 }}>kcal today</div>
            <div style={{ marginTop: 10, fontSize: '0.75rem', color: '#6b6f73' }}>
              {remaining > 0 ? `${remaining} remaining` : `${Math.abs(remaining)} over target`}
            </div>
            <div style={{ marginTop: 6, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${Math.min(t.calories / targets.calories, 1) * 100}%`, background: '#e8784a', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: '0.68rem', color: '#6b6f73', marginTop: 3 }}>target: {targets.calories.toLocaleString()} kcal</div>
          </div>
        </div>

        {/* Macro legend */}
        <div style={{ marginTop: 16, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Protein', g: t.protein, color: '#6ec87a', target: targets.protein },
            { label: 'Fat', g: t.fat, color: '#c97fd4', target: DRV.fat_g },
            { label: 'Carbs', g: t.carbs, color: '#f0c96a', target: DRV.carbs_g },
          ].map(m => (
            <div key={m.label} style={{ flex: 1, minWidth: 70 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }} />
                <span style={{ fontSize: '0.7rem', color: '#9ca0a4' }}>{m.label}</span>
              </div>
              <div className="mono" style={{ fontSize: '0.95rem', color: '#f0eeea' }}>{m.g.toFixed(1)}g</div>
              <div style={{ fontSize: '0.65rem', color: '#6b6f73' }}>{Math.round((m.g / m.target) * 100)}% of {m.target}g</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sodium */}
      <div className="card fade-up stagger-2" style={{ padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em' }}>SODIUM</span>
          <span className="mono" style={{ fontSize: '0.8rem', color: '#5ba4e6' }}>{t.sodium}mg</span>
        </div>
        <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
          <div style={{ position: 'absolute', left: `${(1500 / targets.sodium) * 100}%`, top: -3, width: 1, height: 12, background: '#6ec87a' }} />
          <div style={{ position: 'absolute', left: `${(2300 / targets.sodium) * 100}%`, top: -3, width: 1, height: 12, background: '#e8784a' }} />
          <div style={{ height: '100%', width: `${Math.min(t.sodium / targets.sodium, 1) * 100}%`, background: t.sodium > 2300 ? '#e8784a' : t.sodium > 1500 ? '#f0c96a' : '#5ba4e6', borderRadius: 3, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: '0.65rem', color: '#6b6f73' }}>
          <span>optimal 1,500mg</span><span>limit 2,300mg</span><span>target {targets.sodium.toLocaleString()}mg</span>
        </div>
      </div>

      {/* Full nutrient table */}
      <div className="card fade-up stagger-3" style={{ padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 8 }}>FULL NUTRIENTS</div>
        <NutrientRow label="Calories" value={t.calories} drv={DRV.calories} unit=" kcal" color="#e8784a" />
        <NutrientRow label="Protein" value={parseFloat(t.protein.toFixed(1))} drv={DRV.protein_g} unit="g" color="#6ec87a" />
        <NutrientRow label="Total Fat" value={parseFloat(t.fat.toFixed(1))} drv={DRV.fat_g} unit="g" color="#c97fd4" />
        <NutrientRow label="Sat. Fat" value={parseFloat(t.fat_sat.toFixed(1))} drv={DRV.fat_saturated_g} unit="g" indent />
        <NutrientRow label="Carbs" value={parseFloat(t.carbs.toFixed(1))} drv={DRV.carbs_g} unit="g" color="#f0c96a" />
        <NutrientRow label="Sugar" value={parseFloat(t.sugar.toFixed(1))} drv={DRV.sugar_g} unit="g" indent />
        <NutrientRow label="Added Sugar" value={parseFloat(t.sugar_added.toFixed(1))} drv={DRV.sugar_g * 0.5} unit="g" indent />
        <NutrientRow label="Fibre" value={parseFloat(t.fiber.toFixed(1))} drv={DRV.fiber_g} unit="g" color="#5ecfcf" />
        <NutrientRow label="Sodium" value={t.sodium} drv={DRV.sodium_mg} unit="mg" color="#5ba4e6" />
        <NutrientRow label="Calcium" value={t.calcium} drv={DRV.calcium_mg} unit="mg" />
        <NutrientRow label="Iron" value={parseFloat(t.iron.toFixed(1))} drv={DRV.iron_mg} unit="mg" />
        <NutrientRow label="Potassium" value={t.potassium} drv={DRV.potassium_mg} unit="mg" />
        <NutrientRow label="Vitamin C" value={parseFloat(t.vitamin_c.toFixed(1))} drv={DRV.vitamin_c_mg} unit="mg" />
        <NutrientRow label="Vitamin D" value={parseFloat(t.vitamin_d.toFixed(1))} drv={DRV.vitamin_d_ug} unit="µg" />
      </div>

      {/* Per-meal breakdown */}
      {meals.length > 0 && (
        <div className="card fade-up stagger-4" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', color: '#9ca0a4', letterSpacing: '0.05em', marginBottom: 10 }}>PER MEAL</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ color: '#6b6f73' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px 8px 0', fontWeight: 400 }}>Meal</th>
                  <th className="mono" style={{ textAlign: 'right', padding: '4px 6px 8px', fontWeight: 400, color: '#e8784a' }}>kcal</th>
                  <th className="mono" style={{ textAlign: 'right', padding: '4px 6px 8px', fontWeight: 400, color: '#6ec87a' }}>P</th>
                  <th className="mono" style={{ textAlign: 'right', padding: '4px 6px 8px', fontWeight: 400, color: '#c97fd4' }}>F</th>
                  <th className="mono" style={{ textAlign: 'right', padding: '4px 6px 8px', fontWeight: 400, color: '#f0c96a' }}>C</th>
                  <th className="mono" style={{ textAlign: 'right', padding: '4px 0 8px 6px', fontWeight: 400, color: '#5ba4e6' }}>Na</th>
                </tr>
              </thead>
              <tbody>
                {meals.map(m => (
                  <tr key={m.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '7px 8px 7px 0', color: '#f0eeea', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.emoji} {m.description || m.name}</td>
                    <td className="mono" style={{ textAlign: 'right', padding: '7px 6px', color: '#e8784a' }}>{m.calories || '–'}</td>
                    <td className="mono" style={{ textAlign: 'right', padding: '7px 6px', color: '#6ec87a' }}>{m.protein_g ? `${m.protein_g}g` : '–'}</td>
                    <td className="mono" style={{ textAlign: 'right', padding: '7px 6px', color: '#c97fd4' }}>{m.fat_g ? `${m.fat_g}g` : '–'}</td>
                    <td className="mono" style={{ textAlign: 'right', padding: '7px 6px', color: '#f0c96a' }}>{m.carbs_g ? `${m.carbs_g}g` : '–'}</td>
                    <td className="mono" style={{ textAlign: 'right', padding: '7px 0 7px 6px', color: '#5ba4e6' }}>{m.sodium_mg ? `${m.sodium_mg}` : '–'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <td style={{ padding: '7px 8px 0 0', color: '#9ca0a4', fontSize: '0.72rem' }}>Total</td>
                  <td className="mono" style={{ textAlign: 'right', padding: '7px 6px 0', color: '#e8784a', fontWeight: 500 }}>{t.calories}</td>
                  <td className="mono" style={{ textAlign: 'right', padding: '7px 6px 0', color: '#6ec87a', fontWeight: 500 }}>{t.protein.toFixed(1)}g</td>
                  <td className="mono" style={{ textAlign: 'right', padding: '7px 6px 0', color: '#c97fd4', fontWeight: 500 }}>{t.fat.toFixed(1)}g</td>
                  <td className="mono" style={{ textAlign: 'right', padding: '7px 6px 0', color: '#f0c96a', fontWeight: 500 }}>{t.carbs.toFixed(1)}g</td>
                  <td className="mono" style={{ textAlign: 'right', padding: '7px 0 0 6px', color: '#5ba4e6', fontWeight: 500 }}>{t.sodium}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
