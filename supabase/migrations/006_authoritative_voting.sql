-- Authoritative vote submission. The unique constraint and row lock make retries
-- and concurrent submissions safe without trusting client-supplied counters.
CREATE OR REPLACE FUNCTION submit_vote(
  p_battle_id UUID,
  p_participant_id UUID,
  p_voter_token_hash VARCHAR(255),
  p_ip_hash VARCHAR(255) DEFAULT NULL,
  p_user_agent_hash VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
  battle_id UUID,
  participant_a_id UUID,
  participant_b_id UUID,
  votes_a INTEGER,
  votes_b INTEGER,
  total_votes INTEGER,
  selected_participant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked_battle battles%ROWTYPE;
  updated_battle battles%ROWTYPE;
BEGIN
  SELECT * INTO locked_battle
  FROM battles
  WHERE id = p_battle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'battle_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF locked_battle.status <> 'active' THEN
    RAISE EXCEPTION 'battle_not_active' USING ERRCODE = 'P0001';
  END IF;

  IF p_participant_id NOT IN (locked_battle.participant_a_id, locked_battle.participant_b_id) THEN
    RAISE EXCEPTION 'invalid_participant' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO votes (battle_id, selected_participant_id, voter_token_hash, ip_hash, user_agent_hash)
  VALUES (p_battle_id, p_participant_id, p_voter_token_hash, p_ip_hash, p_user_agent_hash);

  UPDATE battles
  SET votes_a = votes_a + CASE WHEN p_participant_id = participant_a_id THEN 1 ELSE 0 END,
      votes_b = votes_b + CASE WHEN p_participant_id = participant_b_id THEN 1 ELSE 0 END,
      total_votes = total_votes + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_battle_id
  RETURNING * INTO updated_battle;

  RETURN QUERY SELECT updated_battle.id, updated_battle.participant_a_id,
    updated_battle.participant_b_id, updated_battle.votes_a, updated_battle.votes_b,
    updated_battle.total_votes, p_participant_id;
END;
$$;

REVOKE ALL ON FUNCTION submit_vote(UUID, UUID, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_vote(UUID, UUID, VARCHAR, VARCHAR, VARCHAR) TO service_role;
DROP POLICY IF EXISTS "Anyone can insert votes via API" ON votes;

-- Server-side RPC owns battle counter updates; clients cannot mutate them directly.
DROP POLICY IF EXISTS "Anyone can update battles" ON battles;
