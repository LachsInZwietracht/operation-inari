-- Reusable meal plan templates indexed by indication and diet line.
-- Slots are stored inline as JSONB: templates are read-once-and-cloned and the
-- entry count is bounded (5 slots × small entry count), so a normalized
-- entries table would only add joins without ergonomic value.

CREATE TABLE meal_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = system template
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  indication TEXT,
  diet_line_id TEXT,
  target_profile_id UUID REFERENCES reference_profiles(id) ON DELETE SET NULL,
  slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  source_type TEXT NOT NULL DEFAULT 'personal'
    CHECK (source_type IN ('personal', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX meal_plan_templates_user_idx
  ON meal_plan_templates(user_id);

CREATE INDEX meal_plan_templates_indication_idx
  ON meal_plan_templates(indication)
  WHERE indication IS NOT NULL;

CREATE INDEX meal_plan_templates_diet_line_idx
  ON meal_plan_templates(diet_line_id)
  WHERE diet_line_id IS NOT NULL;

CREATE TRIGGER meal_plan_templates_updated_at
  BEFORE UPDATE ON meal_plan_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE meal_plan_templates ENABLE ROW LEVEL SECURITY;

-- System rows (user_id IS NULL) are readable to every authenticated session;
-- personal rows require ownership for both reads and writes.
CREATE POLICY "meal_plan_templates_read_system" ON meal_plan_templates
  FOR SELECT USING (user_id IS NULL);

CREATE POLICY "meal_plan_templates_read_own" ON meal_plan_templates
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "meal_plan_templates_insert_own" ON meal_plan_templates
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "meal_plan_templates_update_own" ON meal_plan_templates
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "meal_plan_templates_delete_own" ON meal_plan_templates
  FOR DELETE USING (user_id = auth.uid());
