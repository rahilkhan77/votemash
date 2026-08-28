/**
 * GET /api/battles/next
 * Get the next eligible battle for voting
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNextBattle } from '@/lib/voting/battles';
import { getVoterTokenFromCookies, createVoterCookieHeader, generateVoterToken, hashVoterToken } from '@/lib/security/voter';
import { GetNextBattleQuerySchema } from '@/lib/validation/schemas';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const categoryId = url.searchParams.get('categoryId') || undefined;

    // Validate query
    const queryValidation = GetNextBattleQuerySchema.safeParse({ categoryId });
    if (!queryValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_QUERY', message: 'Invalid query parameters' },
        },
        { status: 400 }
      );
    }

    // Get or create voter token
    let voterToken = getVoterTokenFromCookies(request);
    let newToken = false;

    if (!voterToken) {
      voterToken = generateVoterToken();
      newToken = true;
    }

    const voterTokenHash = hashVoterToken(voterToken);

    // Get next eligible battle
    const battle = await getNextBattle(categoryId, voterTokenHash);

    if (!battle) {
      const response = NextResponse.json(
        {
          success: true,
          data: null,
          message: 'No eligible battles available',
        },
        { status: 200 }
      );

      if (newToken) {
        response.headers.set('Set-Cookie', createVoterCookieHeader(voterToken));
      }

      return response;
    }

    // Format response (don't expose database internals)
    const response = NextResponse.json(
      {
        success: true,
        data: {
          id: battle.id,
          leagueId: battle.league_id,
          participantA: {
            id: battle.participants.id,
            name: battle.participants.name,
            slug: battle.participants.slug,
            logo: battle.participants.logo_url,
            description: battle.participants.description,
          },
          participantB: {
            id: battle.participants_b.id,
            name: battle.participants_b.name,
            slug: battle.participants_b.slug,
            logo: battle.participants_b.logo_url,
            description: battle.participants_b.description,
          },
          votesA: battle.votes_a,
          votesB: battle.votes_b,
          totalVotes: battle.total_votes,
          percentageA: battle.total_votes > 0 ? Math.round((battle.votes_a / battle.total_votes) * 100) : 50,
          percentageB: battle.total_votes > 0 ? Math.round((battle.votes_b / battle.total_votes) * 100) : 50,
          leagueEndAt: battle.leagues.end_at,
        },
      },
      { status: 200 }
    );

    if (newToken) {
      response.headers.set('Set-Cookie', createVoterCookieHeader(voterToken));
    }

    return response;
  } catch (error) {
    console.error('Error in GET /api/battles/next:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      },
      { status: 500 }
    );
  }
}
