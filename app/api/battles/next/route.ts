import { NextRequest, NextResponse } from 'next/server'
import { getNextBattle } from '@/lib/db/queries'
import { getVoterTokenFromCookies, createVoterCookieHeader, generateVoterToken, hashVoterToken } from '@/lib/security/voter'
import { GetNextBattleQuerySchema } from '@/lib/validation/schemas'

export async function GET(request: NextRequest) {
  try {
    const categoryId = new URL(request.url).searchParams.get('categoryId') || undefined
    const validation = GetNextBattleQuerySchema.safeParse({ categoryId })
    if (!validation.success) return NextResponse.json({ success: false, error: { code: 'INVALID_QUERY', message: 'Invalid query parameters' } }, { status: 400 })
    let voterToken = getVoterTokenFromCookies(request)
    const newToken = !voterToken
    if (!voterToken) voterToken = generateVoterToken()
    const battle = await getNextBattle(categoryId, hashVoterToken(voterToken))
    const data = battle ? {
      id: battle.id,
      leagueId: battle.league_id,
      participantA: { ...battle.participant_a, logo: battle.participant_a.logo_url },
      participantB: { ...battle.participant_b, logo: battle.participant_b.logo_url },
      votesA: battle.votes_a,
      votesB: battle.votes_b,
      totalVotes: battle.total_votes,
      percentageA: battle.total_votes ? Math.round((battle.votes_a / battle.total_votes) * 100) : 50,
      percentageB: battle.total_votes ? Math.round((battle.votes_b / battle.total_votes) * 100) : 50,
      league: battle.league,
      category: battle.category,
      endAt: battle.league_end_at,
      leagueEndAt: battle.league_end_at,
    } : null
    const response = NextResponse.json({ success: true, data, message: data ? undefined : 'No eligible battles available' })
    if (newToken) response.headers.set('Set-Cookie', createVoterCookieHeader(voterToken))
    return response
  } catch (error) {
    console.error('Error in next battle route:', error)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }, { status: 500 })
  }
}
