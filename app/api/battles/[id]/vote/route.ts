/**
 * POST /api/battles/[id]/vote
 * Submit a vote for a battle
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getVoterTokenFromCookies, hashVoterToken, hashIpAddress, hashUserAgent, getClientIp, getUserAgent } from '@/lib/security/voter';
import { VoteInputSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: battleId } = await params;

    // Get voter token from cookies
    const voterToken = getVoterTokenFromCookies(request);
    if (!voterToken) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Voter token not found' },
        },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = VoteInputSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Invalid request body' },
        },
        { status: 400 }
      );
    }

    const { participantId } = validation.data;
    const voterTokenHash = hashVoterToken(voterToken);
    const ipHash = hashIpAddress(getClientIp(request));
    const userAgentHash = hashUserAgent(getUserAgent(request));

    const supabase = getSupabaseAdmin() as any;

    // Start a transaction-like operation
    // 1. Validate battle exists and is active
    const { data: battle, error: battleError } = await supabase
      .from('battles')
      .select('id, league_id, status, participant_a_id, participant_b_id, votes_a, votes_b, total_votes')
      .eq('id', battleId)
      .single();

    if (battleError || !battle) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Battle not found' },
        },
        { status: 404 }
      );
    }

    if (battle.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_STATE', message: 'Battle is not active' },
        },
        { status: 409 }
      );
    }

    // 2. Validate participant is in this battle
    if (participantId !== battle.participant_a_id && participantId !== battle.participant_b_id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_PARTICIPANT', message: 'Participant not in this battle' },
        },
        { status: 400 }
      );
    }

    // 3. Insert the vote and update counters atomically in the database.
    const { data: voteResult, error: voteError } = await supabase.rpc('submit_vote', {
      p_battle_id: battleId,
      p_participant_id: participantId,
      p_voter_token_hash: voterTokenHash,
      p_ip_hash: ipHash,
      p_user_agent_hash: userAgentHash,
    });

    if (voteError) {
      if (voteError.code === '23505') {
        // Unique constraint violation
        return NextResponse.json(
          {
            success: false,
            error: { code: 'DUPLICATE_VOTE', message: 'You have already voted in this battle' },
          },
          { status: 409 }
        );
      }

      if (voteError.message.includes('battle_not_active')) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATE', message: 'Battle is not active' } },
          { status: 409 }
        );
      }

      if (voteError.message.includes('invalid_participant')) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PARTICIPANT', message: 'Participant not in this battle' } },
          { status: 400 }
        );
      }

      console.error('Error inserting vote:', voteError);
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to record vote' },
        },
        { status: 500 }
      );
    }

    const updatedBattle = voteResult?.[0];
    if (!updatedBattle) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Vote result unavailable' } },
        { status: 500 }
      );
    }

    // 4. Return database-authoritative live result
    const isVotingA = participantId === battle.participant_a_id;
    const newVotesA = updatedBattle.votes_a;
    const newVotesB = updatedBattle.votes_b;
    const newTotal = updatedBattle.total_votes;

    // 6. Return live result
    return NextResponse.json(
      {
        success: true,
        data: {
          winner: isVotingA ? battle.participant_a_id : battle.participant_b_id,
          votesA: newVotesA,
          votesB: newVotesB,
          percentageA: Math.round((newVotesA / newTotal) * 100),
          percentageB: Math.round((newVotesB / newTotal) * 100),
          totalVotes: newTotal,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in POST /api/battles/[id]/vote:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      },
      { status: 500 }
    );
  }
}
