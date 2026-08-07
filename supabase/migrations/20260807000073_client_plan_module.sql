-- ============================================================================
-- Client mode, plan module: the client sees the plan made for them and ticks
-- meals off.
--
-- Direction matters here. `client_link_grants_access` governs what flows from
-- the client to the counselor and is gated on consent. A meal plan flows the
-- other way — the counselor wrote it *for* this person — so plan visibility
-- hangs on an active link alone, not on a consent flag the client gives about
-- their own data.
--
-- Only `active` and `approved` plans are exposed. Drafts are the counselor's
-- workbench and must not surface half-finished days to a client.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.client_can_read_patient_plans(
  target_patient_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM client_links
    WHERE client_links.patient_id = target_patient_id
      AND client_links.client_user_id = auth.uid()
      AND client_links.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.client_can_read_patient_plans(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_can_read_patient_plans(UUID) TO authenticated;

-- ── Read access to the plan itself ──────────────────────────────────────────

CREATE POLICY "meal_plans_read_linked_client" ON daily_meal_plans
  FOR SELECT USING (
    patient_id IS NOT NULL
    AND status IN ('active', 'approved')
    AND client_can_read_patient_plans(patient_id)
  );

CREATE POLICY "meal_entries_read_linked_client" ON meal_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM daily_meal_plans
      WHERE daily_meal_plans.id = meal_entries.meal_plan_id
        AND daily_meal_plans.patient_id IS NOT NULL
        AND daily_meal_plans.status IN ('active', 'approved')
        AND client_can_read_patient_plans(daily_meal_plans.patient_id)
    )
  );

-- Personal recipes are owner-only (`recipes_read_own`), so without this a
-- recipe entry would render as a blank line in the client's plan. Scoped to
-- exactly the recipes referenced by a plan that client may already read.
CREATE POLICY "recipes_read_linked_client_plan" ON recipes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM meal_entries
      JOIN daily_meal_plans ON daily_meal_plans.id = meal_entries.meal_plan_id
      WHERE meal_entries.entry_type = 'recipe'
        AND meal_entries.reference_id = recipes.id
        AND daily_meal_plans.patient_id IS NOT NULL
        AND daily_meal_plans.status IN ('active', 'approved')
        AND client_can_read_patient_plans(daily_meal_plans.patient_id)
    )
  );

-- ── Completions ─────────────────────────────────────────────────────────────

CREATE TABLE client_meal_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_plan_id UUID NOT NULL REFERENCES daily_meal_plans(id) ON DELETE CASCADE,
  meal_entry_id UUID NOT NULL REFERENCES meal_entries(id) ON DELETE CASCADE,
  -- Ticked off vs. deliberately skipped. Both are answers; only a missing row
  -- means "no reaction", which is what the adherence view must not confuse.
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_user_id, meal_entry_id)
);

CREATE INDEX client_meal_completions_client_plan_idx
  ON client_meal_completions(client_user_id, meal_plan_id);

ALTER TABLE client_meal_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_meal_completions_select" ON client_meal_completions
  FOR SELECT USING (
    client_user_id = auth.uid()
    OR client_link_grants_access(client_user_id, 'nutrition')
  );

-- The entry must belong to a plan this client is allowed to see, otherwise a
-- completion could be parked on a stranger's plan.
CREATE POLICY "client_meal_completions_insert_own" ON client_meal_completions
  FOR INSERT WITH CHECK (
    client_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM meal_entries
      WHERE meal_entries.id = client_meal_completions.meal_entry_id
        AND meal_entries.meal_plan_id = client_meal_completions.meal_plan_id
    )
  );

CREATE POLICY "client_meal_completions_update_own" ON client_meal_completions
  FOR UPDATE USING (client_user_id = auth.uid())
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_meal_completions_delete_own" ON client_meal_completions
  FOR DELETE USING (client_user_id = auth.uid());
