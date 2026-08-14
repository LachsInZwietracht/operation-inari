-- ============================================================================
-- Record what was eaten *instead of* a planned meal.
--
-- Until now a plan entry could be ticked or skipped, and a skip said only that
-- something did not happen. What the counselor actually wants to know is what
-- happened in its place — "statt Linsensuppe: Döner" is the line a session
-- starts from, and today that information is thrown away twice over: the diary
-- row and the skipped plan entry sit in the same day with nothing connecting
-- them.
--
-- One nullable column does it. A diary entry may point at the plan entry it
-- replaced; everything else about it stays a perfectly ordinary logged food,
-- which is what keeps the totals, the micronutrients and the counselor's views
-- from needing to know this exists at all.
--
-- Note what is NOT modelled here: the plan entry is still marked skipped, the
-- same as before. The replacement is additional evidence, not a third state —
-- adherence arithmetic is untouched.
-- ============================================================================

ALTER TABLE client_food_log_entries
  ADD COLUMN IF NOT EXISTS replaces_meal_entry_id UUID
    REFERENCES meal_entries(id) ON DELETE SET NULL;

COMMENT ON COLUMN client_food_log_entries.replaces_meal_entry_id IS
  'The planned meal entry this was eaten instead of, when the client answered a plan row with "anders gegessen". NULL for ordinary entries.';

-- Looked up per day, alongside the plan, to render a replacement in the place
-- of the row it stands in for.
CREATE INDEX IF NOT EXISTS client_food_log_entries_replaces_idx
  ON client_food_log_entries(replaces_meal_entry_id)
  WHERE replaces_meal_entry_id IS NOT NULL;
