-- ============================================================================
-- Patients and Clinical Data
-- ============================================================================

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('m', 'w', 'd')),
  email TEXT,
  phone TEXT,
  street TEXT,
  zip TEXT,
  city TEXT,
  insurance_provider TEXT,
  insurance_number TEXT,
  indication TEXT,
  notes TEXT,
  amputations TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for searching and filtering patients
CREATE INDEX patients_user_id_idx ON patients(user_id);
CREATE INDEX patients_last_name_idx ON patients(last_name, first_name);

-- Anthropometric data (Weight, Height history)
CREATE TABLE patient_anthropometrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight NUMERIC NOT NULL,
  height NUMERIC NOT NULL,
  bmi NUMERIC NOT NULL,
  waist_circumference NUMERIC,
  hip_circumference NUMERIC,
  body_fat_percentage NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX patient_anthropometrics_patient_id_date_idx ON patient_anthropometrics(patient_id, date DESC);

-- Diagnoses
CREATE TABLE patient_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnosis TEXT NOT NULL,
  icd_code TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Medications
CREATE TABLE patient_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  schedule TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Screenings (MUST, NRS-2002, MNA, SGA)
CREATE TABLE patient_screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool TEXT NOT NULL CHECK (tool IN ('MUST', 'NRS-2002', 'MNA', 'SGA')),
  score NUMERIC NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER patient_anthropometrics_updated_at
  BEFORE UPDATE ON patient_anthropometrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER patient_diagnoses_updated_at
  BEFORE UPDATE ON patient_diagnoses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER patient_medications_updated_at
  BEFORE UPDATE ON patient_medications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER patient_screenings_updated_at
  BEFORE UPDATE ON patient_screenings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_anthropometrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_screenings ENABLE ROW LEVEL SECURITY;

-- Patients policies
CREATE POLICY "patients_read_own" ON patients
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "patients_insert_own" ON patients
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "patients_update_own" ON patients
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "patients_delete_own" ON patients
  FOR DELETE USING (user_id = auth.uid());

-- Anthropometrics policies
CREATE POLICY "patient_anthropometrics_read_own" ON patient_anthropometrics
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "patient_anthropometrics_insert_own" ON patient_anthropometrics
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_anthropometrics_update_own" ON patient_anthropometrics
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_anthropometrics_delete_own" ON patient_anthropometrics
  FOR DELETE USING (user_id = auth.uid());

-- Diagnoses policies
CREATE POLICY "patient_diagnoses_read_own" ON patient_diagnoses
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "patient_diagnoses_insert_own" ON patient_diagnoses
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_diagnoses_update_own" ON patient_diagnoses
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_diagnoses_delete_own" ON patient_diagnoses
  FOR DELETE USING (user_id = auth.uid());

-- Medications policies
CREATE POLICY "patient_medications_read_own" ON patient_medications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "patient_medications_insert_own" ON patient_medications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_medications_update_own" ON patient_medications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_medications_delete_own" ON patient_medications
  FOR DELETE USING (user_id = auth.uid());

-- Screenings policies
CREATE POLICY "patient_screenings_read_own" ON patient_screenings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "patient_screenings_insert_own" ON patient_screenings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_screenings_update_own" ON patient_screenings
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_screenings_delete_own" ON patient_screenings
  FOR DELETE USING (user_id = auth.uid());
