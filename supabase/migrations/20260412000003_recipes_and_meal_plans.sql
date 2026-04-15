-- ============================================================================
-- Recipes and meal plan tables
-- ============================================================================

-- Recipes created by users or imported from community/institution
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT,
  servings INTEGER NOT NULL DEFAULT 1,
  prep_time INTEGER,  -- minutes
  cook_time INTEGER,  -- minutes
  instructions TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  allergens TEXT[],
  additives TEXT[],
  tags TEXT[],
  prod_score NUMERIC,
  co2_per_portion NUMERIC,
  source_type TEXT NOT NULL DEFAULT 'personal'
    CHECK (source_type IN ('personal', 'community', 'institution', 'shared')),
  teaching_kitchen_notes TEXT,

  -- Ownership
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recipe ingredients — references foods table
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES foods(id),
  amount NUMERIC NOT NULL,  -- in grams
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Optional per-serving nutrient targets for a recipe
CREATE TABLE recipe_reference_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  nutrient_id TEXT NOT NULL REFERENCES nutrient_definitions(id),
  label TEXT NOT NULL,
  target NUMERIC NOT NULL
);

-- Daily meal plans
CREATE TABLE daily_meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Individual entries within a meal slot
-- NOTE: reference_id is polymorphic — it points to foods.id when entry_type = 'food'
-- and to recipes.id when entry_type = 'recipe'. No FK constraint is enforced in SQL
-- because Postgres doesn't support conditional foreign keys. Referential integrity
-- must be enforced at the application layer (server actions / API).
CREATE TABLE meal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES daily_meal_plans(id) ON DELETE CASCADE,
  slot_type TEXT NOT NULL
    CHECK (slot_type IN ('fruehstueck', 'snack_vormittag', 'mittagessen', 'snack_nachmittag', 'abendessen')),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('food', 'recipe')),
  -- Polymorphic: references foods.id OR recipes.id — see table comment above
  reference_id UUID NOT NULL,
  amount NUMERIC NOT NULL,  -- grams for food, servings for recipe
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Diet line presets (e.g., "Reduktionskost 1200 kcal")
CREATE TABLE diet_line_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = system preset
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nutrient targets within a diet line
CREATE TABLE diet_line_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diet_line_id UUID NOT NULL REFERENCES diet_line_presets(id) ON DELETE CASCADE,
  nutrient_id TEXT NOT NULL REFERENCES nutrient_definitions(id),
  label TEXT NOT NULL,
  min_value NUMERIC,
  max_value NUMERIC
);

-- ============================================================================
-- Triggers: auto-update updated_at
-- ============================================================================
CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER daily_meal_plans_updated_at
  BEFORE UPDATE ON daily_meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
