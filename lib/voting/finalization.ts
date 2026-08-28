/**
 * Battle finalization service
 * Finalizes completed battles by calculating Elo changes and updating participant stats
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Finalize a battle - idempotent operation
 */
export async function finalizeBattle(battleId: string) {
  const supabase = getSupabaseAdmin() as any
  const { data, error } = await supabase.rpc('finalize_battle', { p_battle_id: battleId })
  if (error) return { success: false, error: error.message }
  const result = data as { success: boolean; already_finalized?: boolean; winner_id?: string; rating_change_a?: number; rating_change_b?: number }
  return {
    success: result.success,
    alreadyFinalized: result.already_finalized,
    battleId,
    winner: result.winner_id,
    ratingChanges: { participantA: result.rating_change_a, participantB: result.rating_change_b },
  }
}

/**
 * Finalize all completed battles in a league
 */
export async function finalizeLeagueBattles(leagueId: string) {
  const supabase = getSupabaseAdmin()

  const { data: battlesData } = await supabase
    .from('battles')
    .select('id')
    .eq('league_id', leagueId)
    .eq('status', 'active')

  const battles = battlesData as any[]

  if (!battles || battles.length === 0) {
    return { processed: 0 }
  }

  let processed = 0
  for (const battle of battles) {
    const result = await finalizeBattle(battle.id)
    if (result.success && !result.alreadyFinalized) {
      processed++
    }
  }

  return { processed }
}
