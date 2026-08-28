/**
 * Elo rating system implementation
 * Follows standard chess Elo formula
 */

export const ELO_CONFIG = {
  INITIAL_RATING: 1500,
  K_FACTOR: 32, // Can be adjusted for volatility
};

interface EloCalculation {
  newRatingA: number;
  newRatingB: number;
  ratingChangeA: number;
  ratingChangeB: number;
  expectedScoreA: number;
  expectedScoreB: number;
}

/**
 * Calculate expected score for a player
 * Uses standard Elo formula: 1 / (1 + 10^((opponent_rating - player_rating) / 400))
 */
export function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Calculate new Elo ratings after a battle
 *
 * @param ratingA - Current rating of participant A
 * @param ratingB - Current rating of participant B
 * @param result - 1 if A wins, 0 if B wins, 0.5 if tie
 * @returns Object with new ratings and changes
 */
export function calculateEloChange(ratingA: number, ratingB: number, result: 0 | 0.5 | 1): EloCalculation {
  const expectedScoreA = calculateExpectedScore(ratingA, ratingB);
  const expectedScoreB = 1 - expectedScoreA;

  const actualScoreA = result;
  const actualScoreB = 1 - actualScoreA;

  const ratingChangeA = ELO_CONFIG.K_FACTOR * (actualScoreA - expectedScoreA);
  const ratingChangeB = ELO_CONFIG.K_FACTOR * (actualScoreB - expectedScoreB);

  return {
    newRatingA: Math.round(ratingA + ratingChangeA),
    newRatingB: Math.round(ratingB + ratingChangeB),
    ratingChangeA: Math.round(ratingChangeA),
    ratingChangeB: Math.round(ratingChangeB),
    expectedScoreA,
    expectedScoreB,
  };
}

/**
 * Determine winner based on vote count
 * Returns 1 if A wins, 0 if B wins, 0.5 if tie
 */
export function determineWinner(votesA: number, votesB: number): 0 | 0.5 | 1 {
  if (votesA > votesB) return 1;
  if (votesB > votesA) return 0;
  return 0.5; // Tie
}

/**
 * Resolve a tie using a tie-break rule
 * Higher rating wins tie
 */
export function resolveTiebreak(
  ratingA: number,
  ratingB: number,
  createdAtA: Date,
  createdAtB: Date
): 'A' | 'B' {
  if (ratingA > ratingB) return 'A';
  if (ratingB > ratingA) return 'B';

  // If ratings are equal, earlier participant wins (more seasoned)
  if (createdAtA < createdAtB) return 'A';
  return 'B';
}
