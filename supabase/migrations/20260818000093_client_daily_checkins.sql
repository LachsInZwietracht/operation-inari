-- ============================================================================
-- The day as the client experienced it.
--
-- The diary records what was eaten. This records how the day went — one
-- mandatory wellbeing score, three optional sub-scores, the night before it,
-- and alcohol. Together they are the other half of every question the client
-- surface exists to answer: not "how much protein" but "how much protein on
-- the days that felt good".
--
-- A separate table rather than more columns on `client_food_log_days`:
--
--   * A day can be rated without a single thing being logged. Hanging the
--     score off the food log would create diary days for people who only ever
--     answered "wie ging es dir heute", and then every diary query would have
--     to filter them back out.
--   * It needs its own consent area. Mood and sleep are health data with a
--     different weight than a list of foods, and `consent_nutrition` was
--     agreed for a food log.
--   * `client_food_log_days` belongs to the diary module. This belongs to the
--     check-in.
--
-- Every metric column is NULLABLE, and NULL means "not answered". It is never
-- a zero, never a low value, and nothing downstream may substitute one — the
-- same rule the micronutrient coverage work established for the diary.
--
-- Alcohol is counted in Standardgläser (10 g ethanol) and carries no energy.
-- The kcal of a beer come from the diary entry for that beer; a second energy
-- figure here would either double-count it or contradict it. `foods` has no
-- ethanol column, so the unit cannot be derived and is asked for directly —
-- the same reasoning that gave water its own column instead of a catalog item.
--
-- RLS here is OWNER-ONLY, and that is the deliberate part: unlike every other
-- client table, the counselor gets no SELECT policy at all. Sharing is decided
-- per metric (see `client_metric_preferences`), which is column-level
-- filtering, and a row-level policy cannot express "may see wellbeing but not
-- mood". The counselor path is a SECURITY DEFINER function that emits only the
-- shared metrics, added with the counselor UI.
-- ============================================================================

CREATE TABLE client_daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,

  -- The one score that is always asked. Ten steps because it is the series
  -- everything else is compared against, and five would flatten it.
  wellbeing SMALLINT CHECK (wellbeing IS NULL OR wellbeing BETWEEN 1 AND 10),

  -- The three that explain it. Five steps: they are answered in passing.
  energy SMALLINT CHECK (energy IS NULL OR energy BETWEEN 1 AND 5),
  mood SMALLINT CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
  digestion SMALLINT CHECK (digestion IS NULL OR digestion BETWEEN 1 AND 5),

  -- Belongs to the night ONTO this date, which is what the UI labels and what
  -- the evaluation relies on to keep cause directions apart.
  sleep_minutes INTEGER CHECK (sleep_minutes IS NULL OR sleep_minutes BETWEEN 0 AND 1440),
  sleep_quality SMALLINT CHECK (sleep_quality IS NULL OR sleep_quality BETWEEN 1 AND 5),

  -- Standardgläser à 10 g ethanol. A quantity, never an energy.
  alcohol_units NUMERIC(4,1) CHECK (alcohol_units IS NULL OR alcohol_units BETWEEN 0 AND 50),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_user_id, checkin_date)
);

CREATE INDEX client_daily_checkins_client_date_idx
  ON client_daily_checkins(client_user_id, checkin_date DESC);

CREATE TRIGGER client_daily_checkins_updated_at
  BEFORE UPDATE ON client_daily_checkins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE client_daily_checkins IS
  'One self-reported check-in per client per day. Owner-only: the counselor reads through client_wellbeing_series(), never this table, because sharing is decided per metric.';

COMMENT ON COLUMN client_daily_checkins.sleep_minutes IS
  'Sleep of the night ONTO checkin_date, not the night after it. NULL means not answered.';

COMMENT ON COLUMN client_daily_checkins.alcohol_units IS
  'Standardgläser (10 g ethanol). A quantity only — the energy comes from the diary entry for the drink.';

ALTER TABLE client_daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_daily_checkins_select_own" ON client_daily_checkins
  FOR SELECT USING (client_user_id = auth.uid());

CREATE POLICY "client_daily_checkins_insert_own" ON client_daily_checkins
  FOR INSERT WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_daily_checkins_update_own" ON client_daily_checkins
  FOR UPDATE USING (client_user_id = auth.uid())
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_daily_checkins_delete_own" ON client_daily_checkins
  FOR DELETE USING (client_user_id = auth.uid());

-- ============================================================================
-- The consent area
--
-- Wellbeing is its own area rather than an extension of `consent_nutrition`:
-- someone who agreed to share a food log has not thereby agreed to share how
-- they felt. The flag exists from here so that no read path can ever be built
-- against a coarser one.
-- ============================================================================

ALTER TABLE client_links
  ADD COLUMN consent_wellbeing BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN client_links.consent_wellbeing IS
  'Whether the counselor may see check-in data at all. The per-metric shared flag can only narrow this further, never widen it.';

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
            WHEN 'wellbeing' THEN client_links.consent_wellbeing
            ELSE FALSE
          END
  );
$$;
