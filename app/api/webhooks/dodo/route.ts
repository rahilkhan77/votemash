import { NextResponse } from 'next/server'
import { getDodoClient } from '@/lib/payments/dodo'
import { query, isUniqueViolation, withTransaction } from '@/lib/db/client'
import { activateParticipantInCurrentLeague } from '@/lib/leagues/lifecycle'

export async function POST(request: Request) {
  const webhookId = request.headers.get('webhook-id')
  const signature = request.headers.get('webhook-signature')
  const timestamp = request.headers.get('webhook-timestamp')
  if (!webhookId || !signature || !timestamp) return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 })
  const rawBody = await request.text()
  let event: any
  try { event = await getDodoClient().webhooks.unwrap(rawBody, { headers: { 'webhook-id': webhookId, 'webhook-signature': signature, 'webhook-timestamp': timestamp } }) } catch { return NextResponse.json({ error: 'Invalid signature' }, { status: 401 }) }
  try { await query('INSERT INTO payment_events (provider, event_id) VALUES ($1,$2)', ['dodo', webhookId]) } catch (error) { if (isUniqueViolation(error)) return NextResponse.json({ received: true, duplicate: true }); throw error }
  const payment = event?.data || {}
  const participantId = payment.metadata?.participant_id
  if (participantId && event?.type === 'payment.succeeded') {
    const amount = Number(payment.amount)
    const pending = await query<{ id: string; amount: number; currency: string }>("SELECT id, amount, currency FROM payments WHERE provider = 'dodo' AND participant_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [participantId])
    if (!pending.rows[0] || pending.rows[0].amount !== amount || pending.rows[0].currency.toUpperCase() !== String(payment.currency || 'USD').toUpperCase()) return NextResponse.json({ error: 'Payment context mismatch' }, { status: 400 })
    await withTransaction(async (client) => {
      await client.query("UPDATE payments SET status = 'paid', provider_payment_id = $1, completed_at = now() WHERE id = $2 AND status = 'pending'", [payment.payment_id, pending.rows[0].id])
      await client.query("UPDATE pricing_reservations SET status = 'consumed' WHERE participant_id = $1 AND status = 'reserved'", [participantId])
      await client.query("UPDATE participants SET status = 'active', updated_at = now() WHERE id = $1 AND status = 'pending'", [participantId])
    })
    const participant = await query<{ category_id: string }>('SELECT category_id FROM participants WHERE id = $1', [participantId])
    if (participant.rows[0]) await activateParticipantInCurrentLeague(participantId, participant.rows[0].category_id)
  } else if (participantId && ['payment.failed', 'payment.cancelled'].includes(event?.type)) {
    await query("UPDATE payments SET status = $1 WHERE provider = 'dodo' AND participant_id = $2 AND status = 'pending'", [event.type === 'payment.failed' ? 'failed' : 'cancelled', participantId])
  }
  return NextResponse.json({ received: true })
}
