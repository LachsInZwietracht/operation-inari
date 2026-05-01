CREATE TABLE report_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Standard-Aufbewahrung',
  retention_years INTEGER NOT NULL DEFAULT 10 CHECK (retention_years BETWEEN 1 AND 30),
  auto_delete_enabled BOOLEAN NOT NULL DEFAULT false,
  require_admin_approval BOOLEAN NOT NULL DEFAULT true,
  legal_hold_enabled BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX report_retention_policies_org_idx
  ON report_retention_policies(organization_id);

CREATE TRIGGER report_retention_policies_updated_at
  BEFORE UPDATE ON report_retention_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE report_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_retention_policies_read_own_or_org_admin" ON report_retention_policies
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND is_organization_admin(organization_id, auth.uid())
    )
  );

CREATE POLICY "report_retention_policies_insert_own" ON report_retention_policies
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      organization_id IS NULL
      OR is_organization_admin(organization_id, auth.uid())
    )
  );

CREATE POLICY "report_retention_policies_update_own_or_org_admin" ON report_retention_policies
  FOR UPDATE USING (
    user_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND is_organization_admin(organization_id, auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND is_organization_admin(organization_id, auth.uid())
    )
  );

ALTER TABLE patient_reports
  ADD COLUMN retention_policy_id UUID REFERENCES report_retention_policies(id) ON DELETE SET NULL,
  ADD COLUMN retention_until TIMESTAMPTZ,
  ADD COLUMN retention_status TEXT NOT NULL DEFAULT 'active'
    CHECK (retention_status IN ('active', 'legal_hold', 'deletion_review', 'expired')),
  ADD COLUMN retention_notes TEXT;

ALTER TABLE patient_report_versions
  ADD COLUMN retention_policy_id UUID REFERENCES report_retention_policies(id) ON DELETE SET NULL,
  ADD COLUMN retention_until TIMESTAMPTZ,
  ADD COLUMN retention_status TEXT NOT NULL DEFAULT 'active'
    CHECK (retention_status IN ('active', 'legal_hold', 'deletion_review', 'expired')),
  ADD COLUMN retention_notes TEXT;

CREATE INDEX patient_reports_user_retention_idx
  ON patient_reports(user_id, retention_until, retention_status);

CREATE INDEX patient_report_versions_user_retention_idx
  ON patient_report_versions(user_id, retention_until, retention_status);
