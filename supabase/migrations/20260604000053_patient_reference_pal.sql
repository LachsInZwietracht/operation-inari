-- Persist a per-patient PAL (Physical Activity Level) factor alongside the
-- patient's reference assignment, so energy targets (BMR x PAL) survive reloads.
-- PAL is part of the patient's reference/target settings, so it lives on the
-- existing assignment row rather than a separate table.

ALTER TABLE patient_reference_assignments
  ADD COLUMN pal_value NUMERIC
    CHECK (pal_value IS NULL OR (pal_value >= 1.0 AND pal_value <= 2.5));

COMMENT ON COLUMN patient_reference_assignments.pal_value IS
  'Physical Activity Level factor used to derive total energy expenditure (BMR x PAL). NULL falls back to the UI default of 1.4.';
