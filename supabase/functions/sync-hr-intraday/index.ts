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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authResp = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users?per_page=1`,
      {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        },
      }
    )
    const authData = await authResp.json()
    const users = authData.users ?? authData
    if (!users?.length) throw new Error('No users found: ' + JSON.stringify(authData))
    const userId = users[0].id

    // Find cursor: latest timestamp already in DB
    const { data: maxRow } = await supabase
      .from('heart_rate_intraday')
      .select('timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    const now = Date.now()
    const cutoff48h = new Date(now - 48 * 60 * 60 * 1000)
    const cursor: Date = maxRow?.timestamp
      ? new Date(maxRow.timestamp)
      : new Date(now - 24 * 60 * 60 * 1000)

    const accessToken = await getAccessToken()

    // Paginate heart-rate list newest-first, stop at cursor.
    // Downsample into 5s buckets on-the-fly to avoid a second CPU-heavy iteration.
    const buckets = new Map<string, { sum: number; count: number }>()
    let pageToken: string | null = null
    let done = false
    let pages = 0
    const MAX_PAGES = 600

    while (!done && pages < MAX_PAGES) {
      const url = new URL('https://health.googleapis.com/v4/users/me/dataTypes/heart-rate/dataPoints')
      url.searchParams.set('page_size', '1000')
      if (pageToken) url.searchParams.set('page_token', pageToken)

      const resp = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${accessToken}` } })
      const data = await resp.json()
      if (!resp.ok) throw new Error(`HR API error: ${JSON.stringify(data)}`)
      pages++

      for (const dp of data.dataPoints ?? []) {
        const physicalTime = dp.heartRate?.sampleTime?.physicalTime
        if (!physicalTime) continue
        const ts = new Date(physicalTime)
        if (ts <= cursor || ts < cutoff48h) { done = true; break }
        const bpm = parseInt(dp.heartRate.beatsPerMinute)
        if (bpm <= 0 || bpm >= 300) continue
        // Downsample into 5s bucket immediately
        const ms = ts.getTime()
        const key = new Date(Math.floor(ms / 5000) * 5000).toISOString()
        const b = buckets.get(key)
        if (b) { b.sum += bpm; b.count++ }
        else buckets.set(key, { sum: bpm, count: 1 })
      }

      pageToken = data.nextPageToken ?? null
      if (!pageToken) done = true
    }

    const rows = Array.from(buckets.entries()).map(([timestamp, { sum, count }]) => ({
      user_id: userId,
      timestamp,
      bpm: Math.round(sum / count),
    }))

    // Upsert in 2000-row batches to stay well within PostgREST body limits
    const BATCH = 2000
    let inserted = 0
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase
        .from('heart_rate_intraday')
        .upsert(rows.slice(i, i + BATCH), { onConflict: 'user_id,timestamp', ignoreDuplicates: true })
      if (error) throw new Error('Upsert failed: ' + error.message)
      inserted += Math.min(BATCH, rows.length - i)
    }

    // Prune rows beyond 48h window
    const { count: deleted } = await supabase
      .from('heart_rate_intraday')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .lt('timestamp', cutoff48h.toISOString())

    return new Response(
      JSON.stringify({ inserted, deleted: deleted ?? 0, pages, buckets: buckets.size }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
