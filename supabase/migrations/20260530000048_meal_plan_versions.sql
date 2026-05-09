-- Append-only audit log of approved (or otherwise snapshotted) meal plan
-- revisions. Each row captures the full slot tree as JSONB so that historical
-- versions remain readable even after the live plan, food references, or diet
-- lines have changed. We deliberately store the snapshot inline rather than
-- normalizing it back into meal_entries because:
--   * versions are read rarely (audit / restore) but written once per approval,
--   * restoring a version into the live plan must remain side-effect free,
--   * food/recipe rows referenced by historical entries may be deleted later,
--     and a JSONB snapshot keeps the record valid without dangling FKs.

CREATE TABLE meal_plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES daily_meal_plans(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  reason TEXT NOT NULL DEFAULT 'approved'
    CHECK (reason IN ('approved', 'manual', 'reopened')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meal_plan_id, version_number)
);

CREATE INDEX meal_plan_versions_plan_idx
  ON meal_plan_versions(meal_plan_id, version_number DESC);

ALTER TABLE meal_plan_versions ENABLE ROW LEVEL SECURITY;

-- A version is visible/writable only to the owner of the parent meal plan.
-- Updates are intentionally not allowed: snapshots are immutable history.
CREATE POLICY "meal_plan_versions_read_own" ON meal_plan_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM daily_meal_plans
      WHERE daily_meal_plans.id = meal_plan_versions.meal_plan_id
        AND daily_meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "meal_plan_versions_insert_own" ON meal_plan_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_meal_plans
      WHERE daily_meal_plans.id = meal_plan_versions.meal_plan_id
        AND daily_meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "meal_plan_versions_delete_own" ON meal_plan_versions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM daily_meal_plans
      WHERE daily_meal_plans.id = meal_plan_versions.meal_plan_id
        AND daily_meal_plans.user_id = auth.uid()
    )
  );
