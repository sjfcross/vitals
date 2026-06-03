import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAccessToken(): Promise<string> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('GOOGLE_REFRESH_TOKEN')!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await resp.json()
  if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data))
  return data.access_token
}

function civilDateTime(date: string, hours: number, minutes: number, seconds: number) {
  const [year, month, day] = date.split('-').map(Number)
  return {
    date: { year, month, day },
    time: { hours, minutes, seconds },
  }
}

async function fetchDailyRollup(accessToken: string, dataType: string, startDate: string, endDate: string) {
  const resp = await fetch(
    `https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      // window_size_days: 1 required by the API as of June 2026
      body: JSON.stringify({
        range: {
          start: civilDateTime(startDate, 0, 0, 0),
          end: civilDateTime(endDate, 23, 59, 59),
        },
        window_size_days: 1,
      }),
    }
  )
  const data = await resp.json()
  return { ok: resp.ok, status: resp.status, data }
}

function parseDateFromDp(dp: any): string | null {
  const d = dp.civilStartTime?.date
  if (!d) return null
  return `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

    const endDate = body.endDate ?? new Date().toISOString().split('T')[0]
    const startDate = body.startDate ?? (() => {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      return d.toISOString().split('T')[0]
    })()

    const accessToken = await getAccessToken()

    // active-minutes is capped at 14 days by the API
    const amStartDate = (() => {
      const d = new Date(endDate)
      d.setDate(d.getDate() - 13)
      const s = new Date(startDate)
      return (d > s ? d : s).toISOString().split('T')[0]
    })()

    // Type names are kebab-case in the URL path (per Google Health API docs)
    const [distResult, amResult, hrResult] = await Promise.all([
      fetchDailyRollup(accessToken, 'distance', startDate, endDate).catch(e => ({ ok: false, status: 0, data: { error: e.message } })),
      fetchDailyRollup(accessToken, 'active-minutes', amStartDate, endDate).catch(e => ({ ok: false, status: 0, data: { error: e.message } })),
      fetchDailyRollup(accessToken, 'heart-rate', startDate, endDate).catch(e => ({ ok: false, status: 0, data: { error: e.message } })),
    ])

    const byDate: Record<string, { date: string; km?: number; active_minutes?: number; resting_hr_bpm?: number }> = {}

    function ensureDate(d: string) {
      if (!byDate[d]) byDate[d] = { date: d }
      return byDate[d]
    }

    if (distResult.ok) {
      for (const dp of distResult.data.rollupDataPoints ?? []) {
        const date = parseDateFromDp(dp)
        if (!date) continue
        // API returns millimeters in distance.millimetersSum
        const mm = dp.distance?.millimetersSum ?? dp.distance?.meters ?? dp.distance?.value
        if (mm != null) ensureDate(date).km = Math.round(parseFloat(mm) / 10000) / 100
      }
    }

    if (amResult.ok) {
      for (const dp of amResult.data.rollupDataPoints ?? []) {
        const date = parseDateFromDp(dp)
        if (!date) continue
        // Sum across all activity levels (LIGHT, MODERATE, VIGOROUS)
        const levels: any[] = dp.activeMinutes?.activeMinutesRollupByActivityLevel ?? []
        if (levels.length > 0) {
          const total = levels.reduce((sum: number, l: any) => sum + (parseInt(l.activeMinutesSum) || 0), 0)
          if (total > 0) ensureDate(date).active_minutes = total
        }
      }
    }

    if (hrResult.ok) {
      for (const dp of hrResult.data.rollupDataPoints ?? []) {
        const date = parseDateFromDp(dp)
        if (!date) continue
        // heart-rate daily rollup — keep raw for first-run debugging
        const hr = dp.heartRate ?? dp.heart_rate
        const bpm = hr?.beatsPerMinuteAvg ?? hr?.beatsPerMinuteMin ?? hr?.bpm ?? hr?.average ?? hr?.value
        if (bpm != null) ensureDate(date).resting_hr_bpm = Math.round(parseFloat(bpm))
      }
    }

    const rows = Object.values(byDate)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let upsertError = null
    if (rows.length > 0) {
      const { error } = await supabase
        .from('activity')
        .upsert(rows, { onConflict: 'date' })
      upsertError = error
    }

    return new Response(
      JSON.stringify({
        synced: rows.length,
        rows,
        rawDistance: distResult.data,
        rawActiveMinutes: amResult.data,
        rawHeartRate: hrResult.data,
        upsertError,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
