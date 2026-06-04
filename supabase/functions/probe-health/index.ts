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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const accessToken = await getAccessToken()

  // Fetch HRV with page_size and try time-based params
  const [r1, r2, r3] = await Promise.all([
    // Default list
    fetch('https://health.googleapis.com/v4/users/me/dataTypes/heart-rate-variability/dataPoints?page_size=200', {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then(r => r.json()),
    // Try with start_time filter
    fetch('https://health.googleapis.com/v4/users/me/dataTypes/heart-rate-variability/dataPoints?page_size=200&start_time=2026-05-01T00:00:00Z', {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then(r => r.json()),
    // SpO2 with page_size
    fetch('https://health.googleapis.com/v4/users/me/dataTypes/oxygen-saturation/dataPoints?page_size=200', {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then(r => r.json()),
  ])

  return new Response(JSON.stringify({
    hrv_default_count: r1.dataPoints?.length ?? 0,
    hrv_default_keys: Object.keys(r1),
    hrv_nextPageToken: r1.nextPageToken ?? null,
    hrv_with_start_count: r2.dataPoints?.length ?? 0,
    hrv_with_start_error: r2.error ?? null,
    hrv_dates: (r1.dataPoints ?? []).map((dp: any) => {
      const t = Object.keys(dp).find(k => k !== 'dataSource')
      return dp[t as string]?.sampleTime?.civilTime?.date
    }).filter(Boolean).slice(0, 10),
    spo2_count: r3.dataPoints?.length ?? 0,
    spo2_nextPageToken: r3.nextPageToken ?? null,
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
