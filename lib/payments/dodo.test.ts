import { describe, expect, it } from 'vitest'
import { Webhook } from 'standardwebhooks'

describe('Dodo webhook signatures', () => {
  const secret = Buffer.from('test-webhook-secret').toString('base64')
  const payload = JSON.stringify({ type: 'payment.succeeded', data: { payment_id: 'pay_test' } })
  const id = 'msg_test_1'
  const timestamp = new Date()

  it('accepts a valid Standard Webhooks signature', async () => {
    const webhook = new Webhook(secret)
    const signature = webhook.sign(id, timestamp, payload)
    expect(() => webhook.verify(payload, { 'webhook-id': id, 'webhook-timestamp': Math.floor(timestamp.getTime() / 1000).toString(), 'webhook-signature': signature })).not.toThrow()
  })

  it('rejects a tampered payload', async () => {
    const webhook = new Webhook(secret)
    const signature = webhook.sign(id, timestamp, payload)
    expect(() => webhook.verify(`${payload} `, { 'webhook-id': id, 'webhook-timestamp': Math.floor(timestamp.getTime() / 1000).toString(), 'webhook-signature': signature })).toThrow()
  })
})
