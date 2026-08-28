import { query } from '@/lib/db/client'
import { getNextBattle as getBattle } from '@/lib/db/queries'

export const getNextBattle = getBattle

export async function generateBattlesForLeague(leagueId: string) {
  const participants = await query<{ participant_id: string }>('SELECT participant_id FROM participant_league_joins WHERE league_id = $1 ORDER BY joined_at, participant_id', [leagueId])
  const pairings: Array<[string, string]> = []
  for (let left = 0; left < participants.rows.length; left += 1) for (let right = left + 1; right < participants.rows.length; right += 1) pairings.push([participants.rows[left].participant_id, participants.rows[right].participant_id])
  for (const [participantA, participantB] of pairings) await query('INSERT INTO battles (league_id, participant_a_id, participant_b_id) VALUES ($1,$2,$3) ON CONFLICT (league_id, participant_a_id, participant_b_id) DO NOTHING', [leagueId, participantA, participantB])
  return pairings
}

export async function activateBattles(leagueId: string, count = 5) {
  const result = await query('UPDATE battles SET status = $1, started_at = now() WHERE id IN (SELECT id FROM battles WHERE league_id = $2 AND status = $3 ORDER BY created_at LIMIT $4) RETURNING id', ['active', leagueId, 'scheduled', count])
  return result.rowCount || 0
}
