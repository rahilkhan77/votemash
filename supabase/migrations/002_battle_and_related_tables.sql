-- Participant Stats table (Elo ratings, wins/losses per league)
CREATE TABLE IF NOT EXISTS participant_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  rating INTEGER DEFAULT 1500,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  battle_count INTEGER DEFAULT 0,
  votes_received INTEGER DEFAULT 0,
  win_rate DECIMAL(5, 2) DEFAULT 0.00,
  previous_rank INTEGER,
  current_rank INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(participant_id, league_id)
);

-- Battles table
CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  participant_a_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  participant_b_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  votes_a INTEGER DEFAULT 0,
  votes_b INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  winner_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT different_participants CHECK (participant_a_id != participant_b_id)
);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  selected_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  voter_token_hash VARCHAR(255) NOT NULL,
  ip_hash VARCHAR(255),
  user_agent_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(battle_id, voter_token_hash)
);

-- Battle Results table (final results after battle completion)
CREATE TABLE IF NOT EXISTS battle_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID UNIQUE NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  winner_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  loser_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  votes_a INTEGER NOT NULL,
  votes_b INTEGER NOT NULL,
  percentage_a DECIMAL(5, 2) NOT NULL,
  percentage_b DECIMAL(5, 2) NOT NULL,
  rating_change_a INTEGER NOT NULL DEFAULT 0,
  rating_change_b INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- League Qualifications table (top 3 participants qualify for global league)
CREATE TABLE IF NOT EXISTS league_qualifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  qualified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_league_id, participant_id)
);

-- Champion Spotlight table
CREATE TABLE IF NOT EXISTS champion_spotlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'expired')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Abuse Events table
CREATE TABLE IF NOT EXISTS abuse_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID REFERENCES battles(id) ON DELETE SET NULL,
  voter_token_hash VARCHAR(255),
  ip_hash VARCHAR(255),
  event_type VARCHAR(50) CHECK (event_type IN ('suspicious_voting_rate', 'duplicate_attempt', 'invalid_request', 'rate_limit_exceeded')),
  risk_score INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
