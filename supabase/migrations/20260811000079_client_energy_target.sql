-- ============================================================================
-- Give the client's diary something to measure against.
--
-- The diary shows four numbers — kcal, protein, fat, carbs — with nothing to
-- compare them to. "1.840 kcal" is not information; it becomes information
-- next to a target. The counselor already has one: `patients.daily_calorie_goal`
-- when they set one deliberately, otherwise maintenance as basal rate × PAL,
-- with `patients.macro_preset` splitting it across the macros.
--
-- None of that reaches the client today. It travels through the same door as
-- the measurement history — one more key in `client_patient_history()`'s fixed
-- projection, not a SELECT policy on `patients`, which carries notes and
-- administrative columns the client must never receive.
--
-- The basal rate is computed HERE rather than shipping its inputs. Mifflin-St
-- Jeor needs date of birth and sex; the client obviously knows their own, but
-- the projection's discipline is to send the answer instead of the raw record,
-- and one number is a smaller promise than two columns.
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
  ),
  latest AS (
    SELECT a.weight, a.height
    FROM patient_anthropometrics a
    JOIN linked ON linked.patient_id = a.patient_id
    ORDER BY a.date DESC
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
    'energy', (
      SELECT jsonb_build_object(
        -- The counselor's deliberate goal, when they set one.
        'dailyCalorieGoal', p.daily_calorie_goal,
        'macroPreset', p.macro_preset,
        'pal', ra.pal_value,
        -- Mifflin-St Jeor, the same formula the counselor's Energiebedarf card
        -- uses. NULL without a measurement to stand on — a basal rate guessed
        -- from default height and weight would be a number about nobody.
        'basalKcal', CASE
          WHEN l.weight IS NULL OR l.height IS NULL THEN NULL
          ELSE round(
            10 * l.weight
            + 6.25 * l.height
            - 5 * EXTRACT(YEAR FROM age(p.date_of_birth))
            + CASE p.gender WHEN 'm' THEN 5 WHEN 'w' THEN -161 ELSE -151 END
          )
        END
      )
      FROM patients p
      JOIN linked ON linked.patient_id = p.id
      LEFT JOIN patient_reference_assignments ra ON ra.patient_id = p.id
      LEFT JOIN latest l ON TRUE
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

-- CREATE OR REPLACE keeps the existing grants, including the revoke from
-- `anon` in migration 76. Restated so the intent survives a future replace.
REVOKE ALL ON FUNCTION public.client_patient_history() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.client_patient_history() FROM anon;
GRANT EXECUTE ON FUNCTION public.client_patient_history() TO authenticated;

COMMENT ON FUNCTION public.client_patient_history() IS
  'Measurement history and energy target of the calling client''s linked patient record, as a fixed projection. Deliberately omits patients.notes, patient_anthropometrics.notes, date of birth, sex and all administrative columns.';
