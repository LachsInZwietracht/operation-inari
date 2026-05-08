-- Persists the selected Diät-Line preset for a daily meal plan.
-- DIET_LINES (lib/reference-data/diet-lines.ts) ships as a static seed list
-- with string keys (e.g. 'diet_normal', 'diet_diabetes'), so the column is a
-- plain TEXT identifier without a foreign-key constraint.

ALTER TABLE daily_meal_plans
  ADD COLUMN IF NOT EXISTS diet_line_id TEXT;
