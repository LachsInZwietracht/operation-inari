-- ============================================================================
-- Patient Lab Values
-- ============================================================================

CREATE TABLE patient_lab_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parameter_id TEXT NOT NULL,
  date DATE NOT NULL,
  value NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX patient_lab_values_patient_id_date_idx
  ON patient_lab_values(patient_id, date DESC);

CREATE TRIGGER patient_lab_values_updated_at
  BEFORE UPDATE ON patient_lab_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE patient_lab_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_lab_values_read_own" ON patient_lab_values
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "patient_lab_values_insert_own" ON patient_lab_values
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_lab_values_update_own" ON patient_lab_values
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_lab_values_delete_own" ON patient_lab_values
  FOR DELETE USING (user_id = auth.uid());
