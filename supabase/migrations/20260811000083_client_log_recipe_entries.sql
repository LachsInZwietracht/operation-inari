-- ============================================================================
-- A recipe can be logged as itself.
--
-- The diary knew two kinds of entry: a catalog food in grams, and a custom
-- product in grams. A recipe is neither — it is counted in portions — and the
-- ways of forcing it into the existing shapes are all worse than a column:
--
--   * exploding it into its ingredients turns "Linsensuppe" into eight lines
--     the person never entered and cannot correct as a unit
--   * storing per-portion values as a custom entry means displaying "100 g"
--     for something that is one portion, which is simply false
--
-- So `source_type` gains 'recipe' and the row points at the recipe. `amount`
-- then means portions instead of grams, exactly as it already does on
-- `meal_entries` — the plan side has always worked this way, and the diary now
-- speaks the same language.
--
-- Saved meals are deliberately NOT modelled here: a saved meal *is* its items,
-- so logging one writes those items. Only a recipe stays a single line.
-- ============================================================================

ALTER TABLE client_food_log_entries
  DROP CONSTRAINT client_food_log_entries_source_type_check;

ALTER TABLE client_food_log_entries
  ADD CONSTRAINT client_food_log_entries_source_type_check
    CHECK (source_type IN ('food', 'custom', 'recipe'));

ALTER TABLE client_food_log_entries
  ADD COLUMN recipe_id UUID REFERENCES recipes(id);

ALTER TABLE client_food_log_entries
  DROP CONSTRAINT client_food_log_entries_reference_check;

ALTER TABLE client_food_log_entries
  ADD CONSTRAINT client_food_log_entries_reference_check CHECK (
    (source_type = 'food' AND food_id IS NOT NULL)
    OR (source_type = 'custom' AND custom_name IS NOT NULL)
    OR (source_type = 'recipe' AND recipe_id IS NOT NULL)
  );

COMMENT ON COLUMN client_food_log_entries.recipe_id IS
  'Set when source_type = ''recipe''. The row''s amount is then portions, not grams.';

-- A recipe logged in the diary is one the client may read: their counselor's,
-- through the plan, or a shared one. The read policies for that already exist
-- (migrations 73 and 78); nothing further is granted here.
