-- A tied battle has no winner or loser. Keep the result row while allowing
-- both identifiers to remain NULL.
ALTER TABLE battle_results ALTER COLUMN winner_id DROP NOT NULL;
ALTER TABLE battle_results ALTER COLUMN loser_id DROP NOT NULL;