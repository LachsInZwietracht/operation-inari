CREATE TABLE sso_group_role_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sso_config_id UUID NOT NULL REFERENCES organization_sso_configs(id) ON DELETE CASCADE,
  claim_name TEXT NOT NULL CHECK (length(trim(claim_name)) > 0),
  claim_value TEXT NOT NULL CHECK (length(trim(claim_value)) > 0),
  role TEXT NOT NULL CHECK (role IN ('admin', 'dietitian', 'assistant', 'institution_admin')),
  priority INTEGER NOT NULL DEFAULT 100 CHECK (priority >= 0 AND priority <= 10000),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sso_config_id, claim_name, claim_value)
);

CREATE INDEX sso_group_role_mappings_org_config_idx
  ON sso_group_role_mappings(organization_id, sso_config_id, status, priority ASC);

CREATE INDEX sso_group_role_mappings_claim_idx
  ON sso_group_role_mappings(sso_config_id, claim_name, claim_value);

CREATE TRIGGER sso_group_role_mappings_updated_at
  BEFORE UPDATE ON sso_group_role_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE sso_group_role_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sso_group_role_mappings_read_admin" ON sso_group_role_mappings
  FOR SELECT USING (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "sso_group_role_mappings_insert_admin" ON sso_group_role_mappings
  FOR INSERT WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM organization_sso_configs
      WHERE organization_sso_configs.id = sso_group_role_mappings.sso_config_id
        AND organization_sso_configs.organization_id = sso_group_role_mappings.organization_id
    )
  );

CREATE POLICY "sso_group_role_mappings_update_admin" ON sso_group_role_mappings
  FOR UPDATE USING (is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM organization_sso_configs
      WHERE organization_sso_configs.id = sso_group_role_mappings.sso_config_id
        AND organization_sso_configs.organization_id = sso_group_role_mappings.organization_id
    )
  );

CREATE POLICY "sso_group_role_mappings_delete_admin" ON sso_group_role_mappings
  FOR DELETE USING (is_organization_admin(organization_id, auth.uid()));
