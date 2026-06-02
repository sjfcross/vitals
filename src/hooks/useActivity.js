import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import dayjs from 'dayjs'

export function useActivity(date) {
  const [activity, setActivity] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('activity').select('*').eq('date', date).single()
    setActivity(data || null)
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  async function save(values) {
    if (activity?.id) {
      const { data, error } = await supabase.from('activity').update(values).eq('id', activity.id).select().single()
      if (!error) setActivity(data)
      return { error }
    } else {
      const { data, error } = await supabase.from('activity').insert({ date, ...values }).select().single()
      if (!error) setActivity(data)
      return { error }
    }
  }

  return { activity, loading, save, reload: load }
}

export function useWeekActivity(date) {
  const [weekData, setWeekData] = useState([])

  const load = useCallback(() => {
    const start = dayjs(date).startOf('week').format('YYYY-MM-DD')
    const end = dayjs(date).endOf('week').format('YYYY-MM-DD')
    supabase
      .from('activity')
      .select('date, steps')
      .gte('date', start)
      .lte('date', end)
      .then(({ data }) => {
        const byDay = {}
        ;(data || []).forEach(a => { byDay[a.date] = a.steps || 0 })
        const days = []
        for (let i = 0; i < 7; i++) {
          const d = dayjs(date).startOf('week').add(i, 'day')
          days.push({ date: d.format('YYYY-MM-DD'), label: d.format('ddd'), steps: byDay[d.format('YYYY-MM-DD')] || 0 })
        }
        setWeekData(days)
      })
  }, [date])

  useEffect(() => { load() }, [load])

  return { weekData, reload: load }
}
