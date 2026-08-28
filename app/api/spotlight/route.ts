import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await getSupabaseServerClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('champion_spotlights').select('id, participant_id, league_id, starts_at, ends_at, status, participants(id, name, slug, logo_url, description)').eq('status', 'active').lte('starts_at', now).gt('ends_at', now).order('ends_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load spotlight' } }, { status: 500 })
  return NextResponse.json({ success: true, data: data || null })
}
