import { withTransaction, query } from '@/lib/db/client'
import { calculateEloChange, determineWinner } from './elo'

export async function finalizeBattle(battleId: string) {
  return withTransaction(async (client) => {
    const battleResult = await client.query('SELECT * FROM battles WHERE id = $1 FOR UPDATE', [battleId])
    const battle = battleResult.rows[0]
    if (!battle) return { success: false, error: 'Battle not found' }
    if (battle.status !== 'active') return { success: true, alreadyFinalized: true, battleId }

    const existing = await client.query('SELECT id FROM battle_results WHERE battle_id = $1', [battleId])
    if (existing.rowCount) return { success: true, alreadyFinalized: true, battleId }

    const stats = await client.query('SELECT * FROM participant_stats WHERE league_id = $1 AND participant_id IN ($2,$3) ORDER BY participant_id FOR UPDATE', [battle.league_id, battle.participant_a_id, battle.participant_b_id])
    if (stats.rows.length !== 2) return { success: false, error: 'Participant stats not found' }

    const result = determineWinner(battle.votes_a, battle.votes_b)
    const statA = stats.rows.find((row) => row.participant_id === battle.participant_a_id)
    const statB = stats.rows.find((row) => row.participant_id === battle.participant_b_id)
    const ratingA = statA?.rating ?? 1500
    const ratingB = statB?.rating ?? 1500
    const elo = calculateEloChange(ratingA, ratingB, result)
    const changeA = statA ? elo.ratingChangeA : elo.ratingChangeB
    const changeB = -changeA
    const winner = result === 1 ? battle.participant_a_id : result === 0 ? battle.participant_b_id : null
    const loser = result === 1 ? battle.participant_b_id : result === 0 ? battle.participant_a_id : null

    await client.query(`UPDATE participant_stats SET rating = rating + $1, wins = wins + $2, losses = losses + $3, battle_count = battle_count + 1, win_rate = CASE WHEN battle_count + 1 = 0 THEN 0 ELSE (wins + $2)::numeric * 100 / (battle_count + 1) END, updated_at = now() WHERE participant_id = $4 AND league_id = $5`, [changeA, result === 1 ? 1 : 0, result === 0 ? 1 : 0, battle.participant_a_id, battle.league_id])
    await client.query(`UPDATE participant_stats SET rating = rating + $1, wins = wins + $2, losses = losses + $3, battle_count = battle_count + 1, win_rate = CASE WHEN battle_count + 1 = 0 THEN 0 ELSE (wins + $2)::numeric * 100 / (battle_count + 1) END, updated_at = now() WHERE participant_id = $4 AND league_id = $5`, [changeB, result === 0 ? 1 : 0, result === 1 ? 1 : 0, battle.participant_b_id, battle.league_id])

    const total = battle.votes_a + battle.votes_b
    const inserted = await client.query(
      'INSERT INTO battle_results (battle_id, winner_id, loser_id, votes_a, votes_b, percentage_a, percentage_b, rating_change_a, rating_change_b) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (battle_id) DO NOTHING RETURNING *',
      [battleId, winner, loser, battle.votes_a, battle.votes_b, total ? battle.votes_a * 100 / total : 50, total ? battle.votes_b * 100 / total : 50, changeA, changeB]
    )

    if (!inserted.rowCount) return { success: true, alreadyFinalized: true, battleId }

    const updated = await client.query('UPDATE battles SET status = $1, winner_id = $2, ended_at = now(), updated_at = now() WHERE id = $3 AND status = $4 RETURNING *', ['completed', winner, battleId, 'active'])
    if (!updated.rowCount) return { success: true, alreadyFinalized: true, battleId }

    return { success: true, alreadyFinalized: false, battleId, winner, ratingChanges: { participantA: changeA, participantB: changeB } }
  })
}

export async function finalizeLeagueBattles(leagueId: string) {
  const battles = await query<{ id: string }>("SELECT id FROM battles WHERE league_id = $1 AND status = 'active'", [leagueId])
  let processed = 0
  for (const battle of battles.rows) {
    const result = await finalizeBattle(battle.id)
    if (result.success && !result.alreadyFinalized) processed += 1
  }
  return { processed }
}
