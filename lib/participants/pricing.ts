export type PricingTier = 'free' | 'early_access' | 'standard'

export type ParticipantPrice = {
  tier: PricingTier
  amount: number
  label: string
}

export function getParticipantPrice(existingCount: number): ParticipantPrice {
  if (existingCount < 10) return { tier: 'free', amount: 0, label: 'Free' }
  if (existingCount < 60) return { tier: 'early_access', amount: 500, label: '$5' }
  return { tier: 'standard', amount: 900, label: '$9' }
}
