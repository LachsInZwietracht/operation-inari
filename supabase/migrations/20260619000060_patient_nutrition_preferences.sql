-- ============================================================================
-- Patient nutrition preferences
-- ============================================================================
-- Stores patient-level diet preferences used for counseling and recipe/plan
-- filtering. Medical allergen and intolerance exclusions remain in
-- patient_allergens so warning logic stays centralized.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS nutrition_preferences TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS nutrition_preference_notes TEXT;
