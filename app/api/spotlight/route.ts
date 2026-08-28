import { NextResponse } from 'next/server'
import { getActiveSpotlight } from '@/lib/db/queries'

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await getActiveSpotlight() })
  } catch (error) {
    console.error('Error in spotlight route:', error)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load spotlight' } }, { status: 500 })
  }
}
