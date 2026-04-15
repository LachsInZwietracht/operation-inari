-- ============================================================================
-- Indexes for performance
-- ============================================================================

-- Full-text search via trigram on food names and synonyms
CREATE INDEX idx_foods_name_trgm ON foods USING gin (name gin_trgm_ops);
CREATE INDEX idx_food_synonyms_name_trgm ON food_synonyms USING gin (name gin_trgm_ops);

-- Food lookups by source, code, category, group
CREATE INDEX idx_foods_data_source ON foods(data_source_id);
CREATE INDEX idx_foods_bls_code ON foods(bls_code) WHERE bls_code IS NOT NULL;
CREATE INDEX idx_foods_category ON foods(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_foods_food_group ON foods(food_group_id) WHERE food_group_id IS NOT NULL;
CREATE INDEX idx_foods_user ON foods(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_foods_is_branded ON foods(is_branded) WHERE is_branded = TRUE;

-- Nutrient lookups
CREATE INDEX idx_food_nutrients_food ON food_nutrients(food_id);
CREATE INDEX idx_food_nutrients_nutrient ON food_nutrients(nutrient_id);

-- Synonym lookups
CREATE INDEX idx_food_synonyms_food ON food_synonyms(food_id);

-- Portion lookups
CREATE INDEX idx_food_portions_food ON food_portions(food_id);

-- Source mapping lookups
CREATE INDEX idx_food_source_mappings_food ON food_source_mappings(food_id);
CREATE INDEX idx_food_source_mappings_external ON food_source_mappings(external_source, external_id);

-- Reference value lookups
CREATE INDEX idx_reference_values_nutrient ON reference_values(nutrient_id);
CREATE INDEX idx_reference_values_gender ON reference_values(gender);

-- Recipe lookups
CREATE INDEX idx_recipes_user ON recipes(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_recipes_source_type ON recipes(source_type);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_food ON recipe_ingredients(food_id);

-- Meal plan lookups
CREATE INDEX idx_daily_meal_plans_user_date ON daily_meal_plans(user_id, date);
CREATE INDEX idx_meal_entries_plan ON meal_entries(meal_plan_id);
CREATE INDEX idx_meal_entries_slot ON meal_entries(meal_plan_id, slot_type);

-- OFF staging
CREATE INDEX idx_off_staging_validated ON off_staging(validated) WHERE validated = FALSE;
CREATE INDEX idx_off_staging_promoted ON off_staging(promoted) WHERE promoted = FALSE;
