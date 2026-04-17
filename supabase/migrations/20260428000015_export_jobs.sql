CREATE TABLE export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('export', 'import')),
  format TEXT NOT NULL CHECK (format IN ('CSV', 'JSON', 'PDF')),
  scope TEXT NOT NULL CHECK (scope IN ('Lebensmittel', 'Rezepte', 'Patienten', 'Ernährungspläne', 'Berichte')),
  status TEXT NOT NULL CHECK (status IN ('abgeschlossen', 'in Bearbeitung', 'fehlgeschlagen')) DEFAULT 'abgeschlossen',
  file_size TEXT,
  created_by TEXT NOT NULL,
  file_name TEXT,
  parameters JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX export_jobs_user_created_at_idx ON export_jobs(user_id, created_at DESC);

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export_jobs_read_own" ON export_jobs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "export_jobs_insert_own" ON export_jobs
  FOR INSERT WITH CHECK (user_id = auth.uid());
