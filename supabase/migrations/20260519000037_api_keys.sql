CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  last_used_ip TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    array_length(scopes, 1) IS NULL
    OR scopes <@ ARRAY['exports:datasets:read']::TEXT[]
  )
);

CREATE INDEX api_keys_org_created_idx ON api_keys(organization_id, created_at DESC);
CREATE INDEX api_keys_user_idx ON api_keys(user_id);
CREATE INDEX api_keys_token_hash_idx ON api_keys(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX api_keys_active_idx ON api_keys(organization_id, revoked_at, expires_at);

CREATE TRIGGER api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_read_admin" ON api_keys
  FOR SELECT USING (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "api_keys_insert_admin" ON api_keys
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND is_organization_admin(organization_id, auth.uid())
  );

CREATE POLICY "api_keys_update_admin" ON api_keys
  FOR UPDATE USING (is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "api_keys_delete_admin" ON api_keys
  FOR DELETE USING (is_organization_admin(organization_id, auth.uid()));
