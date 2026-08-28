import { NextRequest, NextResponse } from 'next/server'
import { query, withTransaction } from '@/lib/db/client'
import { ParticipantInputSchema } from '@/lib/validation/schemas'
import { getParticipantPrice } from '@/lib/participants/pricing'
import { activateParticipantInCurrentLeague } from '@/lib/leagues/lifecycle'
import { createDodoCheckout } from '@/lib/payments/dodo'

export async function POST(request: NextRequest) {
  const parsed = ParticipantInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid participant data' } }, { status: 400 })
  const input = parsed.data
  const category = await query<{ id: string }>('SELECT id FROM categories WHERE id::text = $1 OR slug = $1 LIMIT 1', [input.categoryId])
  if (!category.rows[0]) return NextResponse.json({ success: false, error: { code: 'INVALID_CATEGORY', message: 'Category not found' } }, { status: 400 })
  const slug = `${input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`
  const participant = await withTransaction(async (client) => {
    const created = await client.query<{ id: string; slug: string; status: string }>('INSERT INTO participants (name, slug, type, category_id, description, website_url, logo_url, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, slug, status', [input.name, slug, input.type, category.rows[0].id, input.description, input.websiteUrl || null, input.logoUrl || null, 'pending'])
    const count = await client.query<{ count: string }>("SELECT count(*) FROM participants WHERE status = 'active'")
    const reservation = getParticipantPrice(Number(count.rows[0].count))
    await client.query('INSERT INTO pricing_reservations (participant_id, pricing_tier, amount, status, expires_at) VALUES ($1,$2,$3,$4,now() + interval \'24 hours\')', [created.rows[0].id, reservation.tier, reservation.amount, reservation.amount === 0 ? 'consumed' : 'reserved'])
    return { participant: created.rows[0], price: reservation }
  })
  if (participant.price.amount === 0) {
    await query("UPDATE participants SET status = 'active', updated_at = now() WHERE id = $1 AND status = 'pending'", [participant.participant.id])
    await activateParticipantInCurrentLeague(participant.participant.id, category.rows[0].id)
    return NextResponse.json({ success: true, data: participant })
  }
  try {
    const session = await createDodoCheckout({ participantId: participant.participant.id, amount: participant.price.amount, pricingTier: participant.price.tier as 'early_access' | 'standard' })
    await query('INSERT INTO payments (participant_id, provider, provider_checkout_id, amount, currency, pricing_tier, status) VALUES ($1,$2,$3,$4,$5,$6,$7)', [participant.participant.id, 'dodo', session.session_id, participant.price.amount, 'USD', participant.price.tier, 'pending'])
    return NextResponse.json({ success: true, data: { ...participant, checkoutUrl: session.checkout_url } })
  } catch (error) {
    console.error('Could not create checkout:', error)
    return NextResponse.json({ success: false, error: { code: 'PAYMENT_SETUP_FAILED', message: 'Could not create checkout' } }, { status: 500 })
  }
}
