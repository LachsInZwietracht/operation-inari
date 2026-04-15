-- ============================================================================
-- Row Level Security policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrient_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_portions ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_source_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE off_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_reference_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_line_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_line_targets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Public read access for reference/static data
-- Everyone can read data sources, nutrient definitions, and reference values.
--
-- OPS NOTE: These tables only have SELECT policies. All writes (INSERT/UPDATE/DELETE)
-- require the Supabase service_role key, which bypasses RLS. This is intentional:
-- ETL scripts and seed jobs use the service role, while client-side code only reads.
-- Do NOT use the anon or user JWT key for data imports — they will be rejected.
-- ============================================================================

CREATE POLICY "data_sources_read" ON data_sources
  FOR SELECT USING (true);

CREATE POLICY "nutrient_definitions_read" ON nutrient_definitions
  FOR SELECT USING (true);

CREATE POLICY "reference_values_read" ON reference_values
  FOR SELECT USING (true);

-- ============================================================================
-- Foods: public foods readable by all, custom foods only by owner
-- ============================================================================

-- Anyone can read non-custom foods (BLS, OFF, Swiss, etc.)
CREATE POLICY "foods_read_public" ON foods
  FOR SELECT USING (is_custom = FALSE);

-- Users can read their own custom foods
CREATE POLICY "foods_read_own_custom" ON foods
  FOR SELECT USING (is_custom = TRUE AND user_id = auth.uid());

-- Users can create their own custom foods
CREATE POLICY "foods_insert_own" ON foods
  FOR INSERT WITH CHECK (is_custom = TRUE AND user_id = auth.uid());

-- Users can update their own custom foods
CREATE POLICY "foods_update_own" ON foods
  FOR UPDATE USING (is_custom = TRUE AND user_id = auth.uid())
  WITH CHECK (is_custom = TRUE AND user_id = auth.uid());

-- Users can delete their own custom foods
CREATE POLICY "foods_delete_own" ON foods
  FOR DELETE USING (is_custom = TRUE AND user_id = auth.uid());

-- ============================================================================
-- Food nutrients: follow parent food visibility
-- ============================================================================

CREATE POLICY "food_nutrients_read" ON food_nutrients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM foods
      WHERE foods.id = food_nutrients.food_id
        AND (foods.is_custom = FALSE OR foods.user_id = auth.uid())
    )
  );

CREATE POLICY "food_nutrients_insert_own" ON food_nutrients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM foods
      WHERE foods.id = food_nutrients.food_id
        AND foods.is_custom = TRUE
        AND foods.user_id = auth.uid()
    )
  );

CREATE POLICY "food_nutrients_update_own" ON food_nutrients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM foods
      WHERE foods.id = food_nutrients.food_id
        AND foods.is_custom = TRUE
        AND foods.user_id = auth.uid()
    )
  );

CREATE POLICY "food_nutrients_delete_own" ON food_nutrients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM foods
      WHERE foods.id = food_nutrients.food_id
        AND foods.is_custom = TRUE
        AND foods.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Food portions & synonyms: follow parent food visibility
-- ============================================================================

CREATE POLICY "food_portions_read" ON food_portions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM foods
      WHERE foods.id = food_portions.food_id
        AND (foods.is_custom = FALSE OR foods.user_id = auth.uid())
    )
  );

CREATE POLICY "food_synonyms_read" ON food_synonyms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM foods
      WHERE foods.id = food_synonyms.food_id
        AND (foods.is_custom = FALSE OR foods.user_id = auth.uid())
    )
  );

-- ============================================================================
-- Source mappings: public read
-- ============================================================================

CREATE POLICY "food_source_mappings_read" ON food_source_mappings
  FOR SELECT USING (true);

-- ============================================================================
-- OFF staging: no public access (admin/service role only)
-- ============================================================================
-- off_staging has RLS enabled but no policies = only service_role can access

-- ============================================================================
-- Recipes: own recipes + community/institution readable by all
-- ============================================================================

-- Users can read their own recipes
CREATE POLICY "recipes_read_own" ON recipes
  FOR SELECT USING (user_id = auth.uid());

-- Anyone can read community/institution/shared recipes
CREATE POLICY "recipes_read_public" ON recipes
  FOR SELECT USING (source_type IN ('community', 'institution', 'shared'));

-- Users can create their own recipes
CREATE POLICY "recipes_insert_own" ON recipes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own recipes
CREATE POLICY "recipes_update_own" ON recipes
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own recipes
CREATE POLICY "recipes_delete_own" ON recipes
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- Recipe ingredients & targets: follow parent recipe visibility
-- ============================================================================

CREATE POLICY "recipe_ingredients_read" ON recipe_ingredients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
        AND (recipes.user_id = auth.uid() OR recipes.source_type IN ('community', 'institution', 'shared'))
    )
  );

CREATE POLICY "recipe_ingredients_insert_own" ON recipe_ingredients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
        AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "recipe_ingredients_update_own" ON recipe_ingredients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
        AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "recipe_ingredients_delete_own" ON recipe_ingredients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
        AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "recipe_reference_targets_read" ON recipe_reference_targets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_reference_targets.recipe_id
        AND (recipes.user_id = auth.uid() OR recipes.source_type IN ('community', 'institution', 'shared'))
    )
  );

CREATE POLICY "recipe_reference_targets_insert_own" ON recipe_reference_targets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_reference_targets.recipe_id
        AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "recipe_reference_targets_delete_own" ON recipe_reference_targets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_reference_targets.recipe_id
        AND recipes.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Meal plans: strictly private per user
-- ============================================================================

CREATE POLICY "meal_plans_read_own" ON daily_meal_plans
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "meal_plans_insert_own" ON daily_meal_plans
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "meal_plans_update_own" ON daily_meal_plans
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "meal_plans_delete_own" ON daily_meal_plans
  FOR DELETE USING (user_id = auth.uid());

-- Meal entries follow their parent plan
CREATE POLICY "meal_entries_read_own" ON meal_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM daily_meal_plans
      WHERE daily_meal_plans.id = meal_entries.meal_plan_id
        AND daily_meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "meal_entries_insert_own" ON meal_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_meal_plans
      WHERE daily_meal_plans.id = meal_entries.meal_plan_id
        AND daily_meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "meal_entries_update_own" ON meal_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM daily_meal_plans
      WHERE daily_meal_plans.id = meal_entries.meal_plan_id
        AND daily_meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "meal_entries_delete_own" ON meal_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM daily_meal_plans
      WHERE daily_meal_plans.id = meal_entries.meal_plan_id
        AND daily_meal_plans.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Diet line presets: system presets readable by all, user presets private
-- ============================================================================

CREATE POLICY "diet_line_presets_read_system" ON diet_line_presets
  FOR SELECT USING (user_id IS NULL);

CREATE POLICY "diet_line_presets_read_own" ON diet_line_presets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "diet_line_presets_insert_own" ON diet_line_presets
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "diet_line_presets_update_own" ON diet_line_presets
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "diet_line_presets_delete_own" ON diet_line_presets
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "diet_line_targets_read" ON diet_line_targets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM diet_line_presets
      WHERE diet_line_presets.id = diet_line_targets.diet_line_id
        AND (diet_line_presets.user_id IS NULL OR diet_line_presets.user_id = auth.uid())
    )
  );

CREATE POLICY "diet_line_targets_insert_own" ON diet_line_targets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM diet_line_presets
      WHERE diet_line_presets.id = diet_line_targets.diet_line_id
        AND diet_line_presets.user_id = auth.uid()
    )
  );

CREATE POLICY "diet_line_targets_delete_own" ON diet_line_targets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM diet_line_presets
      WHERE diet_line_presets.id = diet_line_targets.diet_line_id
        AND diet_line_presets.user_id = auth.uid()
    )
  );
