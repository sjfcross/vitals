import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
  return { date: { year, month, day }, time: { hours, minutes, seconds } }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const accessToken = await getAccessToken()
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

    // 1. Daily rollup for last 7 days — see exactly what fields come back
    const rollupResp = await fetch(
      'https://health.googleapis.com/v4/users/me/dataTypes/heart-rate/dataPoints:dailyRollUp',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          range: {
            start: civilDateTime(weekAgo, 0, 0, 0),
            end: civilDateTime(today, 23, 59, 59),
          },
          window_size_days: 1,
        }),
      }
    )
    const rollupData = await rollupResp.json()

    // 2. Raw intraday points — first page only (200 points), to see granularity + field shape
    const rawResp = await fetch(
      'https://health.googleapis.com/v4/users/me/dataTypes/heart-rate/dataPoints?page_size=200',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )
    const rawData = await rawResp.json()

    // Summarise raw points: total count on this page, time span, sample interval stats
    const points: any[] = rawData.dataPoints ?? []
    let summary: any = { page_count: points.length, next_page_token: rawData.nextPageToken ?? null }

    if (points.length > 0) {
      // Show first 3 and last 3 raw points in full so we can see exact field shape
      summary.first_3 = points.slice(0, 3)
      summary.last_3 = points.slice(-3)

      // Compute intervals between consecutive timestamps to confirm ~3s granularity
      const timestamps: number[] = points.map((p: any) => {
        const t = p.civilStartTime?.time
        const d = p.civilStartTime?.date
        if (!t || !d) return null
        return Date.UTC(d.year, d.month - 1, d.day, t.hours ?? 0, t.minutes ?? 0, t.seconds ?? 0)
      }).filter((t): t is number => t !== null)

      if (timestamps.length > 1) {
        const intervals = timestamps.slice(1).map((t, i) => Math.abs(t - timestamps[i]) / 1000)
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const minInterval = Math.min(...intervals)
        const maxInterval = Math.max(...intervals)
        summary.interval_stats_seconds = {
          avg: Math.round(avgInterval),
          min: minInterval,
          max: maxInterval,
          sample_count: intervals.length,
        }
        // Date range of this page
        const oldest = new Date(Math.min(...timestamps)).toISOString()
        const newest = new Date(Math.max(...timestamps)).toISOString()
        summary.date_range_on_page = { oldest, newest }
      }
    }

    return new Response(JSON.stringify({
      rollup_raw: rollupData,
      intraday_summary: summary,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
