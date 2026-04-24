-- ============================================================================
-- Team RBAC foundation
-- ============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'dietitian', 'assistant', 'institution_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE access_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX organizations_created_by_idx ON organizations(created_by);
CREATE INDEX organization_memberships_user_status_idx ON organization_memberships(user_id, status);
CREATE INDEX organization_memberships_org_role_idx ON organization_memberships(organization_id, role);
CREATE INDEX access_audit_logs_org_created_idx ON access_audit_logs(organization_id, created_at DESC);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER organization_memberships_updated_at
  BEFORE UPDATE ON organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_active_organization_member(target_organization_id UUID, target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = target_organization_id
      AND user_id = target_user_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_organization_admin(target_organization_id UUID, target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = target_organization_id
      AND user_id = target_user_id
      AND status = 'active'
      AND role IN ('owner', 'admin')
  );
$$;

CREATE POLICY "organizations_read_member" ON organizations
  FOR SELECT USING (created_by = auth.uid() OR is_active_organization_member(id, auth.uid()));

CREATE POLICY "organizations_insert_own" ON organizations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "organizations_update_admin" ON organizations
  FOR UPDATE USING (is_organization_admin(id, auth.uid()))
  WITH CHECK (is_organization_admin(id, auth.uid()));

CREATE POLICY "organization_memberships_read_same_org" ON organization_memberships
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_active_organization_member(organization_id, auth.uid())
  );

CREATE POLICY "organization_memberships_insert_self" ON organization_memberships
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND status = 'active'
    AND role = 'owner'
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = organization_memberships.organization_id
        AND organizations.created_by = auth.uid()
    )
  );

CREATE POLICY "organization_memberships_update_admin" ON organization_memberships
  FOR UPDATE USING (is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "access_audit_logs_read_admin" ON access_audit_logs
  FOR SELECT USING (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "access_audit_logs_insert_member" ON access_audit_logs
  FOR INSERT WITH CHECK (
    actor_user_id = auth.uid()
    AND is_active_organization_member(organization_id, auth.uid())
  );
