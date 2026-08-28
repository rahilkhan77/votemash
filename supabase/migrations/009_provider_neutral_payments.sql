-- Provider-neutral payment records. Existing Stripe identifiers are retained as
-- renamed historical values, so migration does not discard payment history.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider VARCHAR(32) DEFAULT 'stripe';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_checkout_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(255);

UPDATE payments SET provider_checkout_id = stripe_checkout_session_id WHERE provider_checkout_id IS NULL;
UPDATE payments SET provider_payment_id = stripe_payment_intent_id WHERE provider_payment_id IS NULL;

ALTER TABLE payments ALTER COLUMN provider SET NOT NULL;
ALTER TABLE payments ALTER COLUMN provider_checkout_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN stripe_checkout_session_id DROP NOT NULL;

-- The legacy Stripe columns and index remain read-compatible for historical
-- records only; all new application writes use provider/provider_* columns.

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_checkout_id ON payments(provider, provider_checkout_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON payments(provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(32) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, event_id)
);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_payment_events_provider_event ON payment_events(provider, event_id);
