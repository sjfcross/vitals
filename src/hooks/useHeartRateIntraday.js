import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useHeartRateIntraday() {
  const [hourlyData, setHourlyData] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase.rpc('get_hr_hourly_chart', { since_ts: since })
    if (!error && data) {
      setHourlyData(data.map(r => ({ x: new Date(r.h).getTime(), avg: r.avg_bpm, max: r.max_bpm })))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return { hourlyData, loading, reload: load }
}

export async function fetchHrZoom(centerMs) {
  const start = new Date(centerMs - 60 * 60 * 1000).toISOString()
  const end = new Date(centerMs + 2 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('heart_rate_intraday')
    .select('timestamp, bpm')
    .gte('timestamp', start)
    .lte('timestamp', end)
    .order('timestamp', { ascending: true })
  return data?.map(r => ({ x: new Date(r.timestamp).getTime(), bpm: r.bpm })) ?? []
}
