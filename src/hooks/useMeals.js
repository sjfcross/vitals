import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import dayjs from 'dayjs'

export function useMeals(date) {
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('meals')
      .select('*')
      .eq('date', date)
      .order('time', { ascending: true })
    setMeals(data || [])
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  async function addMeal(meal) {
    const { data, error } = await supabase.from('meals').insert(meal).select().single()
    if (!error) setMeals(prev => [...prev, data].sort((a, b) => a.time.localeCompare(b.time)))
    return { data, error }
  }

  async function deleteMeal(id) {
    const snapshot = meals
    setMeals(prev => prev.filter(m => m.id !== id))
    const { error } = await supabase.from('meals').delete().eq('id', id)
    if (error) {
      setMeals(snapshot)
      console.error('VITALS: deleteMeal failed', error)
    }
  }

  return { meals, loading, addMeal, deleteMeal, reload: load }
}

export function useWeekMeals(date) {
  const [weekData, setWeekData] = useState([])

  const load = useCallback(() => {
    const start = dayjs(date).startOf('week').format('YYYY-MM-DD')
    const end = dayjs(date).endOf('week').format('YYYY-MM-DD')
    supabase
      .from('meals')
      .select('date, calories')
      .gte('date', start)
      .lte('date', end)
      .then(({ data }) => {
        const byDay = {}
        ;(data || []).forEach(m => {
          byDay[m.date] = (byDay[m.date] || 0) + (m.calories || 0)
        })
        const days = []
        for (let i = 0; i < 7; i++) {
          const d = dayjs(date).startOf('week').add(i, 'day')
          days.push({ date: d.format('YYYY-MM-DD'), label: d.format('ddd'), kcal: byDay[d.format('YYYY-MM-DD')] || 0 })
        }
        setWeekData(days)
      })
  }, [date])

  useEffect(() => { load() }, [load])

  return { weekData, reload: load }
}
