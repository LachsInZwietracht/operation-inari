ALTER TABLE organization_memberships
  ADD COLUMN invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN invitation_expires_at TIMESTAMPTZ,
  ADD COLUMN revoked_at TIMESTAMPTZ;

CREATE INDEX organization_memberships_org_status_idx
  ON organization_memberships(organization_id, status, created_at DESC);

CREATE POLICY "organization_memberships_insert_admin_invites" ON organization_memberships
  FOR INSERT WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
    AND status = 'invited'
    AND invited_by = auth.uid()
  );
