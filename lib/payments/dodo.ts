import DodoPayments from 'dodopayments'

export type DodoCheckoutRequest = {
  participantId: string
  amount: number
  pricingTier: 'early_access' | 'standard'
}

const TIER_AMOUNTS = { early_access: 500, standard: 900 } as const

export function getDodoClient() {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode'
  const webhookKey = process.env.DODO_WEBHOOK_SECRET
  if (!apiKey) throw new Error('DODO_PAYMENTS_API_KEY is not configured')
  return new DodoPayments({ bearerToken: apiKey, environment, webhookKey })
}

export async function createDodoCheckout(request: DodoCheckoutRequest) {
  if (request.amount !== TIER_AMOUNTS[request.pricingTier]) {
    throw new Error('Invalid server pricing tier amount')
  }
  const productId = request.pricingTier === 'early_access'
    ? process.env.DODO_PAYMENTS_PRODUCT_ID_5
    : process.env.DODO_PAYMENTS_PRODUCT_ID_9
  if (!productId) throw new Error(`DODO product for ${request.pricingTier} is not configured`)

  return getDodoClient().checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/enter?participant_id=${request.participantId}`,
    metadata: { participant_id: request.participantId, pricing_tier: request.pricingTier },
  } as any)
}
