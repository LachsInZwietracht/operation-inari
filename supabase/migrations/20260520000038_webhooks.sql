CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  url TEXT NOT NULL CHECK (url ~ '^https://'),
  secret_prefix TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    array_length(events, 1) IS NULL
    OR events <@ ARRAY[
      'dataset_export_created',
      'report_export_created',
      'digital_protocol_submission_received'
    ]::TEXT[]
  )
);

CREATE TABLE webhook_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  webhook_endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN (
    'dataset_export_created',
    'report_export_created',
    'digital_protocol_submission_received'
  )),
  target_type TEXT NOT NULL,
  target_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'delivered', 'failed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX webhook_endpoints_org_status_idx
  ON webhook_endpoints(organization_id, status, created_at DESC);

CREATE INDEX webhook_endpoints_events_idx
  ON webhook_endpoints USING GIN(events);

CREATE INDEX webhook_delivery_attempts_org_created_idx
  ON webhook_delivery_attempts(organization_id, created_at DESC);

CREATE INDEX webhook_delivery_attempts_endpoint_created_idx
  ON webhook_delivery_attempts(webhook_endpoint_id, created_at DESC);

CREATE INDEX webhook_delivery_attempts_status_next_idx
  ON webhook_delivery_attempts(status, next_attempt_at);

CREATE TRIGGER webhook_endpoints_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER webhook_delivery_attempts_updated_at
  BEFORE UPDATE ON webhook_delivery_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_endpoints_read_admin" ON webhook_endpoints
  FOR SELECT USING (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "webhook_endpoints_insert_admin" ON webhook_endpoints
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND is_organization_admin(organization_id, auth.uid())
  );

CREATE POLICY "webhook_endpoints_update_admin" ON webhook_endpoints
  FOR UPDATE USING (is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "webhook_endpoints_delete_admin" ON webhook_endpoints
  FOR DELETE USING (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "webhook_delivery_attempts_read_admin" ON webhook_delivery_attempts
  FOR SELECT USING (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "webhook_delivery_attempts_insert_admin" ON webhook_delivery_attempts
  FOR INSERT WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "webhook_delivery_attempts_update_admin" ON webhook_delivery_attempts
  FOR UPDATE USING (is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));
