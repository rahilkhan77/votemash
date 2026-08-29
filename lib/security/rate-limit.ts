/**
 * Rate limiting contract.
 *
 * The runtime implementation is intentionally pluggable so the app can use a
 * serverless-safe distributed provider in production while keeping local/dev
 * behavior testable without inventing credentials.
 */
import { Duration, Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter?: number
  resetAt?: number
}

export interface RateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>
}

/**
 * Standard endpoint rate limit configurations.
 */
export const RATE_LIMIT_CONFIG = {
  vote: {
    limit: 60,
    windowSeconds: 60, // 60 votes per minute per voter/IP
  },
  preview: {
    limit: 10,
    windowSeconds: 60, // 10 preview fetches per minute per IP
  },
  participant: {
    limit: 5,
    windowSeconds: 60, // 5 participant submissions per minute per IP
  },
} as const

export function createInMemoryRateLimiter(): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>()

  return {
    async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
      const now = Date.now()
      const bucket = buckets.get(key)

      if (!bucket || bucket.resetAt <= now) {
        const resetAt = now + windowSeconds * 1000
        buckets.set(key, { count: 1, resetAt })
        return { allowed: true, remaining: Math.max(limit - 1, 0), resetAt }
      }

      if (bucket.count >= limit) {
        const retryAfter = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1)
        return { allowed: false, remaining: 0, retryAfter, resetAt: bucket.resetAt }
      }

      bucket.count += 1
      return { allowed: true, remaining: Math.max(limit - bucket.count, 0), resetAt: bucket.resetAt }
    },
  }
}

export function createUpstashRateLimiter(options?: { url?: string; token?: string }): RateLimiter | undefined {
  const url = (options?.url ?? process.env.UPSTASH_REDIS_REST_URL)?.trim()
  const token = (options?.token ?? process.env.UPSTASH_REDIS_REST_TOKEN)?.trim()

  if (!url || !token) return undefined

  const redis = new Redis({ url, token })
  const limiterMap = new Map<string, Ratelimit>()

  function getLimiter(limit: number, windowSeconds: number): Ratelimit {
    const cacheKey = `${limit}:${windowSeconds}`
    let limiter = limiterMap.get(cacheKey)
    if (!limiter) {
      const duration: Duration = `${windowSeconds} s`
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, duration),
        prefix: 'votemash',
        analytics: false,
      })
      limiterMap.set(cacheKey, limiter)
    }
    return limiter
  }

  return {
    async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
      try {
        const limiter = getLimiter(limit, windowSeconds)
        const result = await limiter.limit(key)
        const resetAt = Number(result.reset) || Date.now() + windowSeconds * 1000
        const retryAfter = result.success ? undefined : Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1)
        return {
          allowed: result.success,
          remaining: Math.max(result.remaining ?? 0, 0),
          retryAfter,
          resetAt,
        }
      } catch (error) {
        // Safe logging without exposing credentials or internal tokens
        console.error('[RateLimiter] Distributed rate check failed:', error instanceof Error ? error.message : 'Unknown error')
        // In case of distributed backend failure, fail open safely
        return {
          allowed: true,
          remaining: 1,
          resetAt: Date.now() + windowSeconds * 1000,
        }
      }
    },
  }
}

export function getRateLimitKey(parts: Array<string | number | null | undefined>): string {
  return parts.filter((part) => part !== null && part !== undefined && part !== '').map(String).join(':')
}

export function isUpstashConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  return Boolean(url && token)
}

export function validateRateLimitConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  if (!process.env.UPSTASH_REDIS_REST_URL?.trim()) {
    missing.push('UPSTASH_REDIS_REST_URL')
  }
  if (!process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    missing.push('UPSTASH_REDIS_REST_TOKEN')
  }
  return {
    valid: missing.length === 0,
    missing,
  }
}

export function requireDistributedRateLimiter(rateLimiter: RateLimiter | undefined): RateLimiter {
  if (!rateLimiter) {
    const { missing } = validateRateLimitConfig()
    const missingInfo = missing.length > 0 ? ` Missing required environment variables: ${missing.join(', ')}` : ''
    throw new Error(`A distributed rate limiter must be configured before production deployment.${missingInfo}`)
  }
  return rateLimiter
}

let sharedInMemoryLimiter: RateLimiter | undefined

export function getSharedInMemoryRateLimiter(): RateLimiter {
  if (!sharedInMemoryLimiter) {
    sharedInMemoryLimiter = createInMemoryRateLimiter()
  }
  return sharedInMemoryLimiter
}

export function resetSharedInMemoryRateLimiter(): void {
  sharedInMemoryLimiter = undefined
}

export function getConfiguredRateLimiter(): RateLimiter | undefined {
  const isProd = process.env.NODE_ENV === 'production'
  const provider = process.env.RATE_LIMIT_PROVIDER?.trim().toLowerCase()

  // 1. Production Mode: MUST use real Upstash. Never silently fall back to in-memory store.
  if (isProd) {
    if (provider === 'off' || provider === 'disabled') {
      return undefined
    }

    const upstashLimiter = createUpstashRateLimiter()
    if (!upstashLimiter) {
      console.warn('[RateLimiter] Production environment detected without Upstash credentials. In-memory fallback is disabled in production.')
      return undefined
    }

    return upstashLimiter
  }

  // 2. Development / Test Mode:
  if (provider === 'off' || provider === 'disabled') {
    return undefined
  }

  if (provider === 'memory' || provider === 'local') {
    return getSharedInMemoryRateLimiter()
  }

  if (provider === 'upstash') {
    return createUpstashRateLimiter() ?? getSharedInMemoryRateLimiter()
  }

  // Default in dev/test when provider not explicitly configured
  if (isUpstashConfigured()) {
    return createUpstashRateLimiter()
  }

  return getSharedInMemoryRateLimiter()
}


