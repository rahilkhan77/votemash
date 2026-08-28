import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  console.info('[spotlight] route entered')
  try {
    const supabase = await getSupabaseServerClient()
    const now = new Date().toISOString()
    console.info('[spotlight] query started')
    const { data, error } = await supabase.from('champion_spotlights').select('id, participant_id, league_id, starts_at, ends_at, status, participants(id, name, slug, logo_url, description)').eq('status', 'active').lte('starts_at', now).gt('ends_at', now).order('ends_at', { ascending: false }).limit(1).maybeSingle()
    if (error) {
      console.error('[spotlight] query failed', { code: error.code, message: error.message })
      return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load spotlight' } }, { status: 500 })
    }
    console.info('[spotlight] query completed', { found: Boolean(data) })
    return NextResponse.json({ success: true, data: data || null })
  } catch (error) {
    console.error('[spotlight] route failed', { code: error instanceof Error ? error.name : 'UNKNOWN', message: error instanceof Error ? error.message : 'Unknown error' })
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load spotlight' } }, { status: 500 })
  }
}
