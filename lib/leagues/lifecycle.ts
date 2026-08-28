import { query, withTransaction } from '@/lib/db/client'
import { generateBattlesForLeague, activateBattles } from '@/lib/voting/battles'
import { finalizeLeagueBattles } from '@/lib/voting/finalization'

export async function createLeague(categoryId: string) {
  const existing = await query<{ id: string }>("SELECT id FROM leagues WHERE category_id = $1 AND status = 'active' AND end_at >= now() LIMIT 1", [categoryId])
  if (existing.rows[0]) return { success: false, error: 'Active league already exists for this category', leagueId: existing.rows[0].id }
  const result = await query('INSERT INTO leagues (category_id, type, start_at, end_at, status, league_number) VALUES ($1, $2, now(), now() + interval \'48 hours\', $3, COALESCE((SELECT max(league_number) + 1 FROM leagues WHERE category_id = $1), 1)) RETURNING *', [categoryId, 'category', 'active'])
  return { success: true, league: result.rows[0] }
}

export async function activateParticipantInCurrentLeague(participantId: string, categoryId: string) {
  const league = await query<{ id: string }>("SELECT id FROM leagues WHERE category_id = $1 AND status = 'active' AND end_at >= now() ORDER BY created_at DESC LIMIT 1", [categoryId])
  if (!league.rows[0]) return { success: false, error: 'No active league' }
  const leagueId = league.rows[0].id
  await withTransaction(async (client) => {
    await client.query('INSERT INTO participant_league_joins (participant_id, league_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [participantId, leagueId])
    await client.query('INSERT INTO participant_stats (participant_id, league_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [participantId, leagueId])
    const opponents = await client.query<{ participant_id: string }>('SELECT participant_id FROM participant_league_joins WHERE league_id = $1 AND participant_id <> $2', [leagueId, participantId])
    for (const opponent of opponents.rows) await client.query('INSERT INTO battles (league_id, participant_a_id, participant_b_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [leagueId, participantId, opponent.participant_id])
  })
  return { success: true, leagueId }
}

export async function activateLeague(leagueId: string) {
  const league = await query<{ category_id: string }>("SELECT category_id FROM leagues WHERE id = $1 AND status = 'scheduled'", [leagueId])
  if (!league.rows[0]) return { success: false, error: 'League not found or already active' }
  const participants = await query<{ id: string }>("SELECT p.id FROM participants p WHERE p.category_id = $1 AND p.status = 'active' ORDER BY p.created_at LIMIT 10", [league.rows[0].category_id])
  for (const participant of participants.rows) { await query('INSERT INTO participant_league_joins (participant_id, league_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [participant.id, leagueId]); await query('INSERT INTO participant_stats (participant_id, league_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [participant.id, leagueId]) }
  const battles = await generateBattlesForLeague(leagueId)
  const activated = await activateBattles(leagueId, Math.max(5, Math.floor(participants.rows.length / 3)))
  await query("UPDATE leagues SET status = 'active' WHERE id = $1", [leagueId])
  return { success: true, league: { id: leagueId, participantCount: participants.rows.length, battleCount: battles.length, activatedBattles: activated } }
}

export async function checkAndFinalizeExpiredLeagues() {
  const leagues = await query<{ id: string }>("SELECT id FROM leagues WHERE status = 'active' AND end_at < now()")
  let processed = 0
  for (const league of leagues.rows) { const result = await finalizeLeague(league.id); if (result.success) processed += 1 }
  return { processed }
}

export async function finalizeLeague(leagueId: string) {
  const league = await query('SELECT id FROM leagues WHERE id = $1', [leagueId])
  if (!league.rows[0]) return { success: false, error: 'League not found' }
  await finalizeLeagueBattles(leagueId)
  const standings = await query<{ participant_id: string }>('SELECT participant_id FROM participant_stats WHERE league_id = $1 ORDER BY rating DESC, wins DESC LIMIT 3', [leagueId])
  for (let index = 0; index < standings.rows.length; index += 1) await query('INSERT INTO league_qualifications (source_league_id, participant_id, rank) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [leagueId, standings.rows[index].participant_id, index + 1])
  if (standings.rows[0]) await query("INSERT INTO champion_spotlights (league_id, participant_id, starts_at, ends_at, status) VALUES ($1,$2,now(),now() + interval '48 hours','active') ON CONFLICT DO NOTHING", [leagueId, standings.rows[0].participant_id])
  await query("UPDATE leagues SET status = 'completed', completed_at = now() WHERE id = $1 AND status <> 'completed'", [leagueId])
  return { success: true, league: { id: leagueId, qualifiers: standings.rows } }
}
