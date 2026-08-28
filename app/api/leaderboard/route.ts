/**
 * Leaderboard API endpoint
 * GET /api/leaderboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { LeaderboardQuerySchema } from '@/lib/validation/schemas';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);

    // Parse and validate query parameters
    const queryData = {
      categoryId: url.searchParams.get('categoryId') || undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50,
      offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0,
    };

    const validation = LeaderboardQuerySchema.safeParse(queryData);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_QUERY', message: 'Invalid query parameters' },
        },
        { status: 400 }
      );
    }

    const { categoryId, limit, offset } = validation.data;

    const supabase = await getSupabaseServerClient();

    // Get current active league
    const now = new Date().toISOString();
    let leagueQuery = supabase
      .from('leagues')
      .select('id, category_id, end_at')
      .eq('status', 'active')
      .gte('end_at', now)

    if (categoryId) {
      const { data: category } = await supabase.from('categories').select('id').eq('slug', categoryId).maybeSingle()
      leagueQuery = leagueQuery.eq('category_id', category?.id || categoryId)
    }

    const { data: leagueData } = await leagueQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!leagueData) {
      return NextResponse.json(
        {
          success: true,
          data: {
            leaderboard: [],
            total: 0,
            leagueEndsAt: null,
          },
        },
        { status: 200 }
      );
    }

    // Get leaderboard stats
    let statsQuery = supabase
      .from('participant_stats')
      .select(
        `
        id,
        participant_id,
        league_id,
        rating,
        wins,
        losses,
        battle_count,
        votes_received,
        win_rate,
        current_rank,
        previous_rank,
        participants(id, name, slug, logo_url, description, type, category_id)
      `
      )
      .eq('league_id', leagueData.id);

    const { data: statsData, error, count } = await statsQuery
      .order('rating', { ascending: false })
      .order('wins', { ascending: false })
      .order('battle_count', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch leaderboard' },
        },
        { status: 500 }
      );
    }

    // Format response
    const leaderboard = (statsData || []).map((stat: any, index: number) => ({
      rank: offset + index + 1,
      participant: {
        id: stat.participants.id,
        name: stat.participants.name,
        slug: stat.participants.slug,
        logo: stat.participants.logo_url,
        description: stat.participants.description,
        type: stat.participants.type,
      },
      rating: stat.rating,
      wins: stat.wins,
      losses: stat.losses,
      battleCount: stat.battle_count,
      votesReceived: stat.votes_received,
      winRate: stat.win_rate,
      movement: stat.current_rank && stat.previous_rank ? stat.previous_rank - stat.current_rank : 0,
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          leaderboard,
          total: count || 0,
          leagueEndsAt: leagueData.end_at,
          limit,
          offset,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/leaderboard:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      },
      { status: 500 }
    );
  }
}
