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

async function safeJson(resp: Response) {
  const text = await resp.text()
  try { return JSON.parse(text) } catch { return { _raw: text.slice(0, 500) } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const endDate = body.endDate ?? new Date().toISOString().split('T')[0]
    const startDate = body.startDate ?? (() => {
      const d = new Date()
      d.setDate(d.getDate() - 14)
      return d.toISOString().split('T')[0]
    })()

    const accessToken = await getAccessToken()
    const h = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    const range = { start: civilDateTime(startDate, 0, 0, 0), end: civilDateTime(endDate, 23, 59, 59) }

    const probes: Record<string, unknown> = {}

    // GET with no params — does it list everything?
    const r1 = await fetch('https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints', { headers: h })
    probes['GET_no_params'] = { status: r1.status, data: await safeJson(r1) }

    // POST to base dataPoints (no :action suffix) with range body
    const r2 = await fetch('https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints', {
      method: 'POST', headers: h, body: JSON.stringify({ range })
    })
    probes['POST_range_body'] = { status: r2.status, data: await safeJson(r2) }

    // GET with civil time as flat query params
    const r3 = await fetch(
      `https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints` +
      `?range.start.date.year=${startDate.split('-')[0]}&range.start.date.month=${startDate.split('-')[1]}&range.start.date.day=${startDate.split('-')[2]}` +
      `&range.end.date.year=${endDate.split('-')[0]}&range.end.date.month=${endDate.split('-')[1]}&range.end.date.day=${endDate.split('-')[2]}`,
      { headers: h }
    )
    probes['GET_civil_params'] = { status: r3.status, data: await safeJson(r3) }

    // Maybe it's a different resource name: "sleepSession"
    const r4 = await fetch('https://health.googleapis.com/v4/users/me/dataTypes/sleepSession/dataPoints', {
      method: 'POST', headers: h, body: JSON.stringify({ range })
    })
    probes['POST_sleepSession'] = { status: r4.status, data: await safeJson(r4) }

    return new Response(
      JSON.stringify({ dateRange: { startDate, endDate }, probes }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
