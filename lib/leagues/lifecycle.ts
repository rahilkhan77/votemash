/**
 * League lifecycle management
 * Handles league creation, activation, expiration, and finalization
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { generateBattlesForLeague, activateBattles } from '@/lib/voting/battles'
import { finalizeLeagueBattles } from '../voting/finalization'

const LEAGUE_DURATION_HOURS = 48

/**
 * Create and activate a new league for a category
 */
export async function createLeague(categoryId: string) {
  const supabase = getSupabaseAdmin()
  const now = new Date()
  const endTime = new Date(now.getTime() + LEAGUE_DURATION_HOURS * 60 * 60 * 1000)

  // Check if active league exists
  const { data: activeLeagueData } = await supabase
    .from('leagues')
    .select('id')
    .eq('category_id', categoryId)
    .eq('status', 'active')
    .gte('end_at', now.toISOString())
    .single()

  const activeLeague = activeLeagueData as any

  if (activeLeague) {
    return { success: false, error: 'Active league already exists for this category', leagueId: activeLeague.id }
  }

  // Create new league
  const { data: leagueData, error } = await supabase
    .from('leagues')
    .insert({
      category_id: categoryId,
      status: 'scheduled',
      start_at: now.toISOString(),
      end_at: endTime.toISOString(),
      created_at: now.toISOString(),
    } as any)
    .select()
    .single()

  const league = leagueData as any

  if (error) {
    console.error('Error creating league:', error)
    return { success: false, error: error.message }
  }

  return { success: true, league }
}

/**
 * Activate a scheduled league
 * Adds initial participants and generates battles
 */
export async function activateLeague(leagueId: string) {
  const supabase = getSupabaseAdmin()

  const { data: leagueData } = await supabase
    .from('leagues')
    .select('id, category_id, status')
    .eq('id', leagueId)
    .single()

  const league = leagueData as any

  if (!league) {
    return { success: false, error: 'League not found' }
  }

  if (league.status !== 'scheduled') {
    return { success: false, error: 'League is not in scheduled state' }
  }

  // Get top participants from previous league (or seed participants)
  const { data: seedParticipantsData } = await supabase
    .from('participants')
    .select('id')
    .eq('category_id', league.category_id)
    .eq('status', 'active')
    .limit(10)

  const seedParticipants = seedParticipantsData as any[]

  if (!seedParticipants || seedParticipants.length === 0) {
    return { success: false, error: 'No participants available for league' }
  }

  // Add participants to league
  const joinRecords = seedParticipants.map((p: any) => ({
    league_id: leagueId,
    participant_id: p.id,
  }))

  const { error: joinError } = await supabase
    .from('participant_league_joins')
    .insert(joinRecords as any)

  if (joinError) {
    console.error('Error adding participants to league:', joinError)
    return { success: false, error: joinError.message }
  }

  // Create initial participant stats for all participants
  const statsRecords = seedParticipants.map((p: any) => ({
    league_id: leagueId,
    participant_id: p.id,
    rating: 1500,
    wins: 0,
    losses: 0,
    battle_count: 0,
    votes_received: 0,
    win_rate: 0,
    current_rank: 0,
    previous_rank: 0,
  }))

  const { error: statsError } = await supabase
    .from('participant_stats')
    .insert(statsRecords as any)

  if (statsError && !statsError.message.includes('duplicate')) {
    console.error('Error creating participant stats:', statsError)
    return { success: false, error: statsError.message }
  }

  // Generate battles
  const battles = await generateBattlesForLeague(leagueId)
  if (!battles || battles.length === 0) {
    return { success: false, error: 'Failed to generate battles' }
  }

  // Activate initial batch of battles
  const activated = await activateBattles(leagueId, Math.max(5, Math.floor(seedParticipants.length / 3)))

  // Update league status
  const _ = supabase
  await ((supabase.from('leagues') as any)
    .update({ status: 'active' } as any)
    .eq('id', leagueId) as any)

  return {
    success: true,
    league: {
      id: leagueId,
      participantCount: seedParticipants.length,
      battleCount: battles.length,
      activatedBattles: activated,
    },
  }
}

export async function activateParticipantInCurrentLeague(participantId: string, categoryId: string) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data: leagueData } = await supabase.from('leagues').select('id').eq('category_id', categoryId).eq('status', 'active').gt('end_at', now).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const league = leagueData as { id: string } | null
  if (!league) return { success: false, error: 'No active league' }

  await (supabase.from('participant_league_joins') as any).upsert({ participant_id: participantId, league_id: league.id }, { onConflict: 'participant_id,league_id' })
  await (supabase.from('participant_stats') as any).upsert({ participant_id: participantId, league_id: league.id, rating: 1500, wins: 0, losses: 0, battle_count: 0, votes_received: 0, current_rank: 0 }, { onConflict: 'participant_id,league_id', ignoreDuplicates: true })

  const { data: opponentsData } = await supabase.from('participant_league_joins').select('participant_id').eq('league_id', league.id).neq('participant_id', participantId)
  const opponents = (opponentsData || []) as { participant_id: string }[]
  const { data: existingBattlesData } = await supabase.from('battles').select('participant_b_id').eq('league_id', league.id).eq('participant_a_id', participantId)
  const existingOpponentIds = new Set(((existingBattlesData || []) as { participant_b_id: string }[]).map((battle) => battle.participant_b_id))
  const pairings = opponents.filter((opponent) => !existingOpponentIds.has(opponent.participant_id)).map((opponent) => ({ league_id: league.id, participant_a_id: participantId, participant_b_id: opponent.participant_id, status: 'scheduled', votes_a: 0, votes_b: 0, total_votes: 0 }))
  if (pairings.length) await (supabase.from('battles') as any).insert(pairings)
  await (supabase.from('participants') as any).update({ status: 'active' }).eq('id', participantId).eq('status', 'pending')
  return { success: true, leagueId: league.id, battlesCreated: pairings.length }
}

/**
 * Check and finalize expired leagues
 * Called by cron job periodically
 */
export async function checkAndFinalizeExpiredLeagues() {
  const supabase = getSupabaseAdmin()
  const now = new Date()

  // Find active leagues that have expired
  const { data: expiredLeaguesData } = await supabase
    .from('leagues')
    .select('id, category_id')
    .eq('status', 'active')
    .lt('end_at', now.toISOString())

  const expiredLeagues = expiredLeaguesData as any[]

  if (!expiredLeagues || expiredLeagues.length === 0) {
    return { processed: 0 }
  }

  let processed = 0
  for (const league of expiredLeagues) {
    const result = await finalizeLeague(league.id)
    if (result.success) {
      processed++
    }
  }

  return { processed }
}

/**
 * Finalize a completed league
 */
export async function finalizeLeague(leagueId: string) {
  const supabase = getSupabaseAdmin()
  const now = new Date()

  const { data: leagueData } = await supabase
    .from('leagues')
    .select('id, category_id')
    .eq('id', leagueId)
    .single()

  const league = leagueData as any

  if (!league) {
    return { success: false, error: 'League not found' }
  }

  // Finalize all remaining active battles
  await finalizeLeagueBattles(leagueId)

  // Get final standings
  const { data: standingsData } = await supabase
    .from('participant_stats')
    .select(
      `
      participant_id,
      rating,
      wins,
      losses,
      battle_count,
      participants(id, name, slug, description)
    `
    )
    .eq('league_id', leagueId)
    .order('rating', { ascending: false })
    .order('wins', { ascending: false })
    .limit(3)

  const standings = standingsData as any[]

  if (!standings || standings.length === 0) {
    return { success: false, error: 'No standings data' }
  }

  // Record qualifications for top 3
  const qualifications = standings.map((stat: any, index: number) => ({
    source_league_id: leagueId,
    participant_id: stat.participant_id,
    rank: index + 1,
    qualified_at: now.toISOString(),
  }))

  const { error: qualError } = await supabase
    .from('league_qualifications')
    .insert(qualifications as any)

  if (qualError && !qualError.message.includes('duplicate')) {
    console.error('Error recording qualifications:', qualError)
  }

  // Create champion spotlight for winner
  if (standings[0]) {
    const spotlightEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const { error: spotlightError } = await supabase
      .from('champion_spotlights')
      .insert({
        participant_id: standings[0].participant_id,
        league_id: leagueId,
        starts_at: now.toISOString(),
        ends_at: spotlightEnd.toISOString(),
        status: 'active',
      } as any)

    if (spotlightError && !spotlightError.message.includes('duplicate')) {
      console.error('Error creating spotlight:', spotlightError)
    }
  }

  // Mark league as completed
  const _ = supabase
  await ((supabase.from('leagues') as any)
    .update({
      status: 'completed',
      completed_at: now.toISOString(),
    } as any)
    .eq('id', leagueId) as any)

  return {
    success: true,
    league: {
      id: leagueId,
      champion: standings[0],
      qualifiers: standings.slice(0, 3),
    },
  }
}
