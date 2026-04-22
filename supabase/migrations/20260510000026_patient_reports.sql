CREATE TABLE patient_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_ref TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  patient_indication TEXT,
  title TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  protocol_id TEXT,
  plan_date_label TEXT NOT NULL,
  report_length TEXT NOT NULL CHECK (report_length IN ('short', 'full')),
  selected_sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_section_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  last_format TEXT NOT NULL CHECK (last_format IN ('CSV', 'PDF')),
  last_file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX patient_reports_user_patient_updated_idx
  ON patient_reports(user_id, patient_ref, updated_at DESC);

CREATE TRIGGER patient_reports_updated_at
  BEFORE UPDATE ON patient_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE patient_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_reports_read_own" ON patient_reports
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "patient_reports_insert_own" ON patient_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_reports_update_own" ON patient_reports
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_reports_delete_own" ON patient_reports
  FOR DELETE USING (user_id = auth.uid());
