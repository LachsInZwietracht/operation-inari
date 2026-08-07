-- ============================================================================
-- Client mode, training module: the client logs what they did and sees whether
-- they got stronger.
--
-- Deliberately without an exercise catalog. A catalog needs seeding,
-- deduplication, and a UI of its own, none of which the first version needs —
-- the exercise is a plain name on the set, and progression groups on its
-- lowercased form. Moving to a catalog later is an additive migration plus a
-- backfill from the distinct names already logged.
--
-- Counselor access runs through the training consent flag, which is separate
-- from the nutrition one so the two areas can diverge later without a schema
-- change.
-- ============================================================================

CREATE TABLE client_workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX client_workout_sessions_client_date_idx
  ON client_workout_sessions(client_user_id, session_date DESC);

CREATE TRIGGER client_workout_sessions_updated_at
  BEFORE UPDATE ON client_workout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- `client_user_id` is denormalized from the session for the same reason as in
-- the food log: entry policies then need no join.
CREATE TABLE client_workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES client_workout_sessions(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL CHECK (length(trim(exercise_name)) > 0),
  set_index INTEGER NOT NULL DEFAULT 1,
  reps INTEGER CHECK (reps IS NULL OR reps > 0),
  weight_kg NUMERIC CHECK (weight_kg IS NULL OR weight_kg >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A set with neither reps nor weight records nothing.
  CONSTRAINT client_workout_sets_has_measure CHECK (reps IS NOT NULL OR weight_kg IS NOT NULL)
);

CREATE INDEX client_workout_sets_session_idx
  ON client_workout_sets(session_id, set_index);

-- Progression groups by exercise regardless of how it was capitalized.
CREATE INDEX client_workout_sets_exercise_idx
  ON client_workout_sets(client_user_id, lower(exercise_name));

-- ============================================================================
-- Row level security
-- ============================================================================

ALTER TABLE client_workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_workout_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_workout_sessions_select" ON client_workout_sessions
  FOR SELECT USING (
    client_user_id = auth.uid()
    OR client_link_grants_access(client_user_id, 'training')
  );

CREATE POLICY "client_workout_sessions_insert_own" ON client_workout_sessions
  FOR INSERT WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_workout_sessions_update_own" ON client_workout_sessions
  FOR UPDATE USING (client_user_id = auth.uid())
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_workout_sessions_delete_own" ON client_workout_sessions
  FOR DELETE USING (client_user_id = auth.uid());

CREATE POLICY "client_workout_sets_select" ON client_workout_sets
  FOR SELECT USING (
    client_user_id = auth.uid()
    OR client_link_grants_access(client_user_id, 'training')
  );

CREATE POLICY "client_workout_sets_insert_own" ON client_workout_sets
  FOR INSERT WITH CHECK (
    client_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM client_workout_sessions
      WHERE client_workout_sessions.id = client_workout_sets.session_id
        AND client_workout_sessions.client_user_id = auth.uid()
    )
  );

CREATE POLICY "client_workout_sets_update_own" ON client_workout_sets
  FOR UPDATE USING (client_user_id = auth.uid())
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_workout_sets_delete_own" ON client_workout_sets
  FOR DELETE USING (client_user_id = auth.uid());
