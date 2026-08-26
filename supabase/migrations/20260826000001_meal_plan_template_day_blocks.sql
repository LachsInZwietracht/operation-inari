-- A reusable template can be a single day (the existing `slots` contract) or
-- a patient-independent multi-day blueprint. Relative offsets deliberately
-- retain selected gaps without storing patient dates.
ALTER TABLE meal_plan_templates
  ADD COLUMN day_blocks JSONB;

ALTER TABLE meal_plan_templates
  ADD CONSTRAINT meal_plan_templates_day_blocks_array
  CHECK (day_blocks IS NULL OR jsonb_typeof(day_blocks) = 'array');
