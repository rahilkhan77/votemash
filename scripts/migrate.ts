import { config } from 'dotenv'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { query, withTransaction } from '../lib/db/client'

config({ path: '.env.local' })

async function main() {
  const migrationDirectory = join(process.cwd(), 'db', 'migrations')
  const migrationFiles = (await readdir(migrationDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  await query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())')
  for (const file of migrationFiles) {
    const version = file.replace(/\.sql$/, '')
    const applied = await query<{ version: string }>('SELECT version FROM schema_migrations WHERE version = $1', [version])
    if (applied.rows.length) {
      console.log(`Migration ${version} already applied`)
      continue
    }
    const migration = await readFile(join(migrationDirectory, file), 'utf8')
    await withTransaction(async (client) => {
      await client.query(migration)
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version])
    })
    console.log(`Applied migration ${version}`)
  }
}

main().catch((error) => {
  console.error('Migration failed:', error instanceof Error ? error.message : 'Unknown error')
  process.exitCode = 1
})
