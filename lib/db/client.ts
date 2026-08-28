import { Pool, type PoolClient, type QueryResultRow } from 'pg'

let pool: Pool | undefined

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('Missing required environment variable: DATABASE_URL')
    pool = new Pool({ connectionString, max: 10, ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false } })
  }
  return pool
}

export function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values)
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505')
}
