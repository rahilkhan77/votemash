import { NextResponse } from 'next/server'
import { checkAndFinalizeExpiredLeagues } from '@/lib/leagues/lifecycle'

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!expected || authorization !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await checkAndFinalizeExpiredLeagues()
  return NextResponse.json({ success: true, data: result })
}
