import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { supabase } from './lib/supabase'
import { Login } from './components/Login'
import { Layout } from './components/Layout'
import { OnboardingSheet } from './components/OnboardingSheet'
import { Overview } from './tabs/Overview'
import { Nutrition } from './tabs/Nutrition'
import { Activity } from './tabs/Activity'
import { Weight } from './tabs/Weight'
import { useProfile } from './hooks/useProfile'
import { useMeals } from './hooks/useMeals'
import { useActivity } from './hooks/useActivity'
import { useWeight } from './hooks/useWeight'

const TODAY = dayjs().format('YYYY-MM-DD')

function AppInner() {
  const [tab, setTab] = useState('overview')
  const [showOnboarding, setShowOnboarding] = useState(false)

  const { profile, loading: profileLoading, save: saveProfile } = useProfile()
  const { meals, addMeal } = useMeals(TODAY)
  const { activity, save: saveActivity } = useActivity(TODAY)
  const { entries, latest, delta7, delta30, addEntry } = useWeight()

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
      <Layout tab={tab} setTab={setTab} date={TODAY}>
        {tab === 'overview' && (
          <Overview
            meals={meals} activity={activity} profile={profile}
            date={TODAY} onAddMeal={addMeal}
          />
        )}
        {tab === 'nutrition' && <Nutrition meals={meals} profile={profile} />}
        {tab === 'activity' && <Activity activity={activity} profile={profile} date={TODAY} onSave={saveActivity} />}
        {tab === 'weight' && (
          <Weight
            entries={entries} latest={latest} delta7={delta7} delta30={delta30}
            profile={profile} onAdd={addEntry}
          />
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
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
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

  return <AppInner />
}
