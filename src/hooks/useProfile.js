import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from('user_profile').select('*').limit(1).single()
    setProfile(data)
    setLoading(false)
  }

  async function save(values) {
    if (profile?.id) {
      const { data } = await supabase.from('user_profile').update(values).eq('id', profile.id).select().single()
      setProfile(data)
    } else {
      const { data } = await supabase.from('user_profile').insert(values).select().single()
      setProfile(data)
    }
  }

  return { profile, loading, save, reload: load }
}
