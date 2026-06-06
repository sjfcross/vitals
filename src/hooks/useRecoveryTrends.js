import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import dayjs from 'dayjs'

export function useRecoveryTrends(date) {
  const [data, setData] = useState([])

  const load = useCallback(async () => {
    const end = date
    const start = dayjs(date).subtract(29, 'day').format('YYYY-MM-DD')
    const { data: rows } = await supabase
      .from('activity')
      .select('date, resting_hr_bpm, hrv_rmssd')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
    setData((rows || []).filter(r => r.resting_hr_bpm != null || r.hrv_rmssd != null))
  }, [date])

  useEffect(() => { load() }, [load])

  return { data, reload: load }
}
