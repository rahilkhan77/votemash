-- Finalize a battle atomically. The row lock and unique result key prevent
-- concurrent workers from applying Elo more than once.
CREATE OR REPLACE FUNCTION finalize_battle(p_battle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked_battle battles%ROWTYPE;
  stats_a participant_stats%ROWTYPE;
  stats_b participant_stats%ROWTYPE;
  expected_a NUMERIC;
  score_a NUMERIC;
  change_a INTEGER;
  change_b INTEGER;
  winner UUID;
  loser UUID;
  total INTEGER;
BEGIN
  SELECT * INTO locked_battle FROM battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'battle_not_found' USING ERRCODE = 'P0002'; END IF;

  IF EXISTS (SELECT 1 FROM battle_results WHERE battle_id = p_battle_id) THEN
    RETURN jsonb_build_object('success', true, 'already_finalized', true);
  END IF;

  SELECT * INTO stats_a FROM participant_stats
    WHERE league_id = locked_battle.league_id AND participant_id = locked_battle.participant_a_id FOR UPDATE;
  SELECT * INTO stats_b FROM participant_stats
    WHERE league_id = locked_battle.league_id AND participant_id = locked_battle.participant_b_id FOR UPDATE;
  IF NOT FOUND OR stats_a.id IS NULL OR stats_b.id IS NULL THEN
    RAISE EXCEPTION 'participant_stats_not_found' USING ERRCODE = 'P0002';
  END IF;

  total := locked_battle.votes_a + locked_battle.votes_b;
  score_a := CASE WHEN locked_battle.votes_a > locked_battle.votes_b THEN 1 WHEN locked_battle.votes_a = locked_battle.votes_b THEN 0.5 ELSE 0 END;
  expected_a := 1 / (1 + power(10, (stats_b.rating - stats_a.rating) / 400.0));
  change_a := round(32 * (score_a - expected_a));
  change_b := -change_a;
  winner := CASE WHEN score_a = 1 THEN locked_battle.participant_a_id WHEN score_a = 0 THEN locked_battle.participant_b_id ELSE NULL END;
  loser := CASE WHEN score_a = 1 THEN locked_battle.participant_b_id WHEN score_a = 0 THEN locked_battle.participant_a_id ELSE NULL END;

  UPDATE participant_stats SET rating = rating + change_a, wins = wins + CASE WHEN score_a = 1 THEN 1 ELSE 0 END, losses = losses + CASE WHEN score_a = 0 THEN 1 ELSE 0 END, battle_count = battle_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = stats_a.id;
  UPDATE participant_stats SET rating = rating + change_b, wins = wins + CASE WHEN score_a = 0 THEN 1 ELSE 0 END, losses = losses + CASE WHEN score_a = 1 THEN 1 ELSE 0 END, battle_count = battle_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = stats_b.id;

  INSERT INTO battle_results (battle_id, winner_id, loser_id, votes_a, votes_b, percentage_a, percentage_b, rating_change_a, rating_change_b)
  VALUES (p_battle_id, winner, loser, locked_battle.votes_a, locked_battle.votes_b, CASE WHEN total = 0 THEN 50 ELSE locked_battle.votes_a * 100.0 / total END, CASE WHEN total = 0 THEN 50 ELSE locked_battle.votes_b * 100.0 / total END, change_a, change_b);

  UPDATE battles SET status = 'completed', winner_id = winner, ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = p_battle_id;
  RETURN jsonb_build_object('success', true, 'already_finalized', false, 'winner_id', winner, 'rating_change_a', change_a, 'rating_change_b', change_b);
END;
$$;

REVOKE ALL ON FUNCTION finalize_battle(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_battle(UUID) TO service_role;
