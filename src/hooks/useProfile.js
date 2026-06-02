import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data, error } = await supabase.from('user_profile').select('*').limit(1).single()
    // PGRST116 = "no rows" — expected for new users, not a real error
    if (error && error.code !== 'PGRST116') {
      console.error('VITALS: profile load error', error)
    }
    setProfile(data)
    setLoading(false)
  }

  async function save(values) {
    if (profile?.id) {
      const { data, error } = await supabase.from('user_profile').update(values).eq('id', profile.id).select().single()
      if (!error) setProfile(data)
      return { error }
    } else {
      const { data, error } = await supabase.from('user_profile').insert(values).select().single()
      if (!error) setProfile(data)
      return { error }
    }
  }

  return { profile, loading, save, reload: load }
}
