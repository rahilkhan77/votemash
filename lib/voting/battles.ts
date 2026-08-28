/**
 * Battle generation and fetching utilities
 */

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Get an eligible battle for the voter
 * Returns a battle that:
 * 1. Is active in the specified league/category
 * 2. The voter hasn't already voted in
 */
export async function getNextBattle(categoryId?: string, voterTokenHash?: string) {
  const supabase = await getSupabaseServerClient();

  let query = supabase
    .from('battles')
    .select(
      `
      id,
      league_id,
      status,
      participant_a_id,
      participant_b_id,
      votes_a,
      votes_b,
      total_votes,
      started_at,
      ended_at,
      leagues(id, end_at, category_id),
      participants!battles_participant_a_id_fkey(id, name, slug, logo_url, description),
      participants_b:participants!battles_participant_b_id_fkey(id, name, slug, logo_url, description)
    `
    )
    .eq('battles.status', 'active');

  // Filter by category if provided
  if (categoryId) {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', categoryId)
      .maybeSingle()
    query = query.eq('leagues.category_id', category?.id || categoryId);
  }

  // Get eligible battles (not voted by this voter)
  const { data: battles, error } = await query.limit(10);

  if (error) {
    console.error('Error fetching battles:', error);
    return null;
  }

  if (!battles || battles.length === 0) {
    return null;
  }

  // If voterTokenHash is provided, filter out battles already voted
  if (voterTokenHash) {
    const { data: votedBattleIds } = await supabase
      .from('votes')
      .select('battle_id')
      .eq('voter_token_hash', voterTokenHash);

    const votedIds = new Set(votedBattleIds?.map((v: any) => v.battle_id) || []);

    const eligibleBattle = battles.find((b: any) => !votedIds.has(b.id));

    if (!eligibleBattle) {
      return null;
    }

    return eligibleBattle;
  }

  // Return first battle
  return battles[0];
}

/**
 * Generate battles for a league
 * Creates pairings between participants
 */
export async function generateBattlesForLeague(leagueId: string) {
  const supabase = getSupabaseAdmin() as any;

  // Get all participants in the league
  const { data: participants, error: participantError } = await supabase
    .from('participant_league_joins')
    .select('participant_id')
    .eq('league_id', leagueId);

  if (participantError || !participants || participants.length < 2) {
    console.error('Error getting participants:', participantError);
    return [];
  }

  const participantIds = participants.map((p: any) => p.participant_id);

  // Create pairings (simple round-robin for MVP)
  const battles: any[] = [];

  for (let i = 0; i < participantIds.length; i++) {
    for (let j = i + 1; j < participantIds.length; j++) {
      battles.push({
        league_id: leagueId,
        participant_a_id: participantIds[i],
        participant_b_id: participantIds[j],
        status: 'scheduled',
        votes_a: 0,
        votes_b: 0,
        total_votes: 0,
      });
    }
  }

  if (battles.length === 0) {
    return [];
  }

  // Insert battles
  const { data, error } = await supabase.from('battles').insert(battles).select();

  if (error) {
    console.error('Error creating battles:', error);
    return [];
  }

  return data || [];
}

/**
 * Activate battles for voting
 * Marks battles as active so they appear to voters
 */
export async function activateBattles(leagueId: string, count: number = 5) {
  const supabase = getSupabaseAdmin() as any;

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('battles')
    .update({
      status: 'active',
      started_at: now,
    })
    .eq('league_id', leagueId)
    .eq('status', 'scheduled')
    .order('created_at', { ascending: true })
    .limit(count)
    .select();

  if (error) {
    console.error('Error activating battles:', error);
    return 0;
  }

  return data?.length || 0;
}
