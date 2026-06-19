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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

    // Filter window — default last 30 days
    const endDate = body.endDate ?? new Date().toISOString().split('T')[0]
    const startDate = body.startDate ?? (() => {
      const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
    })()

    const accessToken = await getAccessToken()

    const resp = await fetch(
      'https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )
    const data = await resp.json()
    if (!resp.ok) return new Response(
      JSON.stringify({ error: `Google Health API ${resp.status}`, rawResponse: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

    const dataPoints: any[] = data.dataPoints ?? []

    const rows = dataPoints
      .filter((dp: any) => dp.sleep?.interval?.startTime)
      .map((dp: any) => {
        const interval = dp.sleep.interval
        const summary  = dp.sleep.summary ?? {}
        const stages   = (dp.sleep.stages ?? []).map((s: any) => ({
          startTime: s.startTime,
          endTime:   s.endTime,
          type:      s.type,            // AWAKE | LIGHT | DEEP | REM
        }))

        // Use wake-up date (local) as the record date
        const endLocal  = new Date(interval.endTime)
        const offsetSec = parseInt(interval.endUtcOffset ?? '0')
        const wakeLocal = new Date(endLocal.getTime() + offsetSec * 1000)
        const date = wakeLocal.toISOString().split('T')[0]

        const stagesSummary: Record<string, number> = {}
        ;(summary.stagesSummary ?? []).forEach((s: any) => {
          stagesSummary[s.type] = parseInt(s.minutes ?? '0')
        })

        return {
          date,
          sleep_start:  interval.startTime,
          sleep_end:    interval.endTime,
          duration_min: parseInt(summary.minutesInSleepPeriod ?? '0') || null,
          asleep_min:   parseInt(summary.minutesAsleep ?? '0') || null,
          deep_min:     stagesSummary['DEEP']  ?? null,
          rem_min:      stagesSummary['REM']   ?? null,
          light_min:    stagesSummary['LIGHT'] ?? null,
          awake_min:    stagesSummary['AWAKE'] ?? null,
          stages,
        }
      })

    // Keep every session. Per wake-date, the longest-asleep session is the "night";
    // any additional same-day sessions are naps (is_nap = true). Rows are upserted on
    // (date, sleep_start) so naps and nights coexist instead of overwriting each other.
    const byDate = new Map<string, typeof rows>()
    for (const row of rows) {
      const arr = byDate.get(row.date) ?? []
      arr.push(row)
      byDate.set(row.date, arr)
    }
    const flagged: Array<typeof rows[0] & { is_nap: boolean }> = []
    for (const sessions of byDate.values()) {
      let nightIdx = 0
      sessions.forEach((s, i) => {
        if ((s.asleep_min ?? 0) > (sessions[nightIdx].asleep_min ?? 0)) nightIdx = i
      })
      sessions.forEach((s, i) => flagged.push({ ...s, is_nap: i !== nightIdx }))
    }

    // Filter to requested date window
    const startMs = new Date(startDate + 'T00:00:00Z').getTime()
    const endMs   = new Date(endDate   + 'T23:59:59Z').getTime()
    const filtered = flagged.filter(r => {
      const t = new Date(r.sleep_end).getTime()
      return t >= startMs && t <= endMs
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let upsertError = null
    if (filtered.length > 0) {
      const { error } = await supabase
        .from('sleep')
        .upsert(filtered, { onConflict: 'date,sleep_start' })
      upsertError = error
    }

    return new Response(
      JSON.stringify({ synced: filtered.length, upsertError }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
