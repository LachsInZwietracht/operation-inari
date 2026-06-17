-- ============================================================================
-- Organization-level data source activation
-- ----------------------------------------------------------------------------
-- Lets owners/admins switch a connected food database on or off for their
-- organization. A source is treated as active unless an explicit row marks it
-- inactive, so the absence of a row preserves the prior default-on behaviour.
-- This is independent from tariff entitlement (`canAccessDataSource`): a source
-- must be entitled before it can be toggled.
-- ============================================================================

CREATE TABLE organization_data_source_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_id)
);

CREATE INDEX organization_data_source_settings_org_idx
  ON organization_data_source_settings(organization_id);

CREATE TRIGGER organization_data_source_settings_updated_at
  BEFORE UPDATE ON organization_data_source_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE organization_data_source_settings ENABLE ROW LEVEL SECURITY;

-- Any active member of the organization may read the activation state.
CREATE POLICY "organization_data_source_settings_read_member" ON organization_data_source_settings
  FOR SELECT USING (
    is_active_organization_member(organization_id, auth.uid())
  );

-- Only owners/admins may create activation rows.
CREATE POLICY "organization_data_source_settings_insert_admin" ON organization_data_source_settings
  FOR INSERT WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
  );

-- Only owners/admins may flip the activation state.
CREATE POLICY "organization_data_source_settings_update_admin" ON organization_data_source_settings
  FOR UPDATE USING (
    is_organization_admin(organization_id, auth.uid())
  )
  WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
  );
