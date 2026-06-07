import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useHeartRateIntraday() {
  const [hrData, setHrData] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('heart_rate_intraday')
      .select('timestamp, bpm')
      .gte('timestamp', cutoff)
      .order('timestamp', { ascending: true })
    if (!error && data) {
      setHrData(data.map(r => ({ x: new Date(r.timestamp).getTime(), bpm: r.bpm })))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return { hrData, loading, reload: load }
}
