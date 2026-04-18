-- ============================================================================
-- Patient Workspace Persistence
-- ============================================================================

CREATE TABLE patient_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  duration_minutes NUMERIC NOT NULL,
  intensity TEXT,
  pal NUMERIC,
  energy_kcal NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_therapy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN ('diabetes', 'ketogen', 'allergen', 'intoleranz')),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  targets JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_therapy_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cgm', 'pump', 'allergen')),
  status TEXT NOT NULL CHECK (status IN ('connected', 'pending', 'error')),
  vendor TEXT NOT NULL,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_procam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('low', 'moderate', 'high')),
  age NUMERIC NOT NULL,
  ldl NUMERIC NOT NULL,
  hdl NUMERIC NOT NULL,
  systolic NUMERIC NOT NULL,
  smoker BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_digital_protocol_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'received', 'expired')),
  url TEXT NOT NULL,
  qr_code TEXT NOT NULL,
  expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX patient_activities_patient_id_date_idx
  ON patient_activities(patient_id, date DESC);
CREATE INDEX patient_therapy_settings_patient_id_updated_at_idx
  ON patient_therapy_settings(patient_id, updated_at DESC);
CREATE INDEX patient_therapy_integrations_patient_id_created_at_idx
  ON patient_therapy_integrations(patient_id, created_at DESC);
CREATE INDEX patient_procam_results_patient_id_updated_at_idx
  ON patient_procam_results(patient_id, updated_at DESC);
CREATE INDEX patient_digital_protocol_links_patient_id_updated_at_idx
  ON patient_digital_protocol_links(patient_id, updated_at DESC);

CREATE TRIGGER patient_activities_updated_at
  BEFORE UPDATE ON patient_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER patient_therapy_settings_updated_at
  BEFORE UPDATE ON patient_therapy_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER patient_therapy_integrations_updated_at
  BEFORE UPDATE ON patient_therapy_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER patient_procam_results_updated_at
  BEFORE UPDATE ON patient_procam_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER patient_digital_protocol_links_updated_at
  BEFORE UPDATE ON patient_digital_protocol_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE patient_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_therapy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_therapy_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_procam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_digital_protocol_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_activities_read_own" ON patient_activities
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "patient_activities_insert_own" ON patient_activities
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_activities_update_own" ON patient_activities
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_activities_delete_own" ON patient_activities
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "patient_therapy_settings_read_own" ON patient_therapy_settings
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "patient_therapy_settings_insert_own" ON patient_therapy_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_therapy_settings_update_own" ON patient_therapy_settings
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_therapy_settings_delete_own" ON patient_therapy_settings
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "patient_therapy_integrations_read_own" ON patient_therapy_integrations
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "patient_therapy_integrations_insert_own" ON patient_therapy_integrations
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_therapy_integrations_update_own" ON patient_therapy_integrations
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_therapy_integrations_delete_own" ON patient_therapy_integrations
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "patient_procam_results_read_own" ON patient_procam_results
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "patient_procam_results_insert_own" ON patient_procam_results
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_procam_results_update_own" ON patient_procam_results
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_procam_results_delete_own" ON patient_procam_results
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "patient_digital_protocol_links_read_own" ON patient_digital_protocol_links
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "patient_digital_protocol_links_insert_own" ON patient_digital_protocol_links
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_digital_protocol_links_update_own" ON patient_digital_protocol_links
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_digital_protocol_links_delete_own" ON patient_digital_protocol_links
  FOR DELETE USING (user_id = auth.uid());
