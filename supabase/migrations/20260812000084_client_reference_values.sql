-- ============================================================================
-- Give the client's diary a reference for the nutrients that are not calories.
--
-- Migration 79 sent the energy target through `client_patient_history()`. The
-- micronutrients need the same thing and have nowhere to get it: the DGE
-- reference for iron is not one number, it is a number per age group, sex and
-- life stage, and the client surface is deliberately not told any of those.
--
-- So the resolution happens HERE, the same trade migration 79 made for the
-- basal rate: the answer travels, not the inputs. `reference_values` itself is
-- world-readable — what is private is which row applies to this person.
--
-- This is a faithful port of `resolveReferenceForPatient` in
-- lib/reference-values.ts, including its two fallbacks: an age group of
-- 25–51 when no date of birth is recorded, and the plain 'none' rows when a
-- life stage has no rows of its own. A custom profile assigned by the
-- counselor overrides the standard nutrient by nutrient, exactly as
-- `resolveCustomProfile` does.
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
  ),
  -- Which reference row applies to this person. A custom profile carries its
  -- own demographics and outranks the patient record's; without an assignment
  -- at all we fall back to the DGE, which is what the counselor UI defaults to.
  resolved AS (
    SELECT
      COALESCE(ra.standard_id, rp.based_on_standard_id, 'dge') AS standard_id,
      COALESCE(
        rp.age_group_id,
        CASE
          WHEN p.date_of_birth IS NULL THEN '25-51'
          WHEN EXTRACT(YEAR FROM age(p.date_of_birth)) < 1  THEN '4-12m'
          WHEN EXTRACT(YEAR FROM age(p.date_of_birth)) < 4  THEN '1-4'
          WHEN EXTRACT(YEAR FROM age(p.date_of_birth)) < 7  THEN '4-7'
          WHEN EXTRACT(YEAR FROM age(p.date_of_birth)) < 10 THEN '7-10'
          WHEN EXTRACT(YEAR FROM age(p.date_of_birth)) < 13 THEN '10-13'
          WHEN EXTRACT(YEAR FROM age(p.date_of_birth)) < 15 THEN '13-15'
          WHEN EXTRACT(YEAR FROM age(p.date_of_birth)) < 19 THEN '15-19'
          WHEN EXTRACT(YEAR FROM age(p.date_of_birth)) < 25 THEN '19-25'
          WHEN EXTRACT(YEAR FROM age(p.date_of_birth)) < 51 THEN '25-51'
          WHEN EXTRACT(YEAR FROM age(p.date_of_birth)) < 65 THEN '51-65'
          ELSE '65+'
        END
      ) AS age_group_id,
      -- The reference tables only carry 'm' and 'w'; anything else reads the
      -- female column, which is the same choice the TypeScript resolver makes.
      COALESCE(rp.gender, CASE p.gender WHEN 'm' THEN 'm' ELSE 'w' END) AS gender,
      COALESCE(rp.life_stage, ra.life_stage, 'none') AS life_stage,
      ra.profile_id
    FROM patients p
    JOIN linked ON linked.patient_id = p.id
    LEFT JOIN patient_reference_assignments ra ON ra.patient_id = p.id
    LEFT JOIN reference_profiles rp ON rp.id = ra.profile_id
  ),
  -- Rows for the exact life stage, when that stage has any of its own.
  staged AS (
    SELECT rv.nutrient_id, rv.amount
    FROM reference_values rv
    JOIN resolved r
      ON rv.standard_id = r.standard_id
     AND rv.gender = r.gender
     AND rv.age_group_id = r.age_group_id
     AND COALESCE(rv.life_stage, 'none') = r.life_stage
  ),
  -- A pregnancy stage with no rows of its own falls back to the plain adult
  -- values rather than to nothing, so a pregnant client still sees a target.
  base AS (
    SELECT * FROM staged
    UNION ALL
    SELECT rv.nutrient_id, rv.amount
    FROM reference_values rv
    JOIN resolved r
      ON rv.standard_id = r.standard_id
     AND rv.gender = r.gender
     AND rv.age_group_id = r.age_group_id
     AND rv.life_stage IS NULL
    WHERE r.life_stage <> 'none'
      AND NOT EXISTS (SELECT 1 FROM staged)
  ),
  -- The counselor's per-nutrient corrections win over the standard.
  merged AS (
    SELECT b.nutrient_id, b.amount
    FROM base b
    WHERE NOT EXISTS (
      SELECT 1
      FROM reference_profile_values pv
      JOIN resolved r ON r.profile_id = pv.profile_id
      WHERE pv.nutrient_id = b.nutrient_id
    )
    UNION ALL
    SELECT pv.nutrient_id, pv.amount
    FROM reference_profile_values pv
    JOIN resolved r ON r.profile_id = pv.profile_id
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
    -- The daily reference intake, one entry per nutrient. Deliberately not the
    -- age group, sex or standard that produced it: the diary needs the target,
    -- not the demographics behind it.
    'references', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('nutrientId', nutrient_id, 'amount', amount)
        ORDER BY nutrient_id
      )
      FROM merged
    ), '[]'::jsonb),
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
  'Measurement history, energy target and resolved reference intake of the calling client''s linked patient record, as a fixed projection. Deliberately omits patients.notes, patient_anthropometrics.notes, date of birth, sex, age group and all administrative columns.';
