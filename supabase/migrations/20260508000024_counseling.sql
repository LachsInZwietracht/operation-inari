-- ============================================================================
-- Counseling Sessions and Templates
-- ============================================================================

CREATE TABLE counseling_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  session_type TEXT NOT NULL,
  indication TEXT NOT NULL,
  goals TEXT,
  content TEXT NOT NULL,
  recommendations TEXT,
  next_appointment DATE,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX counseling_sessions_user_id_idx ON counseling_sessions(user_id);
CREATE INDEX counseling_sessions_patient_id_date_idx ON counseling_sessions(patient_id, session_date DESC);

CREATE TABLE counseling_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  session_type TEXT NOT NULL,
  indication TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX counseling_templates_user_id_idx ON counseling_templates(user_id);
CREATE INDEX counseling_templates_type_idx ON counseling_templates(user_id, session_type, indication);

CREATE TRIGGER counseling_sessions_updated_at
  BEFORE UPDATE ON counseling_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER counseling_templates_updated_at
  BEFORE UPDATE ON counseling_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE counseling_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE counseling_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "counseling_sessions_read_own" ON counseling_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "counseling_sessions_insert_own" ON counseling_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "counseling_sessions_update_own" ON counseling_sessions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "counseling_sessions_delete_own" ON counseling_sessions
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "counseling_templates_read_own" ON counseling_templates
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "counseling_templates_insert_own" ON counseling_templates
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "counseling_templates_update_own" ON counseling_templates
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "counseling_templates_delete_own" ON counseling_templates
  FOR DELETE USING (user_id = auth.uid());
