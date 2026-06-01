import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useBloodPressure() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('blood_pressure')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true })
    setEntries(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addEntry(values) {
    const { data, error } = await supabase.from('blood_pressure').insert(values).select().single()
    if (!error) {
      setEntries(prev => [...prev, data].sort((a, b) =>
        a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
      ))
    }
    return { data, error }
  }

  const latest = entries[entries.length - 1] || null

  return { entries, loading, addEntry, latest, reload: load }
}
