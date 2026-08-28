-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE champion_spotlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_league_joins ENABLE ROW LEVEL SECURITY;

-- PROFILES - Users can only see public profile info
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT
  USING (true);

-- CATEGORIES - Public read-only
CREATE POLICY "Categories are viewable by everyone" ON categories
  FOR SELECT
  USING (true);

-- PARTICIPANTS - Public read, server-side write only
CREATE POLICY "Participants are viewable by everyone" ON participants
  FOR SELECT
  USING (status = 'active');

-- LEAGUES - Public read-only
CREATE POLICY "Leagues are viewable by everyone" ON leagues
  FOR SELECT
  USING (true);

-- PARTICIPANT_STATS - Public read-only (leaderboard data)
CREATE POLICY "Participant stats are viewable by everyone" ON participant_stats
  FOR SELECT
  USING (true);

-- BATTLES - Public read
CREATE POLICY "Battles are viewable by everyone" ON battles
  FOR SELECT
  USING (true);

-- VOTES - no client read or write access; the server-only RPC handles writes.
CREATE POLICY "Users can view vote counts only" ON votes
  FOR SELECT
  USING (false);  -- Don't expose individual votes

-- BATTLE_RESULTS - Public read-only
CREATE POLICY "Battle results are viewable by everyone" ON battle_results
  FOR SELECT
  USING (true);

-- LEAGUE_QUALIFICATIONS - Public read
CREATE POLICY "League qualifications are viewable by everyone" ON league_qualifications
  FOR SELECT
  USING (true);

-- CHAMPION_SPOTLIGHTS - Public read
CREATE POLICY "Champion spotlights are viewable by everyone" ON champion_spotlights
  FOR SELECT
  USING (true);

-- PAYMENTS - Users can only view their own payments
CREATE POLICY "Users can view their own payments" ON payments
  FOR SELECT
  USING (auth.uid() = participant_id OR auth.role() = 'service_role');

-- ABUSE_EVENTS - Service role only
CREATE POLICY "Abuse events are service role only" ON abuse_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- PARTICIPANT_LEAGUE_JOINS - Public read
CREATE POLICY "Participant league joins are viewable by everyone" ON participant_league_joins
  FOR SELECT
  USING (true);

-- Note: All write operations for data integrity (creating battles, updating stats, etc.)
-- should happen through API endpoints that perform server-side validation, not through direct RLS policies.
-- This ensures business logic is enforced and data consistency is maintained.
