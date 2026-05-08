CREATE TABLE kitchen_production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES institution_menus(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number > 0),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  service_date DATE NOT NULL,
  meal_slot TEXT NOT NULL CHECK (
    meal_slot IN ('fruehstueck', 'snack_vormittag', 'mittagessen', 'snack_nachmittag', 'abendessen')
  ),
  diet_form_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  recipe_name TEXT NOT NULL,
  portion_count INTEGER NOT NULL CHECK (portion_count >= 0),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_preparation', 'ready', 'served', 'held')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, menu_id, week_number, day_of_week, meal_slot, diet_form_id, recipe_id)
);

CREATE TABLE kitchen_production_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES kitchen_production_batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES institution_menus(id) ON DELETE CASCADE,
  previous_status TEXT CHECK (previous_status IN ('planned', 'in_preparation', 'ready', 'served', 'held')),
  next_status TEXT NOT NULL CHECK (next_status IN ('planned', 'in_preparation', 'ready', 'served', 'held')),
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX kitchen_production_batches_user_service_idx
  ON kitchen_production_batches(user_id, service_date DESC, meal_slot);

CREATE INDEX kitchen_production_batches_menu_day_idx
  ON kitchen_production_batches(user_id, menu_id, week_number, day_of_week);

CREATE INDEX kitchen_production_events_batch_created_idx
  ON kitchen_production_events(batch_id, created_at DESC);

CREATE TRIGGER kitchen_production_batches_updated_at
  BEFORE UPDATE ON kitchen_production_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE kitchen_production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_production_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kitchen_production_batches_read_own" ON kitchen_production_batches
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "kitchen_production_batches_insert_own" ON kitchen_production_batches
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "kitchen_production_batches_update_own" ON kitchen_production_batches
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "kitchen_production_batches_delete_own" ON kitchen_production_batches
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "kitchen_production_events_read_own" ON kitchen_production_events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "kitchen_production_events_insert_own" ON kitchen_production_events
  FOR INSERT WITH CHECK (user_id = auth.uid());
