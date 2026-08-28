/**
 * Rate limiting contract.
 *
 * No provider is configured in this repository. Do not implement this with a
 * process-local Map in production because serverless instances do not share
 * state. Wire this contract to a distributed provider before deployment.
 */
export interface RateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }>
}

export function requireDistributedRateLimiter(rateLimiter: RateLimiter | undefined): RateLimiter {
  if (!rateLimiter) {
    throw new Error('A distributed rate limiter must be configured before production deployment')
  }
  return rateLimiter
}
