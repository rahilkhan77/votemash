-- Serialize launch pricing decisions without counting abandoned checkouts as successful.
CREATE TABLE IF NOT EXISTS pricing_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID NOT NULL UNIQUE REFERENCES participants(id) ON DELETE CASCADE,
  pricing_tier VARCHAR(50) NOT NULL CHECK (pricing_tier IN ('free', 'early_access', 'standard')),
  amount INTEGER NOT NULL CHECK (amount IN (0, 500, 900)),
  status VARCHAR(20) NOT NULL CHECK (status IN ('reserved', 'consumed', 'expired')),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pricing_lock (id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE));
INSERT INTO pricing_lock (id) VALUES (TRUE) ON CONFLICT DO NOTHING;

ALTER TABLE pricing_reservations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pricing_reservations_expiry ON pricing_reservations(status, expires_at);

CREATE OR REPLACE FUNCTION reserve_pricing_slot(p_participant_id UUID)
RETURNS TABLE (pricing_tier VARCHAR, amount INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  successful_count INTEGER;
  tier VARCHAR(50);
  price INTEGER;
BEGIN
  PERFORM id FROM pricing_lock WHERE id = TRUE FOR UPDATE;
  UPDATE pricing_reservations SET status = 'expired' WHERE status = 'reserved' AND expires_at < CURRENT_TIMESTAMP;

  SELECT COUNT(*) INTO successful_count FROM participants WHERE status = 'active';
  SELECT successful_count + COUNT(*) INTO successful_count
    FROM pricing_reservations WHERE status = 'reserved' AND expires_at >= CURRENT_TIMESTAMP;

  IF successful_count < 10 THEN tier := 'free'; price := 0;
  ELSIF successful_count < 60 THEN tier := 'early_access'; price := 500;
  ELSE tier := 'standard'; price := 900;
  END IF;

  INSERT INTO pricing_reservations (participant_id, pricing_tier, amount, status, expires_at)
  VALUES (p_participant_id, tier, price, CASE WHEN price = 0 THEN 'consumed' ELSE 'reserved' END, CURRENT_TIMESTAMP + INTERVAL '24 hours')
  ON CONFLICT (participant_id) DO UPDATE SET pricing_tier = EXCLUDED.pricing_tier, amount = EXCLUDED.amount, status = EXCLUDED.status, expires_at = EXCLUDED.expires_at;

  RETURN QUERY SELECT tier, price;
END;
$$;

REVOKE ALL ON FUNCTION reserve_pricing_slot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_pricing_slot(UUID) TO service_role;
