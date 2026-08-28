import { describe, expect, it } from 'vitest'

describe('live integration prerequisites', () => {
  it.skipIf(!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('your-'))('requires configured PostgreSQL credentials', () => {
    expect(process.env.DATABASE_URL).toMatch(/^postgres(?:ql)?:\/\//)
  })

  it.skipIf(!process.env.DODO_PAYMENTS_API_KEY || !process.env.DODO_WEBHOOK_SECRET || process.env.DODO_PAYMENTS_API_KEY.includes('your-'))('requires Dodo test credentials', () => {
    expect(process.env.DODO_PAYMENTS_API_KEY).toBeTruthy()
    expect(process.env.DODO_WEBHOOK_SECRET).toBeTruthy()
    expect(process.env.DODO_PAYMENTS_ENVIRONMENT).toBe('test_mode')
  })
})
