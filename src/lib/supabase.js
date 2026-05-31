import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('VITALS: Supabase env vars missing. VITE_SUPABASE_URL:', url, 'VITE_SUPABASE_ANON_KEY:', key ? '[set]' : '[missing]')
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder')
