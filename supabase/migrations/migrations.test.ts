import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const directory = join(process.cwd(), 'supabase', 'migrations')
const migrations = readdirSync(directory).filter((file) => file.endsWith('.sql')).sort()
const sql = migrations.map((file) => readFileSync(join(directory, file), 'utf8')).join('\n')

describe('Supabase migration contract', () => {
  it('has deterministic numbered execution order', () => {
    expect(migrations).toEqual([
      '001_initial_schema.sql',
      '002_battle_and_related_tables.sql',
      '003_payments_and_league_joins.sql',
      '004_indexes.sql',
      '005_rls_policies.sql',
      '006_authoritative_voting.sql',
      '007_finalization_consistency.sql',
      '008_atomic_battle_finalization.sql',
      '009_provider_neutral_payments.sql',
      '010_pricing_reservations.sql',
    ])
  })

  it('contains required tables and integrity controls', () => {
    for (const table of ['categories', 'participants', 'participant_stats', 'leagues', 'battles', 'votes', 'battle_results', 'league_qualifications', 'champion_spotlights', 'payments', 'abuse_events']) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`))
    }
    expect(sql).toContain('UNIQUE(battle_id, voter_token_hash)')
    expect(sql).toContain('UNIQUE(participant_id, league_id)')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION submit_vote')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION finalize_battle')
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION submit_vote')
    expect(sql).toContain('DROP POLICY IF EXISTS "Anyone can insert votes via API" ON votes')
    expect(sql).toContain('ALTER TABLE votes ENABLE ROW LEVEL SECURITY')
  })
})
