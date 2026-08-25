-- Release the seven persisted draft plans of one visible Monday-Sunday week as
-- one clinical handoff.  A weekly release deliberately does not create or fill
-- days: all seven dates must already exist, belong to the same patient and
-- contain at least one entry.  The advisory lock serializes two concurrent
-- release attempts for the same patient/week; row locks cover the individual
-- revision chains while prior releases are replaced.

CREATE OR REPLACE FUNCTION public.release_meal_plan_week_revision(
  target_patient_id UUID,
  target_week_start DATE,
  target_plan_ids UUID[]
)
RETURNS TABLE(plan_id UUID, plan_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  release_time TIMESTAMPTZ := now();
  target_plan daily_meal_plans%ROWTYPE;
  expected_date DATE;
  locked_count INTEGER;
  snapshot JSONB;
  snapshot_version INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF target_patient_id IS NULL THEN
    RAISE EXCEPTION 'PATIENT_REQUIRED';
  END IF;
  IF EXTRACT(ISODOW FROM target_week_start) <> 1 THEN
    RAISE EXCEPTION 'WEEK_MUST_START_ON_MONDAY';
  END IF;
  IF COALESCE(cardinality(target_plan_ids), 0) <> 7
    OR (SELECT count(DISTINCT item) FROM unnest(target_plan_ids) AS item) <> 7 THEN
    RAISE EXCEPTION 'WEEK_REQUIRES_SEVEN_DISTINCT_PLANS';
  END IF;

  -- A narrow lock means no concurrent request can replace just one of this
  -- week's dates while this transaction is validating its complete set.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(target_patient_id::text || ':' || target_week_start::text, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM patients
    WHERE id = target_patient_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND';
  END IF;

  -- Lock every revision row in scope, including a current release that a draft
  -- may replace.  This makes the replacement update below all-or-nothing.
  PERFORM id
  FROM daily_meal_plans
  WHERE user_id = auth.uid()
    AND patient_id = target_patient_id
    AND date >= target_week_start
    AND date < target_week_start + 7
  ORDER BY date, id
  FOR UPDATE;

  SELECT count(*) INTO locked_count
  FROM daily_meal_plans
  WHERE id = ANY(target_plan_ids)
    AND user_id = auth.uid()
    AND patient_id = target_patient_id
    AND status = 'draft';

  IF locked_count <> 7 THEN
    RAISE EXCEPTION 'WEEK_PLANS_NOT_RELEASABLE';
  END IF;

  FOR expected_date IN
    SELECT (target_week_start + series)::date FROM generate_series(0, 6) AS series
  LOOP
    SELECT * INTO target_plan
    FROM daily_meal_plans
    WHERE id = ANY(target_plan_ids)
      AND user_id = auth.uid()
      AND patient_id = target_patient_id
      AND date = expected_date
      AND status = 'draft';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'WEEK_DAY_MISSING_OR_NOT_DRAFT';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM meal_entries WHERE meal_plan_id = target_plan.id
    ) THEN
      RAISE EXCEPTION 'WEEK_DAY_EMPTY';
    END IF;
  END LOOP;

  -- Archive all former current releases first, so the existing partial unique
  -- index permits the seven successor approvals.  Any failure rolls all of
  -- these updates back with the transaction.
  UPDATE daily_meal_plans
  SET status = 'archived', replaced_at = release_time
  WHERE user_id = auth.uid()
    AND patient_id = target_patient_id
    AND date >= target_week_start
    AND date < target_week_start + 7
    AND id <> ALL(target_plan_ids)
    AND status IN ('active', 'approved');

  FOR target_plan IN
    SELECT *
    FROM daily_meal_plans
    WHERE id = ANY(target_plan_ids)
    ORDER BY date
  LOOP
    UPDATE daily_meal_plans
    SET
      status = 'approved',
      approved_at = release_time,
      approved_by = auth.uid(),
      replaced_at = NULL
    WHERE id = target_plan.id;

    SELECT jsonb_build_object(
      'title', target_plan.title,
      'notes', target_plan.notes,
      'status', 'approved',
      'targetProfileId', target_plan.target_profile_id,
      'dietLineId', target_plan.diet_line_id,
      'approvedAt', release_time,
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
      meal_plan_id, version_number, snapshot, reason, created_by
    ) VALUES (
      target_plan.id, snapshot_version, snapshot, 'approved', auth.uid()
    );

    plan_id := target_plan.id;
    plan_date := target_plan.date;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.release_meal_plan_week_revision(UUID, DATE, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_meal_plan_week_revision(UUID, DATE, UUID[]) TO authenticated;
