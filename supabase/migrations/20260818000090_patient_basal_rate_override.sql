-- ============================================================================
-- Let a counselor set the basal metabolic rate by hand.
--
-- Mifflin-St Jeor is a population formula. A practitioner with an indirect
-- calorimetry reading, a BIA device or a patient the formula plainly misses
-- needs to be able to say so, the same way the PAL factor is already theirs to
-- set in `patient_reference_assignments.pal_value`.
--
-- NULL is the normal state and keeps the calculated value, so nothing changes
-- for the patients nobody has touched. Every consumer resolves the same way:
-- COALESCE(override, formula).
-- ============================================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS basal_metabolic_rate_override INTEGER;

COMMENT ON COLUMN public.patients.basal_metabolic_rate_override IS
  'Basal metabolic rate in kcal/day set by hand. NULL falls back to Mifflin-St Jeor.';

ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_basal_metabolic_rate_override_range;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_basal_metabolic_rate_override_range
  CHECK (
    basal_metabolic_rate_override IS NULL
    OR basal_metabolic_rate_override BETWEEN 500 AND 6000
  );
