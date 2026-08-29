CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_category_league_number_unique
  ON leagues (category_id, league_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_champion_spotlights_league_unique
  ON champion_spotlights (league_id);
