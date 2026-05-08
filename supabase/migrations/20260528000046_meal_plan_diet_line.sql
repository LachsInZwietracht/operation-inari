-- Persists the selected Diät-Line preset for a daily meal plan.
-- DIET_LINES (lib/reference-data/diet-lines.ts) ships as a static seed list
-- with string keys (e.g. 'diet_normal', 'diet_diabetes'), so the column is a
-- plain TEXT identifier without a foreign-key constraint.

ALTER TABLE daily_meal_plans
  ADD COLUMN IF NOT EXISTS diet_line_id TEXT;

CREATE INDEX IF NOT EXISTS daily_meal_plans_user_diet_line_date_idx
  ON daily_meal_plans(user_id, diet_line_id, date DESC);
