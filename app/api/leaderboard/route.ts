import { NextRequest, NextResponse } from 'next/server'
import { getLeaderboard } from '@/lib/db/queries'
import { LeaderboardQuerySchema } from '@/lib/validation/schemas'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const validation = LeaderboardQuerySchema.safeParse({ categoryId: url.searchParams.get('categoryId') || undefined, limit: Number(url.searchParams.get('limit') || 50), offset: Number(url.searchParams.get('offset') || 0) })
    if (!validation.success) return NextResponse.json({ success: false, error: { code: 'INVALID_QUERY', message: 'Invalid query parameters' } }, { status: 400 })
    const { categoryId, limit, offset } = validation.data
    const data = await getLeaderboard(categoryId, limit, offset)
    const leaderboard = data.rows.map((stat: any, index: number) => ({ rank: offset + index + 1, participant: { id: stat.participant_id, name: stat.name, slug: stat.slug, logo: stat.logo_url, description: stat.description, type: stat.type }, rating: stat.rating, wins: stat.wins, losses: stat.losses, battleCount: stat.battle_count, votesReceived: stat.votes_received, winRate: Number(stat.win_rate), movement: stat.current_rank && stat.previous_rank ? stat.previous_rank - stat.current_rank : 0 }))
    return NextResponse.json({ success: true, data: { leaderboard, total: data.total, leagueEndsAt: data.leagueEndsAt, limit, offset } })
  } catch (error) {
    console.error('Error in leaderboard route:', error)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }, { status: 500 })
  }
}
