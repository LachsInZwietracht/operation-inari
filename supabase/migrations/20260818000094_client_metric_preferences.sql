-- ============================================================================
-- What I track, what I look at, and what my counselor gets to see.
--
-- Three switches per metric, decided by the client and nobody else:
--
--   tracked  the field appears in the check-in
--   shown    the metric appears in the Verlauf and in the pair picker
--   shared   the counselor may see it
--
-- `shared` is why this table exists at all. Consent is one flag on the link,
-- which answers "may they see check-in data"; this answers "which of it", and
-- that distinction is what makes a mood score enterable in the first place.
-- It can only ever narrow what `consent_wellbeing` already permits.
--
-- A row exists ONLY where the client departed from the registry default. No
-- row means "whatever `lib/client-metrics.ts` says", which keeps the table
-- proportional to actual decisions and lets a new metric appear for everyone
-- without a backfill. The accepted cost, stated plainly: changing a default in
-- code changes behaviour for every client who never touched that switch, so
-- defaults are changed deliberately and not in passing.
--
-- `metric_key` therefore has no foreign key — the registry lives in
-- TypeScript, and a metric that is removed from it simply stops being read.
-- ============================================================================

CREATE TABLE client_metric_preferences (
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL CHECK (length(trim(metric_key)) > 0),
  tracked BOOLEAN NOT NULL DEFAULT TRUE,
  shown BOOLEAN NOT NULL DEFAULT TRUE,
  shared BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_user_id, metric_key)
);

CREATE TRIGGER client_metric_preferences_updated_at
  BEFORE UPDATE ON client_metric_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE client_metric_preferences IS
  'Per-metric track/show/share switches. A missing row means the registry default in lib/client-metrics.ts.';

COMMENT ON COLUMN client_metric_preferences.shared IS
  'Narrows client_links.consent_wellbeing per metric. Never widens it — a false consent flag hides everything regardless.';

-- Owner-only, same shape as the check-in itself. The counselor never reads
-- these rows either; the sharing function applies them on the client's behalf.
ALTER TABLE client_metric_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_metric_preferences_select_own" ON client_metric_preferences
  FOR SELECT USING (client_user_id = auth.uid());

CREATE POLICY "client_metric_preferences_insert_own" ON client_metric_preferences
  FOR INSERT WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_metric_preferences_update_own" ON client_metric_preferences
  FOR UPDATE USING (client_user_id = auth.uid())
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_metric_preferences_delete_own" ON client_metric_preferences
  FOR DELETE USING (client_user_id = auth.uid());
