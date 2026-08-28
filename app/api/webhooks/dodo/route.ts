import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getDodoClient } from '@/lib/payments/dodo'
import { activateParticipantInCurrentLeague } from '@/lib/leagues/lifecycle'

export async function POST(request: Request) {
  const webhookId = request.headers.get('webhook-id')
  const signature = request.headers.get('webhook-signature')
  const timestamp = request.headers.get('webhook-timestamp')
  if (!webhookId || !signature || !timestamp) return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 })

  const rawBody = await request.text()
  let event: any
  try {
    event = await getDodoClient().webhooks.unwrap(rawBody, { headers: { 'webhook-id': webhookId, 'webhook-signature': signature, 'webhook-timestamp': timestamp } })
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin() as any
  const { error: eventError } = await supabase.from('payment_events').insert({ provider: 'dodo', event_id: webhookId })
  if (eventError?.code === '23505') return NextResponse.json({ received: true, duplicate: true })
  if (eventError) return NextResponse.json({ error: 'Could not record webhook' }, { status: 500 })

  const payment = event?.data || {}
  if (event?.type === 'payment.succeeded') {
    const participantId = payment.metadata?.participant_id
    const amount = Number(payment.amount)
    const currency = String(payment.currency || 'USD').toUpperCase()
    if (!participantId || !Number.isFinite(amount)) return NextResponse.json({ received: true })

    const { data: pending } = await supabase.from('payments').select('id, participant_id, amount, currency').eq('provider', 'dodo').eq('participant_id', participantId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!pending || pending.amount !== amount || pending.currency.toUpperCase() !== currency) return NextResponse.json({ error: 'Payment context mismatch' }, { status: 400 })

    const { error: paidError } = await supabase.from('payments').update({ status: 'paid', provider_payment_id: payment.payment_id, completed_at: new Date().toISOString() }).eq('id', pending.id).eq('status', 'pending')
    if (!paidError) {
      await supabase.from('pricing_reservations').update({ status: 'consumed' }).eq('participant_id', participantId).eq('status', 'reserved')
      await supabase.from('participants').update({ status: 'active' }).eq('id', participantId).eq('status', 'pending')
      const { data: participant } = await supabase.from('participants').select('category_id').eq('id', participantId).single()
      if (participant) await activateParticipantInCurrentLeague(participantId, participant.category_id)
    }
  } else if (event?.type === 'payment.failed' || event?.type === 'payment.cancelled') {
    const participantId = payment.metadata?.participant_id
    if (participantId) await supabase.from('payments').update({ status: event.type === 'payment.failed' ? 'failed' : 'cancelled' }).eq('provider', 'dodo').eq('participant_id', participantId).eq('status', 'pending')
  }

  return NextResponse.json({ received: true })
}
