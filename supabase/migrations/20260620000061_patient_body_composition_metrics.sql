-- Store body-composition measurements from smart scales and clinical BIA devices
-- as structured anthropometric values instead of free-text notes.

ALTER TABLE patient_anthropometrics
  ADD COLUMN fat_free_mass_kg NUMERIC,
  ADD COLUMN subcutaneous_fat_percentage NUMERIC,
  ADD COLUMN visceral_fat_rating NUMERIC,
  ADD COLUMN body_water_percentage NUMERIC,
  ADD COLUMN muscle_mass_kg NUMERIC,
  ADD COLUMN skeletal_muscle_percentage NUMERIC,
  ADD COLUMN bone_mass_kg NUMERIC,
  ADD COLUMN protein_percentage NUMERIC,
  ADD COLUMN bmr_kcal NUMERIC,
  ADD COLUMN metabolic_age_years NUMERIC;

UPDATE patient_anthropometrics
SET
  fat_free_mass_kg = COALESCE(
    fat_free_mass_kg,
    NULLIF((regexp_match(notes, 'Fettfreies Körpergewicht ([0-9]+(?:\.[0-9]+)?) kg'))[1], '')::numeric
  ),
  subcutaneous_fat_percentage = COALESCE(
    subcutaneous_fat_percentage,
    NULLIF((regexp_match(notes, 'Unterhautfettgewebe ([0-9]+(?:\.[0-9]+)?) %'))[1], '')::numeric
  ),
  visceral_fat_rating = COALESCE(
    visceral_fat_rating,
    NULLIF((regexp_match(notes, 'Viszerales Fett ([0-9]+(?:\.[0-9]+)?)'))[1], '')::numeric
  ),
  body_water_percentage = COALESCE(
    body_water_percentage,
    NULLIF((regexp_match(notes, 'Körperwasser ([0-9]+(?:\.[0-9]+)?) %'))[1], '')::numeric
  ),
  muscle_mass_kg = COALESCE(
    muscle_mass_kg,
    NULLIF((regexp_match(notes, 'Muskelmasse ([0-9]+(?:\.[0-9]+)?) kg'))[1], '')::numeric
  ),
  skeletal_muscle_percentage = COALESCE(
    skeletal_muscle_percentage,
    NULLIF((regexp_match(notes, 'Skelettmuskeln ([0-9]+(?:\.[0-9]+)?) %'))[1], '')::numeric
  ),
  bone_mass_kg = COALESCE(
    bone_mass_kg,
    NULLIF((regexp_match(notes, 'Knochenmasse ([0-9]+(?:\.[0-9]+)?) kg'))[1], '')::numeric
  ),
  protein_percentage = COALESCE(
    protein_percentage,
    NULLIF((regexp_match(notes, 'Protein ([0-9]+(?:\.[0-9]+)?) %'))[1], '')::numeric
  ),
  bmr_kcal = COALESCE(
    bmr_kcal,
    NULLIF((regexp_match(notes, 'BMR ([0-9]+(?:\.[0-9]+)?) kcal'))[1], '')::numeric
  ),
  metabolic_age_years = COALESCE(
    metabolic_age_years,
    NULLIF((regexp_match(notes, 'Metabolisches Alter ([0-9]+(?:\.[0-9]+)?)'))[1], '')::numeric
  )
WHERE notes LIKE 'Import aus Körperdaten-CSV%';
