-- Make plan handoff explicit and immutable.
--
-- A released plan remains the client-visible truth. Later work happens in a
-- separate draft for the same patient/date; releasing that draft atomically
-- archives the former release as a replaced revision.

ALTER TABLE daily_meal_plans
  ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 1
    CHECK (revision_number > 0),
  ADD COLUMN IF NOT EXISTS supersedes_plan_id UUID
    REFERENCES daily_meal_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ;

DROP INDEX IF EXISTS daily_meal_plans_user_patient_date_unique_idx;

CREATE UNIQUE INDEX daily_meal_plans_user_patient_date_draft_unique_idx
  ON daily_meal_plans(user_id, patient_id, date)
  WHERE patient_id IS NOT NULL AND status = 'draft';

CREATE UNIQUE INDEX daily_meal_plans_user_patient_date_release_unique_idx
  ON daily_meal_plans(user_id, patient_id, date)
  WHERE patient_id IS NOT NULL AND status IN ('active', 'approved');

CREATE UNIQUE INDEX daily_meal_plans_patient_date_revision_unique_idx
  ON daily_meal_plans(user_id, patient_id, date, revision_number)
  WHERE patient_id IS NOT NULL;

CREATE UNIQUE INDEX daily_meal_plans_supersedes_unique_idx
  ON daily_meal_plans(supersedes_plan_id)
  WHERE supersedes_plan_id IS NOT NULL;

CREATE INDEX daily_meal_plans_revision_chain_idx
  ON daily_meal_plans(user_id, patient_id, date, revision_number DESC);

-- Direct writes may only mutate drafts. Released rows and their entries can be
-- changed only by the narrowly scoped functions below, preserving the exact
-- handoff and any completion records attached to its entry ids.
DROP POLICY IF EXISTS "meal_plans_update_own" ON daily_meal_plans;
CREATE POLICY "meal_plans_update_own_draft" ON daily_meal_plans
  FOR UPDATE USING (
    user_id = auth.uid()
    AND status = 'draft'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('draft', 'archived')
  );

DROP POLICY IF EXISTS "meal_plans_delete_own" ON daily_meal_plans;
CREATE POLICY "meal_plans_delete_own_editable" ON daily_meal_plans
  FOR DELETE USING (
    user_id = auth.uid()
    AND (
      status = 'draft'
      OR (
        status = 'archived'
        AND replaced_at IS NULL
        AND approved_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "meal_entries_insert_own" ON meal_entries;
CREATE POLICY "meal_entries_insert_own_draft" ON meal_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_meal_plans
      WHERE daily_meal_plans.id = meal_entries.meal_plan_id
        AND daily_meal_plans.user_id = auth.uid()
        AND daily_meal_plans.status = 'draft'
    )
  );

DROP POLICY IF EXISTS "meal_entries_update_own" ON meal_entries;
CREATE POLICY "meal_entries_update_own_draft" ON meal_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM daily_meal_plans
      WHERE daily_meal_plans.id = meal_entries.meal_plan_id
        AND daily_meal_plans.user_id = auth.uid()
        AND daily_meal_plans.status = 'draft'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_meal_plans
      WHERE daily_meal_plans.id = meal_entries.meal_plan_id
        AND daily_meal_plans.user_id = auth.uid()
        AND daily_meal_plans.status = 'draft'
    )
  );

DROP POLICY IF EXISTS "meal_entries_delete_own" ON meal_entries;
CREATE POLICY "meal_entries_delete_own_draft" ON meal_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM daily_meal_plans
      WHERE daily_meal_plans.id = meal_entries.meal_plan_id
        AND daily_meal_plans.user_id = auth.uid()
        AND daily_meal_plans.status = 'draft'
    )
  );

CREATE OR REPLACE FUNCTION public.begin_meal_plan_revision(source_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  source_plan daily_meal_plans%ROWTYPE;
  existing_draft_id UUID;
  new_plan_id UUID;
  next_revision INTEGER;
BEGIN
  SELECT * INTO source_plan
  FROM daily_meal_plans
  WHERE id = source_plan_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND';
  END IF;
  IF source_plan.patient_id IS NULL THEN
    RAISE EXCEPTION 'PATIENT_REQUIRED';
  END IF;
  IF source_plan.status NOT IN ('active', 'approved') THEN
    RAISE EXCEPTION 'PLAN_NOT_RELEASED';
  END IF;

  SELECT id INTO existing_draft_id
  FROM daily_meal_plans
  WHERE user_id = source_plan.user_id
    AND patient_id = source_plan.patient_id
    AND date = source_plan.date
    AND status = 'draft'
  LIMIT 1;

  IF existing_draft_id IS NOT NULL THEN
    RETURN existing_draft_id;
  END IF;

  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO next_revision
  FROM daily_meal_plans
  WHERE user_id = source_plan.user_id
    AND patient_id = source_plan.patient_id
    AND date = source_plan.date;

  INSERT INTO daily_meal_plans (
    user_id,
    date,
    legacy_id,
    patient_id,
    title,
    status,
    notes,
    target_profile_id,
    diet_line_id,
    revision_number,
    supersedes_plan_id
  ) VALUES (
    source_plan.user_id,
    source_plan.date,
    NULL,
    source_plan.patient_id,
    source_plan.title,
    'draft',
    source_plan.notes,
    source_plan.target_profile_id,
    source_plan.diet_line_id,
    next_revision,
    source_plan.id
  ) RETURNING id INTO new_plan_id;

  INSERT INTO meal_entries (
    meal_plan_id,
    slot_type,
    entry_type,
    reference_id,
    amount,
    sort_order
  )
  SELECT
    new_plan_id,
    slot_type,
    entry_type,
    reference_id,
    amount,
    sort_order
  FROM meal_entries
  WHERE meal_plan_id = source_plan.id;

  RETURN new_plan_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_meal_plan_revision(target_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_plan daily_meal_plans%ROWTYPE;
  released_at TIMESTAMPTZ := now();
  snapshot JSONB;
  snapshot_version INTEGER;
BEGIN
  SELECT * INTO target_plan
  FROM daily_meal_plans
  WHERE id = target_plan_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND';
  END IF;
  IF target_plan.patient_id IS NULL THEN
    RAISE EXCEPTION 'PATIENT_REQUIRED';
  END IF;
  IF target_plan.status <> 'draft' THEN
    RAISE EXCEPTION 'PLAN_NOT_DRAFT';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM patients
    WHERE patients.id = target_plan.patient_id
      AND patients.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM meal_entries
    WHERE meal_entries.meal_plan_id = target_plan.id
  ) THEN
    RAISE EXCEPTION 'EMPTY_PLAN';
  END IF;

  UPDATE daily_meal_plans
  SET
    status = 'archived',
    replaced_at = released_at
  WHERE user_id = target_plan.user_id
    AND patient_id = target_plan.patient_id
    AND date = target_plan.date
    AND id <> target_plan.id
    AND status IN ('active', 'approved');

  UPDATE daily_meal_plans
  SET
    status = 'approved',
    approved_at = released_at,
    approved_by = auth.uid(),
    replaced_at = NULL
  WHERE id = target_plan.id;

  SELECT jsonb_build_object(
    'title', target_plan.title,
    'notes', target_plan.notes,
    'status', 'approved',
    'targetProfileId', target_plan.target_profile_id,
    'dietLineId', target_plan.diet_line_id,
    'approvedAt', released_at,
    'approvedBy', auth.uid(),
    'slots', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'type', slot.slot_type,
          'entries', COALESCE(entries.items, '[]'::jsonb)
        ) ORDER BY slot.sort_order
      )
      FROM (
        VALUES
          ('fruehstueck'::text, 0),
          ('snack_vormittag'::text, 1),
          ('mittagessen'::text, 2),
          ('snack_nachmittag'::text, 3),
          ('abendessen'::text, 4)
      ) AS slot(slot_type, sort_order)
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', meal_entries.id,
            'type', meal_entries.entry_type,
            'referenceId', meal_entries.reference_id,
            'amount', meal_entries.amount
          ) ORDER BY meal_entries.sort_order, meal_entries.id
        ) AS items
        FROM meal_entries
        WHERE meal_entries.meal_plan_id = target_plan.id
          AND meal_entries.slot_type = slot.slot_type
      ) entries ON TRUE
    ), '[]'::jsonb)
  ) INTO snapshot;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO snapshot_version
  FROM meal_plan_versions
  WHERE meal_plan_id = target_plan.id;

  INSERT INTO meal_plan_versions (
    meal_plan_id,
    version_number,
    snapshot,
    reason,
    created_by
  ) VALUES (
    target_plan.id,
    snapshot_version,
    snapshot,
    'approved',
    auth.uid()
  );

  RETURN target_plan.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_meal_plan_revision(target_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  archived_plan_id UUID;
BEGIN
  UPDATE daily_meal_plans
  SET status = 'archived'
  WHERE id = target_plan_id
    AND user_id = auth.uid()
    AND status IN ('draft', 'active', 'approved')
    AND replaced_at IS NULL
  RETURNING id INTO archived_plan_id;

  IF archived_plan_id IS NULL THEN
    RAISE EXCEPTION 'PLAN_NOT_ARCHIVABLE';
  END IF;

  RETURN archived_plan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_meal_plan_revision(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_meal_plan_revision(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_meal_plan_revision(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.begin_meal_plan_revision(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_meal_plan_revision(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_meal_plan_revision(UUID) TO authenticated;
