-- Adds legacy IDs for recipes/meal plans and allows system-owned plans

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS legacy_id TEXT UNIQUE;

ALTER TABLE daily_meal_plans
  ADD COLUMN IF NOT EXISTS legacy_id TEXT UNIQUE;

ALTER TABLE daily_meal_plans
  ALTER COLUMN user_id DROP NOT NULL;
