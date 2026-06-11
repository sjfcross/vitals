import { useState, useEffect, Component } from 'react'
import dayjs from 'dayjs'
import { supabase } from './lib/supabase'
import { Login } from './components/Login'
import { Layout } from './components/Layout'
import { OnboardingSheet } from './components/OnboardingSheet'
import { Overview } from './tabs/Overview'
import { Nutrition } from './tabs/Nutrition'
import { Activity } from './tabs/Activity'
import { Weight } from './tabs/Weight'
import { BloodPressure } from './tabs/BloodPressure'
import { Sleep } from './tabs/Sleep'
import { useProfile } from './hooks/useProfile'
import { useMeals } from './hooks/useMeals'
import { useActivity } from './hooks/useActivity'
import { useWeight } from './hooks/useWeight'
import { useBloodPressure } from './hooks/useBloodPressure'
import { useSleep } from './hooks/useSleep'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) { console.error('VITALS: unhandled error', error) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0e0f11', gap: 16, padding: 24 }}>
          <div className="mono" style={{ color: '#e8784a', fontSize: '0.8rem', letterSpacing: '0.1em' }}>SOMETHING WENT WRONG</div>
          <div style={{ color: '#6b6f73', fontSize: '0.78rem', textAlign: 'center' }}>{this.state.error.message}</div>
          <button onClick={() => this.setState({ error: null })} style={{ color: '#9ca0a4', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function AppInner() {
  const [today, setToday] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [tab, setTab] = useState('overview')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [date, setDate] = useState(() => dayjs().format('YYYY-MM-DD'))

  // Recompute "today" when the user returns to the app (handles staying open past midnight)
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) setToday(dayjs().format('YYYY-MM-DD'))
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const { profile, loading: profileLoading, save: saveProfile } = useProfile()
  const { meals, addMeal, deleteMeal } = useMeals(date)
  const { activity, save: saveActivity, reload: reloadActivity } = useActivity(date)
  const { sleep, reload: reloadSleep } = useSleep(date)

  async function syncSteps() {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-steps`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Sync failed')
    return data
  }

  async function syncExtras() {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-extras`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Sync extras failed')
    return data
  }

  async function syncAll() {
    const [stepsData, extrasData] = await Promise.all([syncSteps(), syncExtras()])
    await reloadActivity()
    return { synced: stepsData.synced + extrasData.synced }
  }

  async function syncHrIntraday() {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-hr-intraday`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'HR sync failed')
    return data
  }

  async function syncSleep() {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-sleep`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Sync failed')
    await reloadSleep()
    return data
  }
  const { entries, latest, delta7, delta30, addEntry, deleteEntry } = useWeight()
  const { entries: bpEntries, latest: bpLatest, addEntry: addBpEntry } = useBloodPressure()

  useEffect(() => {
    if (!profileLoading && !profile) setShowOnboarding(true)
  }, [profileLoading, profile])

  if (profileLoading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0f11' }}>
        <div className="mono" style={{ color: '#6b6f73', fontSize: '0.8rem', letterSpacing: '0.1em' }}>LOADING…</div>
      </div>
    )
  }

  return (
    <>
      <Layout tab={tab} setTab={setTab} date={date}>
        {tab === 'overview' && (
          <Overview
            meals={meals} activity={activity} profile={profile}
            date={date} today={today} onAddMeal={addMeal} onDeleteMeal={deleteMeal} onDateChange={setDate}
          />
        )}
        {tab === 'nutrition' && <Nutrition meals={meals} profile={profile} onDeleteMeal={deleteMeal} />}
        {tab === 'activity' && <Activity activity={activity} profile={profile} date={date} today={today} onSave={saveActivity} onDateChange={setDate} onSync={syncAll} onSyncHr={syncHrIntraday} />}
        {tab === 'sleep' && <Sleep sleep={sleep} date={date} today={today} onDateChange={setDate} onSync={syncSleep} />}
        {tab === 'weight' && (
          <Weight
            entries={entries} latest={latest} delta7={delta7} delta30={delta30}
            profile={profile} onAdd={addEntry} onDelete={deleteEntry}
          />
        )}
        {tab === 'bp' && (
          <BloodPressure entries={bpEntries} latest={bpLatest} onAdd={addBpEntry} />
        )}
      </Layout>

      {showOnboarding && (
        <OnboardingSheet
          onSave={async (values) => {
            if (Object.keys(values).length > 0) await saveProfile(values)
            setShowOnboarding(false)
          }}
        />
      )}
    </>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) console.error('VITALS: getSession error', error)
        setSession(session ?? null)
      })
      .catch(err => {
        console.error('VITALS: getSession threw', err)
        setSession(null)
      })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0f11' }}>
        <div className="mono" style={{ color: '#6b6f73', fontSize: '0.8rem', letterSpacing: '0.1em' }}>VITALS</div>
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}
