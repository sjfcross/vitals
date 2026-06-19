import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import dayjs from 'dayjs'

export function useSleep(date) {
  const [sleep, setSleep] = useState(null)
  const [naps, setNaps] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    // A day can have a main night plus one or more naps. Fetch them all.
    const { data } = await supabase.from('sleep').select('*').eq('date', date)
    const rows = data || []
    const night = rows.find(r => !r.is_nap) ?? null
    const napRows = rows
      .filter(r => r.is_nap)
      .sort((a, b) => new Date(a.sleep_start) - new Date(b.sleep_start))
    setSleep(night)
    setNaps(napRows)
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  return { sleep, naps, loading, reload: load }
}

export function useWeekSleep(date) {
  const [weekData, setWeekData] = useState([])

  const load = useCallback(() => {
    const start = dayjs(date).startOf('week').format('YYYY-MM-DD')
    const end   = dayjs(date).endOf('week').format('YYYY-MM-DD')
    supabase
      .from('sleep')
      .select('date, asleep_min, deep_min, rem_min, light_min, awake_min, is_nap')
      .eq('is_nap', false)
      .gte('date', start)
      .lte('date', end)
      .then(({ data }) => {
        const byDay = {}
        ;(data || []).forEach(s => { byDay[s.date] = s })
        const days = []
        for (let i = 0; i < 7; i++) {
          const d = dayjs(date).startOf('week').add(i, 'day')
          const key = d.format('YYYY-MM-DD')
          days.push({ date: key, label: d.format('ddd'), ...(byDay[key] ?? { asleep_min: 0 }) })
        }
        setWeekData(days)
      })
  }, [date])

  useEffect(() => { load() }, [load])

  return { weekData, reload: load }
}
