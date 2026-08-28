CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  website_url TEXT,
  logo_url TEXT,
  type TEXT NOT NULL CHECK (type IN ('website','app','startup','ai_tool','developer_tool','product','game','design','brand','other')),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','inactive','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'category' CHECK (type IN ('category','global')),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','completed')),
  league_number INTEGER NOT NULL DEFAULT 1,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participant_league_joins (
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, league_id)
);

CREATE TABLE IF NOT EXISTS participant_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL DEFAULT 1500,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  battle_count INTEGER NOT NULL DEFAULT 0,
  votes_received INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  previous_rank INTEGER,
  current_rank INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, league_id)
);

CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  participant_a_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  participant_b_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','completed','cancelled')),
  votes_a INTEGER NOT NULL DEFAULT 0,
  votes_b INTEGER NOT NULL DEFAULT 0,
  total_votes INTEGER NOT NULL DEFAULT 0,
  winner_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (participant_a_id <> participant_b_id),
  UNIQUE (league_id, participant_a_id, participant_b_id)
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  selected_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  voter_token_hash TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (battle_id, voter_token_hash)
);

CREATE TABLE IF NOT EXISTS battle_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL UNIQUE REFERENCES battles(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  loser_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  votes_a INTEGER NOT NULL,
  votes_b INTEGER NOT NULL,
  percentage_a NUMERIC(5,2) NOT NULL,
  percentage_b NUMERIC(5,2) NOT NULL,
  rating_change_a INTEGER NOT NULL DEFAULT 0,
  rating_change_b INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  qualified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_league_id, participant_id)
);

CREATE TABLE IF NOT EXISTS champion_spotlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_checkout_id TEXT NOT NULL,
  provider_payment_id TEXT,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  pricing_tier TEXT NOT NULL CHECK (pricing_tier IN ('free','early_access','standard')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (provider, provider_checkout_id),
  UNIQUE (provider, provider_payment_id)
);

CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS pricing_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL UNIQUE REFERENCES participants(id) ON DELETE CASCADE,
  pricing_tier TEXT NOT NULL CHECK (pricing_tier IN ('free','early_access','standard')),
  amount INTEGER NOT NULL CHECK (amount IN (0,500,900)),
  status TEXT NOT NULL CHECK (status IN ('reserved','consumed','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS abuse_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID REFERENCES battles(id) ON DELETE SET NULL,
  voter_token_hash TEXT,
  ip_hash TEXT,
  event_type TEXT,
  risk_score INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_participants_category_status ON participants(category_id, status);
CREATE INDEX IF NOT EXISTS idx_leagues_active_category ON leagues(category_id, status, end_at);
CREATE INDEX IF NOT EXISTS idx_battles_active_league ON battles(league_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_token_hash, battle_id);
CREATE INDEX IF NOT EXISTS idx_stats_league_rating ON participant_stats(league_id, rating DESC, wins DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_lookup ON payment_events(provider, event_id);
CREATE INDEX IF NOT EXISTS idx_pricing_reservations_expiry ON pricing_reservations(status, expires_at);
