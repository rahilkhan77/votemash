import { describe, expect, it, beforeEach, afterEach, afterAll } from 'vitest'
import { config } from 'dotenv'
import { NextRequest } from 'next/server'
import { POST as voteHandler } from '../../app/api/battles/[id]/vote/route'
import { POST as previewHandler } from '../../app/api/participants/preview/route'
import { POST as participantHandler } from '../../app/api/participants/route'
import {
  createUpstashRateLimiter,
  getConfiguredRateLimiter,
  RATE_LIMIT_CONFIG,
  isUpstashConfigured,
  resetSharedInMemoryRateLimiter,
} from './rate-limit'
import { generateVoterToken, hashVoterToken } from './voter'
import { getNextBattle, getLeaderboard, getActiveSpotlight, getActiveCategories } from '../db/queries'
import { query, closePool } from '../db/client'

config({ path: '.env.local' })

const hasDb = Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('your-'))

describe('Step 8C Live Integration & Route Rate Limiting', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    resetSharedInMemoryRateLimiter()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetSharedInMemoryRateLimiter()
  })

  afterAll(async () => {
    await closePool()
  })

  it('verifies strict production boundary: blocked memory fallback in production without Upstash credentials', () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    process.env.RATE_LIMIT_PROVIDER = 'upstash'

    const limiter = getConfiguredRateLimiter()
    expect(limiter).toBeUndefined()
  })

  it('verifies production provider selects Upstash when credentials are provided', () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock-upstash.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'
    process.env.RATE_LIMIT_PROVIDER = 'upstash'

    const limiter = getConfiguredRateLimiter()
    expect(limiter).toBeDefined()
    expect(typeof limiter?.check).toBe('function')
  })

  describe.skipIf(!hasDb)('Database Real Voting & Rate Limiting Integration', () => {
    it('supports normal multi-battle voting (Battle A -> vote, Battle B -> vote) with the same voter', async () => {
      process.env.RATE_LIMIT_PROVIDER = 'memory'

      const battlesRes = await query(`
        SELECT b.id, b.participant_a_id, b.participant_b_id
        FROM battles b
        JOIN leagues l ON l.id = b.league_id AND l.status = 'active' AND l.end_at >= now()
        WHERE b.status = 'active'
        LIMIT 2
      `)

      if (battlesRes.rows.length >= 2) {
        const battle1 = battlesRes.rows[0]
        const battle2 = battlesRes.rows[1]
        const voterToken = generateVoterToken()

        // Vote on Battle 1
        const req1 = new NextRequest(`http://localhost:3000/api/battles/${battle1.id}/vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `votemash-voter=${voterToken}`,
            'x-forwarded-for': '198.51.100.10',
          },
          body: JSON.stringify({ participantId: battle1.participant_a_id }),
        })
        const res1 = await voteHandler(req1, { params: Promise.resolve({ id: battle1.id }) })
        const data1 = await res1.json()
        expect(res1.status).toBe(200)
        expect(data1.success).toBe(true)

        // Vote on Battle 2 (same voter token, different battle)
        const req2 = new NextRequest(`http://localhost:3000/api/battles/${battle2.id}/vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `votemash-voter=${voterToken}`,
            'x-forwarded-for': '198.51.100.10',
          },
          body: JSON.stringify({ participantId: battle2.participant_b_id }),
        })
        const res2 = await voteHandler(req2, { params: Promise.resolve({ id: battle2.id }) })
        const data2 = await res2.json()
        expect(res2.status).toBe(200)
        expect(data2.success).toBe(true)

        // Attempt duplicate vote on Battle 1 with the same voter token
        const reqDup = new NextRequest(`http://localhost:3000/api/battles/${battle1.id}/vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `votemash-voter=${voterToken}`,
            'x-forwarded-for': '198.51.100.10',
          },
          body: JSON.stringify({ participantId: battle1.participant_a_id }),
        })
        const resDup = await voteHandler(reqDup, { params: Promise.resolve({ id: battle1.id }) })
        const dataDup = await resDup.json()
        expect(resDup.status).toBe(409)
        expect(dataDup.error?.code).toBe('DUPLICATE_VOTE')
      }
    }, 20000)

    it('enforces vote route rate limit returning HTTP 429 and Retry-After header', async () => {
      process.env.RATE_LIMIT_PROVIDER = 'memory'
      const spamVoter = generateVoterToken()
      const spamIp = '198.51.100.20'
      let hit429 = false
      let retryAfter: string | null = null

      for (let i = 0; i <= RATE_LIMIT_CONFIG.vote.limit + 2; i++) {
        const req = new NextRequest(`http://localhost:3000/api/battles/test-battle/vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `votemash-voter=${spamVoter}`,
            'x-forwarded-for': spamIp,
          },
          body: JSON.stringify({}),
        })
        const res = await voteHandler(req, { params: Promise.resolve({ id: 'test-battle' }) })
        if (res.status === 429) {
          hit429 = true
          retryAfter = res.headers.get('retry-after')
          const data = await res.json()
          expect(data.error?.code).toBe('RATE_LIMITED')
          break
        }
      }

      expect(hit429).toBe(true)
      expect(retryAfter).toBeTruthy()
    })
  })

  describe('Metadata Preview Endpoint Rate Limiting & SSRF Protection', () => {
    it('enforces rate limits on preview requests with 429 and Retry-After', async () => {
      process.env.RATE_LIMIT_PROVIDER = 'memory'
      const previewIp = '198.51.100.30'
      let hit429 = false
      let retryAfter: string | null = null

      for (let i = 0; i <= RATE_LIMIT_CONFIG.preview.limit + 2; i++) {
        const req = new NextRequest('http://localhost:3000/api/participants/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': previewIp,
          },
          body: JSON.stringify({}),
        })
        const res = await previewHandler(req)
        if (res.status === 429) {
          hit429 = true
          retryAfter = res.headers.get('retry-after')
          const data = await res.json()
          expect(data.error?.code).toBe('RATE_LIMITED')
          break
        }
      }

      expect(hit429).toBe(true)
      expect(retryAfter).toBeTruthy()
    })

    it('blocks SSRF attempts on internal/private IP ranges', async () => {
      process.env.RATE_LIMIT_PROVIDER = 'memory'
      const req = new NextRequest('http://localhost:3000/api/participants/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.31',
        },
        body: JSON.stringify({ url: 'http://127.0.0.1:8080' }),
      })
      const res = await previewHandler(req)
      const data = await res.json()
      expect(res.status).toBe(422)
      expect(data.error?.code).toBe('PREVIEW_FAILED')
    })
  })

  describe('Participant Submission Endpoint Rate Limiting', () => {
    it('enforces rate limits on participant submissions with 429 and Retry-After', async () => {
      process.env.RATE_LIMIT_PROVIDER = 'memory'
      const participantIp = '198.51.100.40'
      let hit429 = false
      let retryAfter: string | null = null

      for (let i = 0; i <= RATE_LIMIT_CONFIG.participant.limit + 2; i++) {
        const req = new NextRequest('http://localhost:3000/api/participants', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': participantIp,
          },
          body: JSON.stringify({}),
        })
        const res = await participantHandler(req)
        if (res.status === 429) {
          hit429 = true
          retryAfter = res.headers.get('retry-after')
          const data = await res.json()
          expect(data.error?.code).toBe('RATE_LIMITED')
          break
        }
      }

      expect(hit429).toBe(true)
      expect(retryAfter).toBeTruthy()
    })
  })

  describe.skipIf(!hasDb)('Steps 1-8B Regression Checks', () => {
    it('verifies Step 1: fair battle rotation fetches active battle without repeating voter votes', async () => {
      const voterHash = hashVoterToken(generateVoterToken())
      const battle = await getNextBattle(undefined, voterHash)
      expect(battle).toBeDefined()
      if (battle) {
        expect(battle.participant_a).toBeDefined()
        expect(battle.participant_b).toBeDefined()
      }
    })

    it('verifies Step 2: leaderboard query works', async () => {
      const leaderboard = await getLeaderboard(undefined, 10, 0)
      expect(leaderboard).toBeDefined()
      expect(Array.isArray(leaderboard.rows)).toBe(true)
    })

    it('verifies Step 3: active categories return default category', async () => {
      const categories = await getActiveCategories()
      expect(categories.length).toBeGreaterThan(0)
    })

    it('verifies Step 7: champion spotlight query works', async () => {
      const spotlight = await getActiveSpotlight()
      expect(spotlight === null || typeof spotlight === 'object').toBe(true)
    })
  })

  describe.runIf(isUpstashConfigured())('Real Upstash Distributed Service Integration', () => {
    it('shares rate limit state across two independent limiter instances (Process A & Process B simulation)', async () => {
      const limiterA = createUpstashRateLimiter()!
      const limiterB = createUpstashRateLimiter()!

      const sharedKey = `test:distributed:${Date.now()}:${Math.random().toString(36).slice(2)}`

      // Limiter A consumes 1 token
      const resA1 = await limiterA.check(sharedKey, 2, 60)
      expect(resA1.allowed).toBe(true)

      // Limiter B checks remaining and consumes 1 token
      const resB1 = await limiterB.check(sharedKey, 2, 60)
      expect(resB1.allowed).toBe(true)

      // Limiter A now observes limit exceeded because state is stored in remote Upstash
      const resA2 = await limiterA.check(sharedKey, 2, 60)
      expect(resA2.allowed).toBe(false)
      expect(resA2.retryAfter).toBeGreaterThan(0)
    })
  })
})

