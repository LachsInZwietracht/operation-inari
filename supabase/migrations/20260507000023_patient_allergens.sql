-- ============================================================================
-- Patient Allergens & Intolerances
-- ============================================================================

CREATE TABLE patient_allergens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allergen_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('allergy', 'intolerance', 'preference')),
  severity TEXT NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe')),
  diagnosed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate allergen entries per patient per user
CREATE UNIQUE INDEX patient_allergens_unique_idx ON patient_allergens(patient_id, user_id, allergen_id);

CREATE INDEX patient_allergens_patient_id_idx ON patient_allergens(patient_id);

-- Reuse existing trigger function
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON patient_allergens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──
ALTER TABLE patient_allergens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own patient allergens"
  ON patient_allergens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patient allergens"
  ON patient_allergens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patient allergens"
  ON patient_allergens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own patient allergens"
  ON patient_allergens FOR DELETE
  USING (auth.uid() = user_id);
