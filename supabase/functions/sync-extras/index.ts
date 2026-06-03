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
      // window_size_days: 1 is required by the API as of June 2026
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

    // Fetch all 3 in parallel — each failure is caught independently
    const [distResult, amResult, hrResult] = await Promise.all([
      fetchDailyRollup(accessToken, 'distance.delta', startDate, endDate).catch(e => ({ ok: false, status: 0, data: { error: e.message } })),
      fetchDailyRollup(accessToken, 'active_minutes', startDate, endDate).catch(e => ({ ok: false, status: 0, data: { error: e.message } })),
      fetchDailyRollup(accessToken, 'heart_rate.bpm', startDate, endDate).catch(e => ({ ok: false, status: 0, data: { error: e.message } })),
    ])

    // Merge results per date
    const byDate: Record<string, { date: string; km?: number; active_minutes?: number; resting_hr_bpm?: number }> = {}

    function ensureDate(d: string) {
      if (!byDate[d]) byDate[d] = { date: d }
      return byDate[d]
    }

    if (distResult.ok) {
      for (const dp of distResult.data.rollupDataPoints ?? []) {
        const d = dp.civilStartTime?.date
        if (!d) continue
        const date = `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`
        // API returns meters; round to 2 dp
        const meters = dp.distance?.meters ?? dp.distance?.sum ?? dp.distance?.value
        if (meters != null) ensureDate(date).km = Math.round(parseFloat(meters) / 10) / 100
      }
    }

    if (amResult.ok) {
      for (const dp of amResult.data.rollupDataPoints ?? []) {
        const d = dp.civilStartTime?.date
        if (!d) continue
        const date = `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`
        // May come back as durationMs or minutes directly
        const raw = dp.active_minutes?.durationMs ?? dp.active_minutes?.value ?? dp.active_minutes?.minutes
        if (raw != null) {
          const val = parseFloat(raw)
          // If > 1000 it's probably milliseconds; convert to minutes
          ensureDate(date).active_minutes = val > 1000 ? Math.round(val / 60000) : Math.round(val)
        }
      }
    }

    if (hrResult.ok) {
      for (const dp of hrResult.data.rollupDataPoints ?? []) {
        const d = dp.civilStartTime?.date
        if (!d) continue
        const date = `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`
        // Resting HR from daily rollup — field name TBD; try common variants
        const bpm = dp.heart_rate?.bpm ?? dp.heart_rate?.restingHeartRate ?? dp.heart_rate?.average ?? dp.heart_rate?.value
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
