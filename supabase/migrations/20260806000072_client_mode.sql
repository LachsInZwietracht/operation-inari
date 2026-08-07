-- ============================================================================
-- Client mode: client accounts alongside counselor accounts.
--
-- A client is not a new account type. Any auth user can be the client of
-- another user, so a dietitian can also be someone else's client without a
-- second identity. `client_links` binds a counselor-owned patient record to
-- the client's own account.
--
-- Ownership rule: tracking data belongs to the CLIENT (`client_user_id`),
-- never to the patient record. A client may switch or add counselors without
-- losing their history, and a deleted patient record never deletes the
-- client's own log. Counselors get READ-ONLY access through an active link
-- that carries consent.
--
-- Write model for `client_links`: RLS grants SELECT only. Every mutation
-- (invite, redeem, consent change, revoke) goes through a server action with
-- the service-role client, which validates the caller. This keeps a client
-- from rewriting link ownership columns, which column-blind RLS cannot
-- prevent. Same precedent as digital protocol submissions.
-- ============================================================================

CREATE TABLE client_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  counselor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- NULL until the invite is redeemed.
  client_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_code TEXT NOT NULL UNIQUE,
  invite_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'active', 'revoked')),
  consent_nutrition BOOLEAN NOT NULL DEFAULT FALSE,
  consent_training BOOLEAN NOT NULL DEFAULT FALSE,
  consented_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- An active link must know its client; an open invite must not have one.
  CONSTRAINT client_links_status_client_check CHECK (
    (status = 'active' AND client_user_id IS NOT NULL)
    OR (status = 'invited' AND client_user_id IS NULL)
    OR status = 'revoked'
  )
);

-- One open or active link per patient record; revoked ones stay for history.
CREATE UNIQUE INDEX client_links_patient_open_idx
  ON client_links(patient_id)
  WHERE status <> 'revoked';

CREATE INDEX client_links_counselor_status_idx
  ON client_links(counselor_user_id, status);

CREATE INDEX client_links_client_status_idx
  ON client_links(client_user_id, status)
  WHERE client_user_id IS NOT NULL;

CREATE TRIGGER client_links_updated_at
  BEFORE UPDATE ON client_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Client-owned food log
-- ============================================================================

CREATE TABLE client_food_log_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_user_id, log_date)
);

CREATE INDEX client_food_log_days_client_date_idx
  ON client_food_log_days(client_user_id, log_date DESC);

CREATE TRIGGER client_food_log_days_updated_at
  BEFORE UPDATE ON client_food_log_days
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- `client_user_id` is denormalized from the day so entry policies never need a
-- join, and so a misrouted entry cannot leak through the day's policy.
CREATE TABLE client_food_log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES client_food_log_days(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_type TEXT NOT NULL
    CHECK (slot_type IN ('fruehstueck', 'snack_vormittag', 'mittagessen', 'snack_nachmittag', 'abendessen')),
  -- 'custom' carries products the catalog does not know (manual entry today,
  -- barcode scans later) as inline nutrients per 100 g.
  source_type TEXT NOT NULL DEFAULT 'food'
    CHECK (source_type IN ('food', 'custom')),
  food_id UUID REFERENCES foods(id),
  custom_name TEXT,
  custom_nutrients JSONB,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_food_log_entries_reference_check CHECK (
    (source_type = 'food' AND food_id IS NOT NULL)
    OR (source_type = 'custom' AND custom_name IS NOT NULL)
  )
);

CREATE INDEX client_food_log_entries_day_idx
  ON client_food_log_entries(day_id, slot_type, sort_order);

CREATE INDEX client_food_log_entries_client_idx
  ON client_food_log_entries(client_user_id);

-- ============================================================================
-- Access helper
--
-- SECURITY DEFINER so the predicate does not depend on the caller's ability to
-- read `client_links`. It only ever reports on links where the CALLER is the
-- counselor, so an arbitrary `target_client_user_id` reveals nothing.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.client_link_grants_access(
  target_client_user_id UUID,
  area TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM client_links
    WHERE client_links.client_user_id = target_client_user_id
      AND client_links.counselor_user_id = auth.uid()
      AND client_links.status = 'active'
      AND CASE area
            WHEN 'nutrition' THEN client_links.consent_nutrition
            WHEN 'training' THEN client_links.consent_training
            ELSE FALSE
          END
  );
$$;

REVOKE ALL ON FUNCTION public.client_link_grants_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_link_grants_access(UUID, TEXT) TO authenticated;

-- ============================================================================
-- Row level security
-- ============================================================================

ALTER TABLE client_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_food_log_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_food_log_entries ENABLE ROW LEVEL SECURITY;

-- Both sides of a link can read it. No INSERT/UPDATE/DELETE policies: all
-- writes are validated server-side (see table comment).
CREATE POLICY "client_links_select_participants" ON client_links
  FOR SELECT USING (
    counselor_user_id = auth.uid()
    OR client_user_id = auth.uid()
  );

CREATE POLICY "client_food_log_days_select" ON client_food_log_days
  FOR SELECT USING (
    client_user_id = auth.uid()
    OR client_link_grants_access(client_user_id, 'nutrition')
  );

CREATE POLICY "client_food_log_days_insert_own" ON client_food_log_days
  FOR INSERT WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_food_log_days_update_own" ON client_food_log_days
  FOR UPDATE USING (client_user_id = auth.uid())
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_food_log_days_delete_own" ON client_food_log_days
  FOR DELETE USING (client_user_id = auth.uid());

CREATE POLICY "client_food_log_entries_select" ON client_food_log_entries
  FOR SELECT USING (
    client_user_id = auth.uid()
    OR client_link_grants_access(client_user_id, 'nutrition')
  );

-- The day must belong to the same client, otherwise an entry could be parked
-- under someone else's day.
CREATE POLICY "client_food_log_entries_insert_own" ON client_food_log_entries
  FOR INSERT WITH CHECK (
    client_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM client_food_log_days
      WHERE client_food_log_days.id = client_food_log_entries.day_id
        AND client_food_log_days.client_user_id = auth.uid()
    )
  );

CREATE POLICY "client_food_log_entries_update_own" ON client_food_log_entries
  FOR UPDATE USING (client_user_id = auth.uid())
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_food_log_entries_delete_own" ON client_food_log_entries
  FOR DELETE USING (client_user_id = auth.uid());
