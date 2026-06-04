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

async function probeList(accessToken: string, dataType: string) {
  const resp = await fetch(
    `https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  )
  const data = await resp.json()
  return { status: resp.status, ok: resp.ok, pointCount: data.dataPoints?.length ?? 0, sample: data.dataPoints?.[0] ?? null, error: data.error ?? null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const accessToken = await getAccessToken()

  // These use list endpoint (not dailyRollUp)
  const listTypes = ['heart-rate-variability', 'oxygen-saturation', 'vo2-max']
  // Try alternate names for body fat and respiratory rate
  const listTypeAlts = ['body-fat', 'respiratory-rate', 'breathing-rate', 'respiration-rate']

  const results: Record<string, any> = {}

  await Promise.all([...listTypes, ...listTypeAlts].map(async (t) => {
    results[t] = await probeList(accessToken, t).catch(e => ({ error: e.message }))
  }))

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
