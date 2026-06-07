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

  try {
    const accessToken = await getAccessToken()

    // Fetch all SpO2 points (paginated)
    const allPoints: any[] = []
    let pageToken: string | null = null
    do {
      const url = new URL('https://health.googleapis.com/v4/users/me/dataTypes/oxygen-saturation/dataPoints')
      url.searchParams.set('page_size', '200')
      if (pageToken) url.searchParams.set('page_token', pageToken)
      const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
      const data = await resp.json()
      allPoints.push(...(data.dataPoints ?? []))
      pageToken = data.nextPageToken ?? null
    } while (pageToken)

    // Parse all values
    const vals: number[] = []
    for (const dp of allPoints) {
      const val = parseFloat(dp.oxygenSaturation?.percentage ?? '')
      if (!isNaN(val)) vals.push(Math.floor(val))
    }

    // Histogram: count per integer % value
    const histogram: Record<number, number> = {}
    for (const v of vals) {
      histogram[v] = (histogram[v] ?? 0) + 1
    }

    // Print as sorted list with a simple bar
    const rows = Object.entries(histogram)
      .map(([pct, count]) => ({ pct: Number(pct), count }))
      .sort((a, b) => a.pct - b.pct)

    const maxCount = Math.max(...rows.map(r => r.count))
    const barWidth = 40
    const formatted = rows.map(r => {
      const bar = '█'.repeat(Math.round(r.count / maxCount * barWidth))
      return `${String(r.pct).padStart(3)}%  ${String(r.count).padStart(4)}  ${bar}`
    }).join('\n')

    return new Response(JSON.stringify({
      total_points: vals.length,
      histogram_text: formatted,
      histogram_data: rows,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
