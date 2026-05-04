CREATE TABLE organization_sso_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('oidc', 'saml')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'disabled')),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  domains TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  issuer_url TEXT,
  metadata_url TEXT,
  metadata_xml TEXT,
  client_id TEXT,
  entity_id TEXT,
  sso_url TEXT,
  login_hint_parameter TEXT NOT NULL DEFAULT 'login_hint',
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (array_length(domains, 1) IS NOT NULL),
  CHECK (
    provider_type = 'oidc'
    OR metadata_url IS NOT NULL
    OR metadata_xml IS NOT NULL
    OR sso_url IS NOT NULL
  ),
  CHECK (
    provider_type = 'saml'
    OR issuer_url IS NOT NULL
    OR metadata_url IS NOT NULL
  )
);

CREATE INDEX organization_sso_configs_org_status_idx
  ON organization_sso_configs(organization_id, status, created_at DESC);

CREATE INDEX organization_sso_configs_domains_idx
  ON organization_sso_configs USING GIN(domains);

CREATE TRIGGER organization_sso_configs_updated_at
  BEFORE UPDATE ON organization_sso_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE organization_sso_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_sso_configs_read_admin" ON organization_sso_configs
  FOR SELECT USING (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "organization_sso_configs_insert_admin" ON organization_sso_configs
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND is_organization_admin(organization_id, auth.uid())
  );

CREATE POLICY "organization_sso_configs_update_admin" ON organization_sso_configs
  FOR UPDATE USING (is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "organization_sso_configs_delete_admin" ON organization_sso_configs
  FOR DELETE USING (is_organization_admin(organization_id, auth.uid()));
