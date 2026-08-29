import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  createInMemoryRateLimiter,
  createUpstashRateLimiter,
  getConfiguredRateLimiter,
  getRateLimitKey,
  isUpstashConfigured,
  requireDistributedRateLimiter,
  validateRateLimitConfig,
  RATE_LIMIT_CONFIG,
} from './rate-limit'

describe('Rate Limiter', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('In-Memory Rate Limiter', () => {
    it('allows requests within limit and decrements remaining', async () => {
      const limiter = createInMemoryRateLimiter()
      const key = getRateLimitKey(['vote', 'test-ip', 'token-1'])

      const first = await limiter.check(key, 3, 60)
      expect(first.allowed).toBe(true)
      expect(first.remaining).toBe(2)
      expect(first.retryAfter).toBeUndefined()

      const second = await limiter.check(key, 3, 60)
      expect(second.allowed).toBe(true)
      expect(second.remaining).toBe(1)

      const third = await limiter.check(key, 3, 60)
      expect(third.allowed).toBe(true)
      expect(third.remaining).toBe(0)
    })

    it('enforces limit and returns retryAfter when threshold is reached (HTTP 429 scenario)', async () => {
      const limiter = createInMemoryRateLimiter()
      const key = getRateLimitKey(['preview', 'test-ip'])

      // Consume allowance
      await limiter.check(key, 2, 60)
      await limiter.check(key, 2, 60)

      // Exceeded
      const blocked = await limiter.check(key, 2, 60)
      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
      expect(blocked.retryAfter).toBeGreaterThan(0)
      expect(blocked.retryAfter).toBeLessThanOrEqual(60)
    })

    it('isolates different keys independently', async () => {
      const limiter = createInMemoryRateLimiter()
      const keyA = getRateLimitKey(['vote', 'voter-a'])
      const keyB = getRateLimitKey(['vote', 'voter-b'])

      // Exhaust keyA
      await limiter.check(keyA, 1, 60)
      const blockedA = await limiter.check(keyA, 1, 60)
      expect(blockedA.allowed).toBe(false)

      // KeyB should still be allowed
      const allowedB = await limiter.check(keyB, 1, 60)
      expect(allowedB.allowed).toBe(true)
    })

    it('resets quota after rate limit window expires', async () => {
      const limiter = createInMemoryRateLimiter()
      const key = getRateLimitKey(['vote', 'voter-reset'])

      // Exhaust 1 token with 1 second window
      const first = await limiter.check(key, 1, 1)
      expect(first.allowed).toBe(true)

      const blocked = await limiter.check(key, 1, 1)
      expect(blocked.allowed).toBe(false)

      // Wait 1.1s for window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100))

      const restored = await limiter.check(key, 1, 1)
      expect(restored.allowed).toBe(true)
    })
  })

  describe('Key Generation', () => {
    it('creates structured rate limit keys safely filtering empty/null values', () => {
      expect(getRateLimitKey(['vote', 'ip-hash', 'token-hash'])).toBe('vote:ip-hash:token-hash')
      expect(getRateLimitKey(['preview', null, 'ip-hash', undefined, ''])).toBe('preview:ip-hash')
      expect(getRateLimitKey(['participant', 123])).toBe('participant:123')
    })
  })

  describe('Production Environment Provider Selection & Boundaries', () => {
    it('blocks in-memory fallback when NODE_ENV is production and credentials are missing', () => {
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      process.env.RATE_LIMIT_PROVIDER = 'upstash'

      const limiter = getConfiguredRateLimiter()
      // In production without Upstash credentials, must NOT silently fall back to in-memory limiter
      expect(limiter).toBeUndefined()
    })

    it('instantiates Upstash provider when credentials are provided in production', () => {
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
      process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash-url.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-test-token'
      process.env.RATE_LIMIT_PROVIDER = 'upstash'

      expect(isUpstashConfigured()).toBe(true)
      const limiter = getConfiguredRateLimiter()
      expect(limiter).toBeDefined()
      expect(typeof limiter?.check).toBe('function')
    })

    it('returns undefined when RATE_LIMIT_PROVIDER is explicitly off', () => {
      process.env.RATE_LIMIT_PROVIDER = 'off'
      expect(getConfiguredRateLimiter()).toBeUndefined()

      process.env.RATE_LIMIT_PROVIDER = 'disabled'
      expect(getConfiguredRateLimiter()).toBeUndefined()
    })

    it('allows in-memory rate limiter in development/test environment', () => {
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      process.env.RATE_LIMIT_PROVIDER = 'memory'

      const limiter = getConfiguredRateLimiter()
      expect(limiter).toBeDefined()
    })

    it('identifies missing rate limit variables in validateRateLimitConfig', () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      const check = validateRateLimitConfig()
      expect(check.valid).toBe(false)
      expect(check.missing).toContain('UPSTASH_REDIS_REST_URL')
      expect(check.missing).toContain('UPSTASH_REDIS_REST_TOKEN')
    })

    it('throws with identified missing variable names when requireDistributedRateLimiter is called without a limiter', () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      expect(() => requireDistributedRateLimiter(undefined)).toThrow(
        'A distributed rate limiter must be configured before production deployment. Missing required environment variables: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN'
      )
    })
  })

  describe('Upstash Rate Limiter Initializer', () => {
    it('returns undefined if credentials are missing', () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      expect(createUpstashRateLimiter()).toBeUndefined()
    })

    it('creates rate limiter with explicit credentials', () => {
      const limiter = createUpstashRateLimiter({
        url: 'https://fake-upstash-url.upstash.io',
        token: 'fake-token',
      })
      expect(limiter).toBeDefined()
      expect(typeof limiter?.check).toBe('function')
    })
  })

  describe('Endpoint Rate Limit Constants', () => {
    it('defines sensible limits for vote, preview, and participant routes', () => {
      expect(RATE_LIMIT_CONFIG.vote.limit).toBe(60)
      expect(RATE_LIMIT_CONFIG.vote.windowSeconds).toBe(60)

      expect(RATE_LIMIT_CONFIG.preview.limit).toBe(10)
      expect(RATE_LIMIT_CONFIG.preview.windowSeconds).toBe(60)

      expect(RATE_LIMIT_CONFIG.participant.limit).toBe(5)
      expect(RATE_LIMIT_CONFIG.participant.windowSeconds).toBe(60)
    })
  })
})

