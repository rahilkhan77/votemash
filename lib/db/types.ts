/**
 * Database type definitions for VoteMash
 */

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type ParticipantStatus = 'pending' | 'active' | 'rejected' | 'inactive';
export type ParticipantType = 'website' | 'app' | 'startup' | 'ai_tool' | 'developer_tool' | 'product' | 'game' | 'design' | 'brand' | 'other';

export type Participant = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  type: ParticipantType;
  category_id: string;
  owner_id: string | null;
  status: ParticipantStatus;
  created_at: string;
  updated_at: string;
};

export type LeagueType = 'category' | 'global';
export type LeagueStatus = 'scheduled' | 'active' | 'completed';

export type League = {
  id: string;
  category_id: string | null;
  type: LeagueType;
  start_at: string;
  end_at: string;
  status: LeagueStatus;
  league_number: number;
  created_at: string;
  completed_at: string | null;
};

export type ParticipantStats = {
  id: string;
  participant_id: string;
  league_id: string;
  rating: number;
  wins: number;
  losses: number;
  battle_count: number;
  votes_received: number;
  win_rate: number;
  previous_rank: number | null;
  current_rank: number;
  created_at: string;
  updated_at: string;
};

export type BattleStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export type Battle = {
  id: string;
  league_id: string;
  participant_a_id: string;
  participant_b_id: string;
  status: BattleStatus;
  votes_a: number;
  votes_b: number;
  total_votes: number;
  winner_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Vote = {
  id: string;
  battle_id: string;
  selected_participant_id: string;
  voter_token_hash: string;
  ip_hash: string | null;
  user_agent_hash: string | null;
  created_at: string;
};

export type BattleResult = {
  id: string;
  battle_id: string;
  winner_id: string;
  loser_id: string;
  votes_a: number;
  votes_b: number;
  percentage_a: number;
  percentage_b: number;
  rating_change_a: number;
  rating_change_b: number;
  completed_at: string;
};

export type LeagueQualification = {
  id: string;
  source_league_id: string;
  participant_id: string;
  rank: number;
  qualified_at: string;
};

export type ChampionSpotlightStatus = 'scheduled' | 'active' | 'expired';

export type ChampionSpotlight = {
  id: string;
  league_id: string;
  participant_id: string;
  starts_at: string;
  ends_at: string;
  status: ChampionSpotlightStatus;
  created_at: string;
};

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
export type PricingTier = 'free' | 'early_access' | 'standard';

export type Payment = {
  id: string;
  participant_id: string | null;
  provider: 'dodo';
  provider_checkout_id: string;
  provider_payment_id: string | null;
  amount: number;
  currency: string;
  pricing_tier: PricingTier;
  status: PaymentStatus;
  created_at: string;
  completed_at: string | null;
};

export type AbuseEventType = 'suspicious_voting_rate' | 'duplicate_attempt' | 'invalid_request' | 'rate_limit_exceeded';

export type AbuseEvent = {
  id: string;
  battle_id: string | null;
  voter_token_hash: string | null;
  ip_hash: string | null;
  event_type: AbuseEventType;
  risk_score: number;
  metadata: Record<string, any> | null;
  created_at: string;
};
