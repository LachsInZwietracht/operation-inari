-- ============================================================================
-- The overall wellbeing score goes; the three sub-scores stay.
--
-- The check-in shipped with a ten-step "wie ging es dir heute" plus three
-- optional five-step scores under a fold. Asked in that order, the overall
-- score is the one that gets answered and the three that explain it stay
-- empty — which leaves the evaluation with a number that moves and nothing to
-- read it against. So Energie, Stimmung and Verdauung are asked directly and
-- on by default, and the summary score is gone rather than sitting there
-- half-filled.
--
-- The column is DROPPED, not kept for later. A nullable column nobody writes
-- becomes a column somebody reads and finds empty; the feature is days old and
-- has never run outside development, so there is no history worth keeping.
--
-- The consent flag stays `consent_wellbeing` and the function stays
-- `client_wellbeing_series`. Both name the AREA — how the day went — not the
-- one score that just left it, and renaming a consent column is a migration
-- with a much worse failure mode than a name that reads slightly wide.
-- ============================================================================

ALTER TABLE client_daily_checkins DROP COLUMN wellbeing;

-- Same function, one row less in the LATERAL. It enumerates the metrics
-- explicitly on purpose, so this is the only place that has to follow.
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

-- Rows written under the split switches, where "tracken off" and "anzeigen on"
-- were two states of one metric. The settings write both columns together now,
-- and the app reads a row as visible only when both are true — so nothing has
-- to be rewritten here. The comment records why the pair still exists.
COMMENT ON COLUMN client_metric_preferences.tracked IS
  'Written together with `shown` — the settings offer one switch for both. Kept as two columns so rows written under the earlier split keep their meaning.';
