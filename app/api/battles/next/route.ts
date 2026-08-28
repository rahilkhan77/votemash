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
    const battleRecord = battle as any;
    const participantA = Array.isArray(battleRecord.participants) ? battleRecord.participants[0] : battleRecord.participants;
    const participantB = Array.isArray(battleRecord.participants_b) ? battleRecord.participants_b[0] : battleRecord.participants_b;
    const league = Array.isArray(battleRecord.leagues) ? battleRecord.leagues[0] : battleRecord.leagues;
    if (!participantA || !participantB || !league) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATA', message: 'Battle data is incomplete' } },
        { status: 500 }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        data: {
          id: battleRecord.id,
          leagueId: battleRecord.league_id,
          participantA: {
            id: participantA.id,
            name: participantA.name,
            slug: participantA.slug,
            logo: participantA.logo_url,
            description: participantA.description,
          },
          participantB: {
            id: participantB.id,
            name: participantB.name,
            slug: participantB.slug,
            logo: participantB.logo_url,
            description: participantB.description,
          },
          votesA: battleRecord.votes_a,
          votesB: battleRecord.votes_b,
          totalVotes: battleRecord.total_votes,
          percentageA: battleRecord.total_votes > 0 ? Math.round((battleRecord.votes_a / battleRecord.total_votes) * 100) : 50,
          percentageB: battleRecord.total_votes > 0 ? Math.round((battleRecord.votes_b / battleRecord.total_votes) * 100) : 50,
          league,
          category: league.category_id,
          endAt: league.end_at,
          leagueEndAt: league.end_at,
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
