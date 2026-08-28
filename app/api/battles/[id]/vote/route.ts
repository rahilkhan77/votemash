import { NextRequest, NextResponse } from 'next/server'
import { submitVote } from '@/lib/db/queries'
import { getVoterTokenFromCookies, hashVoterToken, hashIpAddress, hashUserAgent, getClientIp, getUserAgent } from '@/lib/security/voter'
import { VoteInputSchema } from '@/lib/validation/schemas'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const voterToken = getVoterTokenFromCookies(request)
    if (!voterToken) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Voter token not found' } }, { status: 401 })
    const validation = VoteInputSchema.safeParse(await request.json())
    if (!validation.success) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid request body' } }, { status: 400 })
    const { id: battleId } = await params
    const result = await submitVote(battleId, validation.data.participantId, hashVoterToken(voterToken), hashIpAddress(getClientIp(request)), hashUserAgent(getUserAgent(request)))
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') return NextResponse.json({ success: false, error: { code: result.error, message: 'Battle not found' } }, { status: 404 })
      if (result.error === 'INVALID_STATE') return NextResponse.json({ success: false, error: { code: result.error, message: 'Battle is not active' } }, { status: 409 })
      if (result.error === 'INVALID_PARTICIPANT') return NextResponse.json({ success: false, error: { code: result.error, message: 'Participant not in this battle' } }, { status: 400 })
      return NextResponse.json({ success: false, error: { code: result.error, message: 'You have already voted in this battle' } }, { status: 409 })
    }
    const battle = result.battle
    const winner = battle.votes_a >= battle.votes_b ? battle.participant_a_id : battle.participant_b_id
    return NextResponse.json({ success: true, data: { winner, votesA: battle.votes_a, votesB: battle.votes_b, percentageA: Math.round((battle.votes_a / battle.total_votes) * 100), percentageB: Math.round((battle.votes_b / battle.total_votes) * 100), totalVotes: battle.total_votes } })
  } catch (error) {
    console.error('Error in vote route:', error)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }, { status: 500 })
  }
}
