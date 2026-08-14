-- ============================================================================
-- Let the client write down what the scale said.
--
-- Everything the client surface has written so far belonged to the client:
-- their diary, their workouts, their saved meals. A weigh-in does not. It
-- lands in `patient_anthropometrics`, the counselor's record, next to rows a
-- professional measured — so this is a function and not a policy. An INSERT
-- policy on that table would have to be written so tightly that it ends up
-- being this function anyway, minus the ability to say why it refused.
--
-- Three things it has to get right:
--
--   * `height` and `bmi` are NOT NULL on that table, and a client standing on
--     a bathroom scale supplies neither. Height is carried forward from the
--     most recent measurement; without one, the caller is told to ask, rather
--     than a default being invented for a real person's record.
--   * A counselor's measurement is never overwritten. Only a row this client
--     wrote themselves on the same date is updated — a second weigh-in on a
--     Tuesday is a correction, not a new fact.
--   * The counselor must be able to tell the two apart, hence
--     `recorded_by_client`. A self-reported weight and one taken in the
--     practice are different evidence and should not silently merge.
-- ============================================================================

ALTER TABLE patient_anthropometrics
  ADD COLUMN IF NOT EXISTS recorded_by_client BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN patient_anthropometrics.recorded_by_client IS
  'TRUE when the linked client entered this themselves through client mode, rather than it being measured in the practice.';

CREATE OR REPLACE FUNCTION public.client_record_weight(
  weight_kg NUMERIC,
  measured_on DATE DEFAULT NULL,
  -- Only needed the first time, or when it changed. NULL carries the last
  -- known height forward.
  height_cm NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_patient UUID;
  owner_user UUID;
  resolved_height NUMERIC;
  resolved_date DATE;
  existing_id UUID;
  resolved_bmi NUMERIC;
  result JSONB;
BEGIN
  IF weight_kg IS NULL OR weight_kg < 20 OR weight_kg > 400 THEN
    RAISE EXCEPTION 'weight_out_of_range';
  END IF;
  IF height_cm IS NOT NULL AND (height_cm < 80 OR height_cm > 250) THEN
    RAISE EXCEPTION 'height_out_of_range';
  END IF;

  -- The same link rule the rest of client mode uses: most recently consented
  -- active link, one patient record.
  SELECT l.patient_id, p.user_id
  INTO target_patient, owner_user
  FROM client_links l
  JOIN patients p ON p.id = l.patient_id
  WHERE l.client_user_id = auth.uid()
    AND l.status = 'active'
  ORDER BY l.consented_at DESC NULLS LAST, l.created_at DESC
  LIMIT 1;

  IF target_patient IS NULL THEN
    RAISE EXCEPTION 'no_active_link';
  END IF;

  -- The date comes from the caller because the app's day boundary is
  -- Europe/Berlin and the database's is not.
  resolved_date := COALESCE(measured_on, CURRENT_DATE);

  resolved_height := height_cm;
  IF resolved_height IS NULL THEN
    SELECT a.height INTO resolved_height
    FROM patient_anthropometrics a
    WHERE a.patient_id = target_patient
      AND a.height IS NOT NULL
    ORDER BY a.date DESC
    LIMIT 1;
  END IF;

  IF resolved_height IS NULL THEN
    -- Signalled rather than guessed: the caller turns this into a question.
    RAISE EXCEPTION 'height_unknown';
  END IF;

  resolved_bmi := round(weight_kg / ((resolved_height / 100) ^ 2), 1);

  SELECT a.id INTO existing_id
  FROM patient_anthropometrics a
  WHERE a.patient_id = target_patient
    AND a.date = resolved_date
    AND a.recorded_by_client
  LIMIT 1;

  IF existing_id IS NULL THEN
    INSERT INTO patient_anthropometrics
      (patient_id, user_id, date, weight, height, bmi, recorded_by_client)
    VALUES
      (target_patient, owner_user, resolved_date, weight_kg, resolved_height, resolved_bmi, TRUE)
    RETURNING id INTO existing_id;
  ELSE
    UPDATE patient_anthropometrics
    SET weight = weight_kg,
        height = resolved_height,
        bmi = resolved_bmi,
        updated_at = now()
    WHERE id = existing_id;
  END IF;

  SELECT jsonb_build_object(
    'id', a.id,
    'date', a.date,
    'weight', a.weight,
    'height', a.height,
    'bmi', a.bmi
  )
  INTO result
  FROM patient_anthropometrics a
  WHERE a.id = existing_id;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.client_record_weight(NUMERIC, DATE, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.client_record_weight(NUMERIC, DATE, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.client_record_weight(NUMERIC, DATE, NUMERIC) TO authenticated;

COMMENT ON FUNCTION public.client_record_weight(NUMERIC, DATE, NUMERIC) IS
  'Records a self-reported weight for the calling client''s linked patient. Carries the last known height forward, never overwrites a measurement taken in the practice, and marks the row recorded_by_client.';
