import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.from('participants').select('id, name, slug, type, description, website_url, logo_url, status, created_at, categories(name, slug)').eq('slug', slug).eq('status', 'active').single()
  if (error || !data) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Participant not found' } }, { status: 404 })
  return NextResponse.json({ success: true, data })
}
