-- Prepare one complete editable successor week without changing the currently
-- released client-facing week.  The operation is deliberately all-or-nothing:
-- a counselor either receives all seven cloned drafts or no new rows at all.

CREATE OR REPLACE FUNCTION public.begin_meal_plan_week_revision(
  target_patient_id UUID,
  target_week_start DATE
)
RETURNS TABLE(plan_id UUID, plan_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  expected_date DATE;
  source_plan daily_meal_plans%ROWTYPE;
  existing_draft daily_meal_plans%ROWTYPE;
  new_plan_id UUID;
  release_count INTEGER;
  draft_count INTEGER;
  next_revision INTEGER;
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

  -- One narrow lock serializes preparation and release of the same clinical
  -- week.  It also makes the idempotent "return the existing draft week"
  -- branch safe under two concurrent button presses.
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

  -- Lock every chain row for the seven dates before deciding whether an
  -- existing draft can be reused or successors need to be created.
  PERFORM id
  FROM daily_meal_plans
  WHERE user_id = auth.uid()
    AND patient_id = target_patient_id
    AND date >= target_week_start
    AND date < target_week_start + 7
  ORDER BY date, id
  FOR UPDATE;

  SELECT count(*) INTO release_count
  FROM daily_meal_plans
  WHERE user_id = auth.uid()
    AND patient_id = target_patient_id
    AND date >= target_week_start
    AND date < target_week_start + 7
    AND status IN ('active', 'approved');

  IF release_count <> 7 THEN
    RAISE EXCEPTION 'WEEK_REQUIRES_SEVEN_CURRENT_RELEASES';
  END IF;

  SELECT count(*) INTO draft_count
  FROM daily_meal_plans
  WHERE user_id = auth.uid()
    AND patient_id = target_patient_id
    AND date >= target_week_start
    AND date < target_week_start + 7
    AND status = 'draft';

  IF draft_count > 0 AND draft_count <> 7 THEN
    RAISE EXCEPTION 'WEEK_REVISION_DRAFT_INCOMPLETE';
  END IF;

  -- A complete successor week is the idempotent result.  It must be the
  -- successor of the current releases for exactly these seven dates; an
  -- unrelated draft week is intentionally not overwritten or adopted.
  IF draft_count = 7 THEN
    FOR expected_date IN
      SELECT (target_week_start + series)::date FROM generate_series(0, 6) AS series
    LOOP
      SELECT * INTO source_plan
      FROM daily_meal_plans
      WHERE user_id = auth.uid()
        AND patient_id = target_patient_id
        AND date = expected_date
        AND status IN ('active', 'approved');

      IF NOT FOUND THEN
        RAISE EXCEPTION 'WEEK_RELEASE_DAY_MISSING';
      END IF;

      SELECT * INTO existing_draft
      FROM daily_meal_plans
      WHERE user_id = auth.uid()
        AND patient_id = target_patient_id
        AND date = expected_date
        AND status = 'draft';

      IF NOT FOUND OR existing_draft.supersedes_plan_id IS DISTINCT FROM source_plan.id THEN
        RAISE EXCEPTION 'WEEK_REVISION_DRAFT_CONFLICT';
      END IF;

      plan_id := existing_draft.id;
      plan_date := existing_draft.date;
      RETURN NEXT;
    END LOOP;
    RETURN;
  END IF;

  FOR expected_date IN
    SELECT (target_week_start + series)::date FROM generate_series(0, 6) AS series
  LOOP
    SELECT * INTO source_plan
    FROM daily_meal_plans
    WHERE user_id = auth.uid()
      AND patient_id = target_patient_id
      AND date = expected_date
      AND status IN ('active', 'approved');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'WEEK_RELEASE_DAY_MISSING';
    END IF;

    SELECT COALESCE(MAX(revision_number), 0) + 1 INTO next_revision
    FROM daily_meal_plans
    WHERE user_id = auth.uid()
      AND patient_id = target_patient_id
      AND date = expected_date;

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

    plan_id := new_plan_id;
    plan_date := source_plan.date;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_meal_plan_week_revision(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_meal_plan_week_revision(UUID, DATE) TO authenticated;
