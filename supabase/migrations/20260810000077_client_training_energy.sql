-- ============================================================================
-- Client mode, training module: what a session cost.
--
-- Four columns, all nullable, because every session written before this
-- migration has none of them and an estimate is optional even afterwards — a
-- set log is still a set log without a stopwatch.
--
-- The energy figure itself is NOT stored. It is derived from these inputs the
-- same way progression is derived from the sets: one fewer thing to keep in
-- sync, and a correction to the duration corrects the number for free.
--
-- `body_weight_kg` is the one that looks redundant next to the measurement
-- history and is not. Energy expenditure scales with body weight, so a session
-- from six months ago must be costed against the weight of six months ago. The
-- alternative — looking up the nearest measurement at read time — makes the
-- number depend on a table this module does not own, and silently rewrites old
-- sessions every time someone steps on a scale.
--
-- `activity_kind` is a plain key, not an enum, for the same reason exercise
-- names are free text here: adding a sport should not be a migration. The
-- lookup table lives in lib/energy-expenditure.ts and falls back to a neutral
-- entry for anything it does not recognise.
-- ============================================================================

ALTER TABLE client_workout_sessions
  ADD COLUMN duration_minutes INTEGER
    CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 600)),
  ADD COLUMN activity_kind TEXT
    CHECK (activity_kind IS NULL OR length(trim(activity_kind)) > 0),
  ADD COLUMN intensity TEXT
    CHECK (intensity IS NULL OR intensity IN ('leicht', 'moderat', 'intensiv')),
  ADD COLUMN body_weight_kg NUMERIC
    CHECK (body_weight_kg IS NULL OR (body_weight_kg > 20 AND body_weight_kg < 400));

COMMENT ON COLUMN client_workout_sessions.body_weight_kg IS
  'Body weight the energy estimate was computed against, captured at logging time.';
