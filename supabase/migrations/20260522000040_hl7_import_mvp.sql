-- ============================================================================
-- HL7 v2 import MVP
-- ============================================================================

CREATE TABLE hl7_lab_parameter_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  hl7_identifier TEXT NOT NULL,
  hl7_text TEXT,
  hl7_coding_system TEXT NOT NULL DEFAULT '',
  parameter_id TEXT NOT NULL,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_system, hl7_identifier, hl7_coding_system)
);

CREATE TABLE hl7_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  message_control_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'parsed', 'needs_review', 'imported', 'failed')),
  raw_message_sha256 TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_system, message_control_id)
);

CREATE TABLE hl7_import_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES hl7_import_jobs(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('patient', 'patient_lab_value')),
  target_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('created', 'updated', 'skipped', 'needs_review', 'failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX hl7_lab_parameter_mappings_org_source_idx
  ON hl7_lab_parameter_mappings(organization_id, source_system, status);

CREATE INDEX hl7_import_jobs_org_created_idx
  ON hl7_import_jobs(organization_id, created_at DESC);

CREATE INDEX hl7_import_jobs_source_control_idx
  ON hl7_import_jobs(organization_id, source_system, message_control_id);

CREATE INDEX hl7_import_results_job_idx
  ON hl7_import_results(job_id, created_at);

CREATE TRIGGER hl7_lab_parameter_mappings_updated_at
  BEFORE UPDATE ON hl7_lab_parameter_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER hl7_import_jobs_updated_at
  BEFORE UPDATE ON hl7_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE hl7_lab_parameter_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl7_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl7_import_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hl7_lab_mappings_read_admin" ON hl7_lab_parameter_mappings
  FOR SELECT USING (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "hl7_lab_mappings_insert_admin" ON hl7_lab_parameter_mappings
  FOR INSERT WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "hl7_lab_mappings_update_admin" ON hl7_lab_parameter_mappings
  FOR UPDATE USING (is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "hl7_lab_mappings_delete_admin" ON hl7_lab_parameter_mappings
  FOR DELETE USING (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "hl7_import_jobs_read_admin" ON hl7_import_jobs
  FOR SELECT USING (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "hl7_import_jobs_insert_admin" ON hl7_import_jobs
  FOR INSERT WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "hl7_import_jobs_update_admin" ON hl7_import_jobs
  FOR UPDATE USING (is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "hl7_import_results_read_admin" ON hl7_import_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hl7_import_jobs
      WHERE hl7_import_jobs.id = hl7_import_results.job_id
        AND is_organization_admin(hl7_import_jobs.organization_id, auth.uid())
    )
  );

CREATE POLICY "hl7_import_results_insert_admin" ON hl7_import_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM hl7_import_jobs
      WHERE hl7_import_jobs.id = hl7_import_results.job_id
        AND is_organization_admin(hl7_import_jobs.organization_id, auth.uid())
    )
  );
