-- ============================================================================
-- Patient diet style, exclusions, and food preferences
-- ============================================================================
-- `nutrition_preferences` previously mixed two different concepts: a single
-- diet style (vegetarian/vegan/keto/low_carb) and open-ended exclusions it could
-- not express at all (no dairy, no pork, halal, ...).
--
-- After this migration:
--   patients.diet_style            -> exactly one style, nullable
--   patients.nutrition_preferences -> the exclusions list
--
-- Medical allergen and intolerance exclusions stay in `patient_allergens` so
-- warning logic remains centralized.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS diet_style TEXT
    CHECK (diet_style IN (
      'omnivor', 'vegetarisch', 'vegan', 'pescetarisch',
      'low_carb', 'keto', 'carnivore', 'mediterran'
    ));

-- Backfill: lift a legacy style value out of the array into diet_style.
-- Priority is most-restrictive-first so a patient tagged both vegan and
-- vegetarian ends up vegan.
UPDATE patients
SET diet_style = CASE
    WHEN 'vegan' = ANY(nutrition_preferences) THEN 'vegan'
    WHEN 'vegetarian' = ANY(nutrition_preferences) THEN 'vegetarisch'
    WHEN 'keto' = ANY(nutrition_preferences) THEN 'keto'
    WHEN 'low_carb' = ANY(nutrition_preferences) THEN 'low_carb'
  END
WHERE diet_style IS NULL
  AND nutrition_preferences && ARRAY['vegan', 'vegetarian', 'keto', 'low_carb'];

-- Remove the migrated style values, leaving nutrition_preferences as exclusions.
UPDATE patients
SET nutrition_preferences = ARRAY(
    SELECT unnest(nutrition_preferences)
    EXCEPT
    SELECT unnest(ARRAY['vegan', 'vegetarian', 'keto', 'low_carb'])
  )
WHERE nutrition_preferences && ARRAY['vegan', 'vegetarian', 'keto', 'low_carb'];

-- ============================================================================
-- Food preference ratings collected during intake
-- ============================================================================

CREATE TABLE patient_food_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_key TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('gerne', 'geht', 'nie')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX patient_food_preferences_unique_idx
  ON patient_food_preferences(patient_id, user_id, food_key);

CREATE INDEX patient_food_preferences_patient_id_idx
  ON patient_food_preferences(patient_id);

CREATE TRIGGER patient_food_preferences_updated_at
  BEFORE UPDATE ON patient_food_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──
ALTER TABLE patient_food_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own patient food preferences"
  ON patient_food_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patient food preferences"
  ON patient_food_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patient food preferences"
  ON patient_food_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own patient food preferences"
  ON patient_food_preferences FOR DELETE
  USING (auth.uid() = user_id);
