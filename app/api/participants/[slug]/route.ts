import { NextResponse } from 'next/server'
import { getParticipantBySlug } from '@/lib/db/queries'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const participant = await getParticipantBySlug((await params).slug)
  if (!participant) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Participant not found' } }, { status: 404 })
  return NextResponse.json({ success: true, data: participant })
}
