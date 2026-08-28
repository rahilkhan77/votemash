import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { ParticipantInputSchema } from '@/lib/validation/schemas'
import { getParticipantPrice } from '@/lib/participants/pricing'
import { activateParticipantInCurrentLeague } from '@/lib/leagues/lifecycle'
import { createDodoCheckout } from '@/lib/payments/dodo'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = ParticipantInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid participant data' } }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const input = parsed.data
  const { data: categoryData } = await supabase.from('categories').select('id').or(`id.eq.${input.categoryId},slug.eq.${input.categoryId}`).maybeSingle()
  const category = categoryData as { id: string } | null
  if (!category) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_CATEGORY', message: 'Category not found' } }, { status: 400 })
  }
  const slug = input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const { data: participantData, error } = await (supabase.from('participants') as any).insert({
    name: input.name,
    slug: `${slug}-${Date.now().toString(36)}`,
    type: input.type,
    category_id: category.id,
    description: input.description,
    website_url: input.websiteUrl || null,
    logo_url: input.logoUrl || null,
    status: 'pending',
  } as any).select('id, slug, status').single()

  const participant = participantData as { id: string; slug: string; status: string } | null

  if (error || !participant) {
    return NextResponse.json({ success: false, error: { code: 'CREATE_FAILED', message: 'Could not create participant' } }, { status: 500 })
  }

  const { data: reservationData, error: reservationError } = await (supabase as any).rpc('reserve_pricing_slot', { p_participant_id: participant.id })
  const reservation = reservationData?.[0] as { pricing_tier: 'free' | 'early_access' | 'standard'; amount: number } | undefined
  if (reservationError || !reservation) {
    await (supabase.from('participants') as any).delete().eq('id', participant.id).eq('status', 'pending')
    return NextResponse.json({ success: false, error: { code: 'PRICING_UNAVAILABLE', message: 'Could not reserve an entry slot' } }, { status: 503 })
  }
  const price = getParticipantPrice(reservation.amount === 0 ? 0 : reservation.pricing_tier === 'early_access' ? 10 : 60)

  if (price.amount === 0) {
    await (supabase.from('participants') as any).update({ status: 'active' }).eq('id', participant.id).eq('status', 'pending')
    await activateParticipantInCurrentLeague(participant.id, category.id)
    return NextResponse.json({ success: true, data: { participant, price } })
  }

  const session = await createDodoCheckout({ participantId: participant.id, amount: price.amount, pricingTier: price.tier as 'early_access' | 'standard' })

  const { error: paymentError } = await supabase.from('payments').insert({
    participant_id: participant.id,
    provider: 'dodo',
    provider_checkout_id: session.session_id,
    amount: price.amount,
    currency: 'USD',
    pricing_tier: price.tier,
    status: 'pending',
  } as any)

  if (paymentError || !session.checkout_url) {
    return NextResponse.json({ success: false, error: { code: 'PAYMENT_SETUP_FAILED', message: 'Could not create checkout' } }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { participant, price, checkoutUrl: session.checkout_url } })
}
