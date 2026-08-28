import { describe, expect, it } from 'vitest'
import { getParticipantPrice } from './pricing'

describe('participant pricing', () => {
  it('keeps the first ten entries free', () => {
    expect(getParticipantPrice(0).amount).toBe(0)
    expect(getParticipantPrice(9).amount).toBe(0)
  })

  it('charges five dollars for entries ten through fifty-nine', () => {
    expect(getParticipantPrice(10).amount).toBe(500)
    expect(getParticipantPrice(59).amount).toBe(500)
  })

  it('charges nine dollars from entry sixty onward', () => {
    expect(getParticipantPrice(60).amount).toBe(900)
    expect(getParticipantPrice(100).amount).toBe(900)
  })
})
