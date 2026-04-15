-- Update reference_values schema to support fractional ages + detailed life stages
ALTER TABLE reference_values
  ALTER COLUMN age_min TYPE NUMERIC(5,2),
  ALTER COLUMN age_max TYPE NUMERIC(5,2);

ALTER TABLE reference_values
  DROP CONSTRAINT IF EXISTS reference_values_life_phase_check;

ALTER TABLE reference_values
  RENAME COLUMN life_phase TO life_stage;

ALTER TABLE reference_values
  ADD CONSTRAINT reference_values_life_stage_check
    CHECK (life_stage IS NULL OR life_stage IN ('pregnant_t1','pregnant_t2','pregnant_t3','lactating'));
