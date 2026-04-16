-- Add cached nutrient columns to recipes table for performance in list views
ALTER TABLE recipes
  ADD COLUMN cached_kcal_per_portion NUMERIC,
  ADD COLUMN cached_protein_per_portion NUMERIC,
  ADD COLUMN cached_fat_per_portion NUMERIC,
  ADD COLUMN cached_carbs_per_portion NUMERIC;

COMMENT ON COLUMN recipes.cached_kcal_per_portion IS 'Cached total energy (kcal) per serving';
COMMENT ON COLUMN recipes.cached_protein_per_portion IS 'Cached protein (g) per serving';
COMMENT ON COLUMN recipes.cached_fat_per_portion IS 'Cached fat (g) per serving';
COMMENT ON COLUMN recipes.cached_carbs_per_portion IS 'Cached carbohydrates (g) per serving';
