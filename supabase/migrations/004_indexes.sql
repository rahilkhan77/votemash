-- Indexes for performance optimization

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- Participants indexes
CREATE INDEX IF NOT EXISTS idx_participants_slug ON participants(slug);
CREATE INDEX IF NOT EXISTS idx_participants_category_id ON participants(category_id);
CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status);
CREATE INDEX IF NOT EXISTS idx_participants_owner_id ON participants(owner_id);

-- Participant Stats indexes
CREATE INDEX IF NOT EXISTS idx_participant_stats_participant_id_league_id ON participant_stats(participant_id, league_id);
CREATE INDEX IF NOT EXISTS idx_participant_stats_league_id_rating ON participant_stats(league_id, rating DESC);

-- Battles indexes
CREATE INDEX IF NOT EXISTS idx_battles_league_id ON battles(league_id);
CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status);
CREATE INDEX IF NOT EXISTS idx_battles_participant_a_id ON battles(participant_a_id);
CREATE INDEX IF NOT EXISTS idx_battles_participant_b_id ON battles(participant_b_id);

-- Votes indexes
CREATE INDEX IF NOT EXISTS idx_votes_battle_id ON votes(battle_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_token_hash ON votes(voter_token_hash);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);
-- This index supports duplicate vote protection
CREATE INDEX IF NOT EXISTS idx_votes_battle_voter ON votes(battle_id, voter_token_hash);

-- Battle Results indexes
CREATE INDEX IF NOT EXISTS idx_battle_results_battle_id ON battle_results(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_results_winner_id ON battle_results(winner_id);

-- League Qualifications indexes
CREATE INDEX IF NOT EXISTS idx_league_qualifications_source_league_id ON league_qualifications(source_league_id);
CREATE INDEX IF NOT EXISTS idx_league_qualifications_participant_id ON league_qualifications(participant_id);

-- Leagues indexes
CREATE INDEX IF NOT EXISTS idx_leagues_category_id ON leagues(category_id);
CREATE INDEX IF NOT EXISTS idx_leagues_status ON leagues(status);
CREATE INDEX IF NOT EXISTS idx_leagues_end_at ON leagues(end_at);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_stripe_checkout_session_id ON payments(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_participant_id ON payments(participant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Champion Spotlights indexes
CREATE INDEX IF NOT EXISTS idx_champion_spotlights_league_id ON champion_spotlights(league_id);
CREATE INDEX IF NOT EXISTS idx_champion_spotlights_ends_at ON champion_spotlights(ends_at);
CREATE INDEX IF NOT EXISTS idx_champion_spotlights_status ON champion_spotlights(status);

-- Abuse Events indexes
CREATE INDEX IF NOT EXISTS idx_abuse_events_created_at ON abuse_events(created_at);
CREATE INDEX IF NOT EXISTS idx_abuse_events_voter_token_hash ON abuse_events(voter_token_hash);
