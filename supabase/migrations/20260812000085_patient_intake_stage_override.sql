-- Manual intake-stage override.
--
-- The Aufnahmen board derives a patient's stage from facts that already exist:
-- a questionnaire that arrived, a patient record, a documented session. That
-- stays the rule. These columns are the documented exception — a practitioner
-- who knows better than the data can pin a stage by hand, and the board shows
-- that it was pinned rather than derived.
--
-- Nullable and additive: rows without an override keep behaving exactly as
-- before, and dropping these columns would restore the previous behaviour.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS intake_stage_override TEXT
    CHECK (intake_stage_override IN ('eingeladen', 'fragebogen', 'beratung', 'plan')),
  ADD COLUMN IF NOT EXISTS intake_stage_override_at TIMESTAMPTZ;

COMMENT ON COLUMN patients.intake_stage_override IS
  'Manually pinned Aufnahmen stage. NULL means the stage is derived from plans, submissions and sessions (the normal case).';
COMMENT ON COLUMN patients.intake_stage_override_at IS
  'When the override was set, so the board can show how stale a hand-set stage is.';

-- Only rows carrying an override are ever looked up by it, so the index skips
-- the overwhelming majority that do not.
CREATE INDEX IF NOT EXISTS patients_intake_stage_override_idx
  ON patients (user_id, intake_stage_override)
  WHERE intake_stage_override IS NOT NULL;

-- No RLS changes: these are columns on `patients`, already covered by that
-- table's existing user_id ownership policies.
