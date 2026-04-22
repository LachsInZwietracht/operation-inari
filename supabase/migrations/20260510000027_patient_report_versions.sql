ALTER TABLE patient_reports
  ADD COLUMN latest_version_id UUID,
  ADD COLUMN latest_version_number INTEGER NOT NULL DEFAULT 0;

CREATE TABLE patient_report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_report_id UUID NOT NULL REFERENCES patient_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_ref TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  patient_indication TEXT,
  title TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  protocol_id TEXT,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  format TEXT NOT NULL CHECK (format IN ('CSV', 'PDF')),
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  content_type TEXT NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX patient_report_versions_report_version_idx
  ON patient_report_versions(patient_report_id, version_number);

CREATE INDEX patient_report_versions_user_patient_exported_idx
  ON patient_report_versions(user_id, patient_ref, exported_at DESC);

CREATE INDEX patient_report_versions_user_report_exported_idx
  ON patient_report_versions(user_id, patient_report_id, exported_at DESC);

ALTER TABLE patient_reports
  ADD CONSTRAINT patient_reports_latest_version_id_fkey
  FOREIGN KEY (latest_version_id) REFERENCES patient_report_versions(id) ON DELETE SET NULL;

ALTER TABLE patient_report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_report_versions_read_own" ON patient_report_versions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "patient_report_versions_insert_own" ON patient_report_versions
  FOR INSERT WITH CHECK (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-report-files',
  'patient-report-files',
  false,
  52428800,
  ARRAY['application/pdf', 'text/csv', 'text/csv;charset=utf-8']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "patient_report_files_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'patient-report-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "patient_report_files_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'patient-report-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
