-- ============================================================================
-- The counselor's only way into the check-in.
--
-- `client_daily_checkins` has no SELECT policy for the counselor, on purpose.
-- Sharing here is decided per metric, and a metric is a column: RLS is
-- row-level and cannot express "may see wellbeing but not mood". So the read
-- path is this function, and it has three properties the table could not have.
--
--   * It returns LONG format — (date, metric_key, value) — so a metric the
--     client did not share produces no rows at all. There is no column to null
--     out and forget about.
--   * It enumerates the metrics explicitly. A column added to the table later
--     stays invisible here until someone adds it below, which is the right
--     default for health data.
--   * It states both gates in one place: the link must be active with
--     `consent_wellbeing`, and the per-metric switch must not have narrowed it.
--
-- Default when no preference row exists: SHARED. That mirrors
-- `lib/client-metrics.ts`, where every metric declares `shared: true` and a row
-- is written only when the client changes something. If a default there is ever
-- flipped to false, this COALESCE has to follow — the two are one decision
-- expressed twice, and the comment is here because nothing else enforces it.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.client_wellbeing_series(
  target_patient UUID,
  from_date DATE,
  to_date DATE
)
RETURNS TABLE (checkin_date DATE, metric_key TEXT, value NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_client UUID;
BEGIN
  -- Only ever resolves a link where the CALLER is the counselor, so an
  -- arbitrary patient id reveals nothing about anyone else's records.
  SELECT l.client_user_id
  INTO target_client
  FROM client_links l
  WHERE l.patient_id = target_patient
    AND l.counselor_user_id = auth.uid()
    AND l.status = 'active'
    AND l.consent_wellbeing
    AND l.client_user_id IS NOT NULL
  LIMIT 1;

  -- No link, no consent, or revoked: no rows, and no error either. "Nothing
  -- shared" is a normal state, not a failure.
  IF target_client IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.checkin_date, m.metric_key, m.value
  FROM client_daily_checkins c
  CROSS JOIN LATERAL (
    VALUES
      ('wellbeing', c.wellbeing::NUMERIC),
      ('energy', c.energy::NUMERIC),
      ('mood', c.mood::NUMERIC),
      ('digestion', c.digestion::NUMERIC),
      ('sleep_minutes', c.sleep_minutes::NUMERIC),
      ('sleep_quality', c.sleep_quality::NUMERIC),
      ('alcohol_units', c.alcohol_units::NUMERIC)
  ) AS m(metric_key, value)
  WHERE c.client_user_id = target_client
    AND c.checkin_date BETWEEN from_date AND to_date
    -- An unanswered value is not a low one and does not travel.
    AND m.value IS NOT NULL
    AND COALESCE(
      (
        SELECT p.shared
        FROM client_metric_preferences p
        WHERE p.client_user_id = target_client
          AND p.metric_key = m.metric_key
      ),
      TRUE
    )
  ORDER BY c.checkin_date, m.metric_key;
END;
$$;

REVOKE ALL ON FUNCTION public.client_wellbeing_series(UUID, DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.client_wellbeing_series(UUID, DATE, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.client_wellbeing_series(UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.client_wellbeing_series(UUID, DATE, DATE) IS
  'Check-in values a client shared with the calling counselor, in long format. Emits only metrics whose shared switch is on, and only where the link is active with consent_wellbeing.';
