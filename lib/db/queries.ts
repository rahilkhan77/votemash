import { query, withTransaction, isUniqueViolation } from './client'

export type BattleParticipant = { id: string; name: string; slug: string; logo_url: string | null; description: string }

export function getCurrentTimestamp() {
  return new Date().toISOString()
}

export async function getCategoryById(categoryId: string) {
  const result = await query('SELECT * FROM categories WHERE id = $1', [categoryId])
  return result.rows[0] || null
}

export async function getCategoryBySlugOrId(value: string) {
  const result = await query('SELECT * FROM categories WHERE id::text = $1 OR slug = $1 LIMIT 1', [value])
  return result.rows[0] || null
}

export async function getActiveCategories() {
  const result = await query('SELECT * FROM categories WHERE active = true ORDER BY sort_order')
  return result.rows
}

export async function getNextBattle(categorySlug: string | undefined, voterTokenHash: string) {
  const values: unknown[] = [voterTokenHash]
  let categoryClause = ''
  if (categorySlug) {
    values.push(categorySlug)
    categoryClause = `AND c.slug = $${values.length}`
  }
  const result = await query(`
    SELECT b.id, b.league_id, b.votes_a, b.votes_b, b.total_votes, l.end_at AS league_end_at,
      json_build_object('id', pa.id, 'name', pa.name, 'slug', pa.slug, 'logo_url', pa.logo_url, 'description', pa.description) AS participant_a,
      json_build_object('id', pb.id, 'name', pb.name, 'slug', pb.slug, 'logo_url', pb.logo_url, 'description', pb.description) AS participant_b,
      json_build_object('id', l.id, 'category_id', l.category_id, 'end_at', l.end_at) AS league,
      l.category_id AS category
    FROM battles b
    JOIN leagues l ON l.id = b.league_id AND l.status = 'active' AND l.end_at >= now()
    JOIN categories c ON c.id = l.category_id
    JOIN participants pa ON pa.id = b.participant_a_id AND pa.status = 'active'
    JOIN participants pb ON pb.id = b.participant_b_id AND pb.status = 'active'
    WHERE b.status = 'active' ${categoryClause}
      AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.battle_id = b.id AND v.voter_token_hash = $1)
    ORDER BY b.created_at ASC
    LIMIT 1
  `, values)
  return result.rows[0] || null
}

export async function submitVote(battleId: string, participantId: string, voterTokenHash: string, ipHash: string | null, userAgentHash: string | null) {
  return withTransaction(async (client) => {
    const battleResult = await client.query(`
      SELECT b.*, l.status AS league_status, l.end_at
      FROM battles b JOIN leagues l ON l.id = b.league_id
      WHERE b.id = $1 FOR UPDATE
    `, [battleId])
    const battle = battleResult.rows[0]
    if (!battle) return { error: 'NOT_FOUND' as const }
    if (battle.status !== 'active' || battle.league_status !== 'active' || new Date(battle.end_at) < new Date()) return { error: 'INVALID_STATE' as const }
    if (![battle.participant_a_id, battle.participant_b_id].includes(participantId)) return { error: 'INVALID_PARTICIPANT' as const }
    try {
      await client.query('INSERT INTO votes (battle_id, selected_participant_id, voter_token_hash, ip_hash, user_agent_hash) VALUES ($1,$2,$3,$4,$5)', [battleId, participantId, voterTokenHash, ipHash, userAgentHash])
    } catch (error) {
      if (isUniqueViolation(error)) return { error: 'DUPLICATE_VOTE' as const }
      throw error
    }
    const updated = await client.query(`UPDATE battles SET votes_a = votes_a + CASE WHEN participant_a_id = $2 THEN 1 ELSE 0 END, votes_b = votes_b + CASE WHEN participant_b_id = $2 THEN 1 ELSE 0 END, total_votes = total_votes + 1, updated_at = now() WHERE id = $1 RETURNING *`, [battleId, participantId])
    return { battle: updated.rows[0] }
  })
}

export async function getLeaderboard(categorySlug: string | undefined, limit: number, offset: number) {
  const values: unknown[] = []
  let categoryClause = ''
  if (categorySlug) { values.push(categorySlug); categoryClause = `AND c.slug = $1` }
  const league = await query(`SELECT l.id, l.end_at FROM leagues l JOIN categories c ON c.id = l.category_id WHERE l.status = 'active' AND l.end_at >= now() ${categoryClause} ORDER BY l.created_at DESC LIMIT 1`, values)
  if (!league.rows[0]) return { rows: [], total: 0, leagueEndsAt: null }
  
  // Build second query with fresh parameter indices
  const statsValues = [league.rows[0].id, limit, offset]
  const stats = await query(`SELECT s.*, p.id AS participant_id, p.name, p.slug, p.logo_url, p.description, p.type, COUNT(*) OVER() AS total_count FROM participant_stats s JOIN participants p ON p.id = s.participant_id WHERE s.league_id = $1 AND p.status = 'active' ORDER BY s.rating DESC, s.wins DESC, s.battle_count DESC LIMIT $2 OFFSET $3`, statsValues)
  return { rows: stats.rows, total: Number(stats.rows[0]?.total_count || 0), leagueEndsAt: league.rows[0].end_at }
}

export async function getParticipantBySlug(slug: string) {
  const result = await query(`SELECT p.id, p.name, p.slug, p.type, p.description, p.website_url, p.logo_url, p.status, p.created_at, json_build_object('name', c.name, 'slug', c.slug) AS categories FROM participants p JOIN categories c ON c.id = p.category_id WHERE p.slug = $1 AND p.status = 'active'`, [slug])
  return result.rows[0] || null
}

export async function getActiveSpotlight() {
  const result = await query(`SELECT s.id, s.participant_id, s.league_id, s.starts_at, s.ends_at, s.status, json_build_object('id', p.id, 'name', p.name, 'slug', p.slug, 'logo_url', p.logo_url, 'description', p.description) AS participants FROM champion_spotlights s JOIN participants p ON p.id = s.participant_id WHERE s.status = 'active' AND s.starts_at <= now() AND s.ends_at > now() ORDER BY s.ends_at DESC LIMIT 1`)
  return result.rows[0] || null
}
