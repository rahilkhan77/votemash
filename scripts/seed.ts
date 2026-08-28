import { config } from 'dotenv'
import { query, withTransaction } from '../lib/db/client'

config({ path: '.env.local' })

const categories = [
  ['AI Tools', 'ai-tools', 'AI-powered tools and assistants', 1],
  ['Startups', 'startups', 'Innovative startup companies', 2],
  ['Developer Tools', 'developer-tools', 'Tools for software development', 3],
  ['Apps', 'apps', 'Software applications', 4],
  ['Products', 'products', 'Popular consumer products', 5],
  ['Design Tools', 'design-tools', 'Design and creative tools', 6],
  ['Productivity', 'productivity', 'Productivity and organization tools', 7],
  ['Games', 'games', 'Gaming platforms and games', 8],
] as const

const participants = [
  ['OpenAI / ChatGPT', 'openai-chatgpt', 'AI assistant for writing, analysis, and creation', 'https://chatgpt.com', '/logos/openai-chatgpt.png'],
  ['Anthropic / Claude', 'anthropic-claude', 'AI assistant built by Anthropic', 'https://claude.ai', '/logos/anthropic-claude.ico'],
  ['Google / Gemini', 'google-gemini', 'Google AI assistant for work and creativity', 'https://gemini.google.com', '/logos/google-gemini.svg'],
  ['Cursor', 'cursor', 'AI-powered code editor', 'https://cursor.com', '/logos/cursor.svg'],
  ['Perplexity', 'perplexity', 'AI-powered search and answer engine', 'https://www.perplexity.ai', '/logos/perplexity.ico'],
  ['GitHub Copilot', 'github-copilot', 'AI coding assistant from GitHub', 'https://github.com/features/copilot', '/logos/github-copilot.ico'],
  ['Windsurf', 'windsurf', 'Agentic development environment', 'https://windsurf.com', '/logos/windsurf.ico'],
  ['v0', 'v0', 'AI-powered interface builder by Vercel', 'https://v0.dev', '/logos/v0.svg'],
  ['Lovable', 'lovable', 'AI-powered app development platform', 'https://lovable.dev', '/logos/lovable.ico'],
  ['Replit', 'replit', 'Collaborative AI-powered development platform', 'https://replit.com', '/logos/replit.png'],
] as const

function createRoundRobinSchedule(participantIds: string[]) {
  const schedule: Array<{ participantA: string; participantB: string; order: number }> = []
  let order = 0

  for (let left = 0; left < participantIds.length; left += 1) {
    for (let right = left + 1; right < participantIds.length; right += 1) {
      const participantA = (left + right) % 2 === 0 ? participantIds[left] : participantIds[right]
      const participantB = participantA === participantIds[left] ? participantIds[right] : participantIds[left]
      schedule.push({ participantA, participantB, order })
      order += 1
    }
  }

  return schedule
}

async function seed() {
  await withTransaction(async (client) => {
    for (const [name, slug, description, sortOrder] of categories) await client.query('INSERT INTO categories (name, slug, description, sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order, active = true', [name, slug, description, sortOrder])
    const category = await client.query<{ id: string }>("SELECT id FROM categories WHERE slug = 'ai-tools'")
    const categoryId = category.rows[0].id
    for (const [name, slug, description, websiteUrl, logoUrl] of participants) {
      await client.query('INSERT INTO participants (name, slug, description, website_url, logo_url, type, category_id, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, website_url = EXCLUDED.website_url, logo_url = EXCLUDED.logo_url, type = EXCLUDED.type, category_id = EXCLUDED.category_id, status = EXCLUDED.status, updated_at = now()', [name, slug, description, websiteUrl, logoUrl, 'ai_tool', categoryId, 'active'])
    }
    const league = await client.query<{ id: string }>("SELECT id FROM leagues WHERE category_id = $1 AND status = 'active' AND end_at >= now() ORDER BY created_at DESC LIMIT 1", [categoryId])
    let leagueId = league.rows[0]?.id
    if (!leagueId) leagueId = (await client.query<{ id: string }>("INSERT INTO leagues (type, category_id, start_at, end_at, status, league_number) VALUES ('category',$1,now(),now() + interval '48 hours','active',COALESCE((SELECT max(league_number) + 1 FROM leagues WHERE category_id = $1),1)) RETURNING id", [categoryId])).rows[0].id
    const seeded = await client.query<{ id: string }>('SELECT id FROM participants WHERE category_id = $1 AND slug = ANY($2::text[]) ORDER BY array_position($2::text[], slug)', [categoryId, participants.map((participant) => participant[1])])
    for (const participant of seeded.rows) { await client.query('INSERT INTO participant_league_joins (participant_id, league_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [participant.id, leagueId]); await client.query('INSERT INTO participant_stats (participant_id, league_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [participant.id, leagueId]) }
    const schedule = createRoundRobinSchedule(seeded.rows.map((participant) => participant.id))
    const existing = await client.query<{ id: string; participant_a_id: string; participant_b_id: string; status: string }>('SELECT id, participant_a_id, participant_b_id, status FROM battles WHERE league_id = $1', [leagueId])
    const existingByPair = new Map(existing.rows.map((battle) => [[battle.participant_a_id, battle.participant_b_id].sort().join(':'), battle]))
    for (const match of schedule) {
      const pairKey = [match.participantA, match.participantB].sort().join(':')
      const current = existingByPair.get(pairKey)
      if (!current) {
        await client.query('INSERT INTO battles (league_id, participant_a_id, participant_b_id, status, created_at) VALUES ($1,$2,$3,$4,now() + ($5 * interval \'1 second\'))', [leagueId, match.participantA, match.participantB, 'scheduled', match.order])
        continue
      }
      if (current.status === 'scheduled' || current.status === 'active') {
        const needsSwap = current.participant_a_id !== match.participantA
        await client.query(`UPDATE battles SET participant_a_id = $1, participant_b_id = $2, votes_a = CASE WHEN $3 THEN votes_b ELSE votes_a END, votes_b = CASE WHEN $3 THEN votes_a ELSE votes_b END, created_at = now() + ($4 * interval '1 second'), updated_at = now() WHERE id = $5`, [match.participantA, match.participantB, needsSwap, match.order, current.id])
      }
    }
    await client.query("UPDATE battles SET status = 'active', started_at = COALESCE(started_at, now()) WHERE league_id = $1 AND status = 'scheduled' AND id IN (SELECT id FROM battles WHERE league_id = $1 AND status = 'scheduled' ORDER BY created_at LIMIT 10)", [leagueId])
    console.log(`Seeded ${seeded.rows.length} AI Tools participants in league ${leagueId}`)
  })
}

seed().catch((error) => { console.error('Seed failed:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1 })
