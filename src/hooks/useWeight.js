import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import dayjs from 'dayjs'

export function useWeight() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const since = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
    const { data } = await supabase
      .from('weight')
      .select('*')
      .gte('date', since)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
    setEntries(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addEntry(values) {
    const { data, error } = await supabase.from('weight').insert(values).select().single()
    if (!error) setEntries(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)))
    return { data, error }
  }

  const latest = entries[entries.length - 1] || null

  const delta7 = (() => {
    if (entries.length < 2) return null
    const cutoff = dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const old = entries.find(e => e.date >= cutoff)
    if (!old || !latest) return null
    return (latest.weight_kg - old.weight_kg).toFixed(1)
  })()

  const delta30 = (() => {
    if (entries.length < 2) return null
    return (latest.weight_kg - entries[0].weight_kg).toFixed(1)
  })()

  return { entries, loading, addEntry, latest, delta7, delta30, reload: load }
}
