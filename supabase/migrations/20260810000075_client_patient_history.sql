-- ============================================================================
-- Client access to their own measurement history
--
-- The client surface shows the same weight/BMI/body-composition charts the
-- counselor sees. That data lives in the counselor's tables, so the client
-- needs a way in — but NOT a row-level grant:
--
--   patients.notes                    the counselor's private remarks
--   patients.insurance_*, address     administrative, not the client's concern here
--   patient_anthropometrics.notes     free-text observations about a measurement
--
-- RLS grants rows, not columns, so a SELECT policy on those tables would hand
-- the client every column including the notes. A SECURITY DEFINER function
-- returning a fixed projection is the narrower instrument: the column list is
-- the permission, and it is visible right here.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.client_patient_history()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH linked AS (
    -- Most recently consented active link. A client can in principle be
    -- linked to more than one counselor; each keeps its own patient record,
    -- and mixing measurements from two of them into one chart would invent a
    -- history that never existed.
    SELECT patient_id
    FROM client_links
    WHERE client_user_id = auth.uid()
      AND status = 'active'
    ORDER BY consented_at DESC NULLS LAST, created_at DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'patient', (
      SELECT jsonb_build_object(
        'firstName', p.first_name,
        'goalWeight', p.goal_weight
      )
      FROM patients p
      JOIN linked ON linked.patient_id = p.id
    ),
    'measurements', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'date', a.date,
          'weight', a.weight,
          'height', a.height,
          'bmi', a.bmi,
          'waistCircumference', a.waist_circumference,
          'hipCircumference', a.hip_circumference,
          'bodyFatPercentage', a.body_fat_percentage,
          'fatFreeMassKg', a.fat_free_mass_kg,
          'subcutaneousFatPercentage', a.subcutaneous_fat_percentage,
          'visceralFatRating', a.visceral_fat_rating,
          'bodyWaterPercentage', a.body_water_percentage,
          'muscleMassKg', a.muscle_mass_kg,
          'skeletalMusclePercentage', a.skeletal_muscle_percentage,
          'boneMassKg', a.bone_mass_kg,
          'proteinPercentage', a.protein_percentage,
          'bmrKcal', a.bmr_kcal,
          'metabolicAgeYears', a.metabolic_age_years
        )
        ORDER BY a.date
      )
      FROM patient_anthropometrics a
      JOIN linked ON linked.patient_id = a.patient_id
    ), '[]'::jsonb),
    'activities', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', act.id,
          'date', act.date,
          'type', act.type,
          'durationMinutes', act.duration_minutes,
          'intensity', act.intensity,
          'pal', act.pal,
          'energyKcal', act.energy_kcal
        )
        ORDER BY act.date
      )
      FROM patient_activities act
      JOIN linked ON linked.patient_id = act.patient_id
    ), '[]'::jsonb)
  )
  -- No link, no history: the object is returned with nulls rather than an
  -- error, so the page can render an empty state instead of failing.
  WHERE EXISTS (SELECT 1 FROM linked);
$$;

-- SECURITY DEFINER runs as the owner, so the grant is what limits who may call
-- it. It reads nothing that is not about the caller themselves.
REVOKE ALL ON FUNCTION public.client_patient_history() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_patient_history() TO authenticated;

COMMENT ON FUNCTION public.client_patient_history() IS
  'Measurement history of the calling client''s linked patient record, as a fixed projection. Deliberately omits patients.notes, patient_anthropometrics.notes and all administrative columns.';
