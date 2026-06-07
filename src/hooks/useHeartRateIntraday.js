import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useHeartRateIntraday() {
  const [hrData, setHrData] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase.rpc('get_hr_intraday_chart', { since_ts: since })
    if (!error && data) {
      setHrData(data.map(r => ({ x: new Date(r.t).getTime(), bpm: r.bpm })))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return { hrData, loading, reload: load }
}
