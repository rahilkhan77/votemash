import { describe, expect, it } from 'vitest'
import { calculateEloChange, determineWinner } from './elo'

describe('Elo', () => {
  it('awards the winner and penalizes the loser', () => {
    const result = calculateEloChange(1500, 1500, 1)
    expect(result.ratingChangeA).toBeGreaterThan(0)
    expect(result.ratingChangeB).toBeLessThan(0)
    expect(result.newRatingA).toBe(1516)
    expect(result.newRatingB).toBe(1484)
  })

  it('is zero-sum for a tie', () => {
    const result = calculateEloChange(1500, 1500, determineWinner(5, 5))
    expect(result.ratingChangeA).toBe(0)
    expect(result.ratingChangeB).toBe(0)
  })
})
