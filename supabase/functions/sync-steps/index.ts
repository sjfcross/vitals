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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Optional body: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
    // Defaults to last 30 days if not provided
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

    const endDate = body.endDate ?? new Date().toISOString().split('T')[0]
    const startDate = body.startDate ?? (() => {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      return d.toISOString().split('T')[0]
    })()

    const accessToken = await getAccessToken()

    const ghResp = await fetch(
      'https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: {
            start: civilDateTime(startDate, 0, 0, 0),
            end: civilDateTime(endDate, 23, 59, 59),
          }
        }),
      }
    )

    const ghData = await ghResp.json()

    if (!ghResp.ok) {
      throw new Error(`Google Health API ${ghResp.status}: ${JSON.stringify(ghData)}`)
    }

    const dataPoints: unknown[] = ghData.rollupDataPoints ?? []

    const rows = dataPoints
      .map((dp: any) => {
        const d = dp.civilStartTime?.date
        const date = d ? `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}` : null
        const steps = dp.steps?.countSum != null ? parseInt(dp.steps.countSum) : null
        return { date, steps }
      })
      .filter((r) => r.date != null && r.steps != null)

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
        rawResponse: ghData, // full response for debugging
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
