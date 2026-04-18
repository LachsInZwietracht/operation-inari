-- Appointments table for practice calendar
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  patient_id TEXT,
  location TEXT,
  type TEXT NOT NULL CHECK (type IN ('beratung', 'kontrolle', 'team', 'webinar')),
  recurring TEXT,
  reminder TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX appointments_user_id_idx ON appointments(user_id);
CREATE INDEX appointments_date_idx ON appointments(date);
CREATE INDEX appointments_type_idx ON appointments(type);
CREATE INDEX appointments_patient_id_idx ON appointments(patient_id);

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_read_own"   ON appointments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "appointments_insert_own" ON appointments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "appointments_update_own" ON appointments FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "appointments_delete_own" ON appointments FOR DELETE USING (user_id = auth.uid());
