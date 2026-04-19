ALTER TABLE reference_values
  ADD COLUMN IF NOT EXISTS standard_id TEXT;

ALTER TABLE reference_values
  ADD COLUMN IF NOT EXISTS age_group_id TEXT;

UPDATE reference_values
SET standard_id = CASE
  WHEN source ILIKE 'DGE%' THEN 'dge'
  WHEN source ILIKE 'ÖGE%' OR source ILIKE 'OEGE%' THEN 'oege'
  WHEN source ILIKE 'SGE%' THEN 'sge'
  WHEN source ILIKE 'RDA%' THEN 'rda'
  ELSE 'dge'
END
WHERE standard_id IS NULL;

UPDATE reference_values
SET age_group_id = CASE
  WHEN label ILIKE '%0–4 Monate%' OR label ILIKE '%0-4 Monate%' THEN '0-4m'
  WHEN label ILIKE '%4–12 Monate%' OR label ILIKE '%4-12 Monate%' THEN '4-12m'
  WHEN label ILIKE '%1–4 Jahre%' OR label ILIKE '%1-4 Jahre%' THEN '1-4'
  WHEN label ILIKE '%4–7 Jahre%' OR label ILIKE '%4-7 Jahre%' THEN '4-7'
  WHEN label ILIKE '%7–10 Jahre%' OR label ILIKE '%7-10 Jahre%' THEN '7-10'
  WHEN label ILIKE '%10–13 Jahre%' OR label ILIKE '%10-13 Jahre%' THEN '10-13'
  WHEN label ILIKE '%13–15 Jahre%' OR label ILIKE '%13-15 Jahre%' THEN '13-15'
  WHEN label ILIKE '%15–19 Jahre%' OR label ILIKE '%15-19 Jahre%' THEN '15-19'
  WHEN label ILIKE '%19–25 Jahre%' OR label ILIKE '%19-25 Jahre%' THEN '19-25'
  WHEN label ILIKE '%25–51 Jahre%' OR label ILIKE '%25-51 Jahre%' THEN '25-51'
  WHEN label ILIKE '%51–65 Jahre%' OR label ILIKE '%51-65 Jahre%' THEN '51-65'
  WHEN label ILIKE '%65+ Jahre%' THEN '65+'
  ELSE '25-51'
END
WHERE age_group_id IS NULL;

ALTER TABLE reference_values
  ALTER COLUMN standard_id SET NOT NULL,
  ALTER COLUMN age_group_id SET NOT NULL;

ALTER TABLE reference_values
  ADD CONSTRAINT reference_values_standard_id_check
    CHECK (standard_id IN ('dge', 'oege', 'sge', 'rda'));

CREATE INDEX IF NOT EXISTS idx_reference_values_runtime_lookup
  ON reference_values(standard_id, gender, age_group_id, life_stage, nutrient_id);

CREATE TABLE reference_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  based_on_standard_id TEXT CHECK (based_on_standard_id IS NULL OR based_on_standard_id IN ('dge', 'oege', 'sge', 'rda')),
  age_group_id TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('m', 'w')),
  life_stage TEXT NOT NULL DEFAULT 'none'
    CHECK (life_stage IN ('none', 'pregnant_t1', 'pregnant_t2', 'pregnant_t3', 'lactating')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reference_profile_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES reference_profiles(id) ON DELETE CASCADE,
  nutrient_id TEXT NOT NULL REFERENCES nutrient_definitions(id),
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, nutrient_id)
);

CREATE TABLE user_reference_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  standard_id TEXT CHECK (standard_id IS NULL OR standard_id IN ('dge', 'oege', 'sge', 'rda')),
  profile_id UUID REFERENCES reference_profiles(id) ON DELETE CASCADE,
  age_group_id TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('m', 'w')),
  life_stage TEXT NOT NULL DEFAULT 'none'
    CHECK (life_stage IN ('none', 'pregnant_t1', 'pregnant_t2', 'pregnant_t3', 'lactating')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_reference_preferences_selection_check
    CHECK (((standard_id IS NOT NULL)::int + (profile_id IS NOT NULL)::int) = 1)
);

CREATE TABLE patient_reference_assignments (
  patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  standard_id TEXT CHECK (standard_id IS NULL OR standard_id IN ('dge', 'oege', 'sge', 'rda')),
  profile_id UUID REFERENCES reference_profiles(id) ON DELETE CASCADE,
  life_stage TEXT NOT NULL DEFAULT 'none'
    CHECK (life_stage IN ('none', 'pregnant_t1', 'pregnant_t2', 'pregnant_t3', 'lactating')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT patient_reference_assignments_selection_check
    CHECK (((standard_id IS NOT NULL)::int + (profile_id IS NOT NULL)::int) = 1)
);

CREATE TRIGGER reference_profiles_updated_at
  BEFORE UPDATE ON reference_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_reference_preferences_updated_at
  BEFORE UPDATE ON user_reference_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER patient_reference_assignments_updated_at
  BEFORE UPDATE ON patient_reference_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE reference_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_profile_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reference_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_reference_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reference_profiles_read_own" ON reference_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "reference_profiles_insert_own" ON reference_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reference_profiles_update_own" ON reference_profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "reference_profiles_delete_own" ON reference_profiles
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "reference_profile_values_read_own" ON reference_profile_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reference_profiles
      WHERE reference_profiles.id = reference_profile_values.profile_id
        AND reference_profiles.user_id = auth.uid()
    )
  );
CREATE POLICY "reference_profile_values_insert_own" ON reference_profile_values
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM reference_profiles
      WHERE reference_profiles.id = reference_profile_values.profile_id
        AND reference_profiles.user_id = auth.uid()
    )
  );
CREATE POLICY "reference_profile_values_delete_own" ON reference_profile_values
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM reference_profiles
      WHERE reference_profiles.id = reference_profile_values.profile_id
        AND reference_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "user_reference_preferences_read_own" ON user_reference_preferences
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_reference_preferences_insert_own" ON user_reference_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_reference_preferences_update_own" ON user_reference_preferences
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_reference_assignments_read_own" ON patient_reference_assignments
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "patient_reference_assignments_insert_own" ON patient_reference_assignments
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_reference_assignments_update_own" ON patient_reference_assignments
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_reference_assignments_delete_own" ON patient_reference_assignments
  FOR DELETE USING (user_id = auth.uid());

ALTER TABLE patient_lab_values
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
