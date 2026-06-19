-- ============================================================================
-- Patient calorie targets
-- ============================================================================
-- Persist the calorie-calculator outputs that are deliberate targets rather
-- than derived values: the chosen daily calorie goal, the goal weight, and the
-- selected macro distribution preset. PAL/activity is intentionally NOT stored
-- here -- it already lives on patient_reference_assignments.pal_value, and
-- maintenance calories are derived live as BMR x PAL.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS daily_calorie_goal NUMERIC,
  ADD COLUMN IF NOT EXISTS goal_weight NUMERIC,
  ADD COLUMN IF NOT EXISTS macro_preset TEXT;
