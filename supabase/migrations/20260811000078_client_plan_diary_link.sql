-- ============================================================================
-- Client mode: make the plan and the diary describe the same day.
--
-- They were strangers. Ticking a planned meal wrote a row in
-- `client_meal_completions` and nothing else, so a client who followed their
-- plan perfectly ended up with an empty diary, 0 kcal in their Verlauf, and no
-- nutrition data at all for their counselor — while someone who ignored the
-- plan and typed everything in got complete numbers. The app rewarded the
-- wrong behaviour.
--
-- The fix is a read-side join, not a copy. A ticked plan entry counts toward
-- the day's totals where it stands; it is not duplicated into
-- `client_food_log_entries`. Two records of one fact can drift, and the diary
-- table keeps its plain meaning: things the client entered themselves.
--
-- Two columns' worth of work, then:
--
--   1. `amount` on the completion, so "I ate the planned thing, but one and a
--      half portions" is expressible. NULL means "as planned", which is the
--      overwhelmingly common case and should not require a value.
--
--   2. A read policy for recipe ingredients. `recipes_read_linked_client_plan`
--      (migration 73) let the client read a planned recipe's *name*; its
--      ingredients stayed owner-only, so a recipe entry could be displayed but
--      never costed. Scoped exactly like its sibling: only ingredients of
--      recipes referenced by a plan this client may already read.
-- ============================================================================

ALTER TABLE client_meal_completions
  ADD COLUMN amount NUMERIC
    CHECK (amount IS NULL OR amount > 0);

COMMENT ON COLUMN client_meal_completions.amount IS
  'Amount actually eaten, in the plan entry''s own unit. NULL means as planned.';

CREATE POLICY "recipe_ingredients_read_linked_client_plan" ON recipe_ingredients
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM meal_entries
      JOIN daily_meal_plans ON daily_meal_plans.id = meal_entries.meal_plan_id
      WHERE meal_entries.entry_type = 'recipe'
        AND meal_entries.reference_id = recipe_ingredients.recipe_id
        AND daily_meal_plans.patient_id IS NOT NULL
        AND daily_meal_plans.status IN ('active', 'approved')
        AND client_can_read_patient_plans(daily_meal_plans.patient_id)
    )
  );
