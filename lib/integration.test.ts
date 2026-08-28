import { describe, expect, it } from 'vitest'

describe('live integration prerequisites', () => {
  it.skipIf(!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project'))('requires configured Supabase test credentials', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toMatch(/^https:\/\//)
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy()
  })

  it.skipIf(!process.env.DODO_PAYMENTS_API_KEY || !process.env.DODO_WEBHOOK_SECRET || process.env.DODO_PAYMENTS_API_KEY.includes('your-'))('requires Dodo test credentials', () => {
    expect(process.env.DODO_PAYMENTS_API_KEY).toBeTruthy()
    expect(process.env.DODO_WEBHOOK_SECRET).toBeTruthy()
    expect(process.env.DODO_PAYMENTS_ENVIRONMENT).toBe('test_mode')
  })
})
