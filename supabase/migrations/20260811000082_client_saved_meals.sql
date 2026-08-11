-- ============================================================================
-- Saved meals: "mein übliches Frühstück", as one tap.
--
-- Deliberately NOT recipes. A recipe here is a counselor artefact — ingredients
-- from the catalog, a serving count, preparation steps, nutrient targets — and
-- asking a client to assemble one means searching and weighing every component.
-- Almost nobody does that, and whoever does, does it once.
--
-- What people mean when they say "save this" is far smaller: these four things,
-- together, under a name, log them again tomorrow. No servings, no
-- instructions, no targets. This is the generalisation of "wie gestern" that
-- already exists in the diary, with a name attached so it survives past
-- yesterday.
--
-- The item shape mirrors `client_food_log_entries` exactly, so saving is a
-- copy out and logging is a copy back with nothing to translate. The one thing
-- it does not carry is the slot: a saved meal is a set of foods, and where it
-- belongs is decided when it is used.
-- ============================================================================

CREATE TABLE client_saved_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_user_id, name)
);

CREATE INDEX client_saved_meals_client_idx ON client_saved_meals(client_user_id);

CREATE TRIGGER client_saved_meals_updated_at
  BEFORE UPDATE ON client_saved_meals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- `client_user_id` is denormalized from the parent for the same reason as in
-- the food log: item policies then need no join.
CREATE TABLE client_saved_meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_meal_id UUID NOT NULL REFERENCES client_saved_meals(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'food'
    CHECK (source_type IN ('food', 'custom')),
  food_id UUID REFERENCES foods(id),
  custom_name TEXT,
  custom_nutrients JSONB,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_saved_meal_items_reference_check CHECK (
    (source_type = 'food' AND food_id IS NOT NULL)
    OR (source_type = 'custom' AND custom_name IS NOT NULL)
  )
);

CREATE INDEX client_saved_meal_items_meal_idx
  ON client_saved_meal_items(saved_meal_id, sort_order);

-- ============================================================================
-- Row level security
--
-- A saved meal is a private convenience, not a record about the client, so
-- unlike the food log it is not shared with the counselor. There is nothing
-- here they cannot already see: whatever gets logged from it shows up in the
-- diary the normal way.
-- ============================================================================

ALTER TABLE client_saved_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_saved_meal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_saved_meals_select_own" ON client_saved_meals
  FOR SELECT USING (client_user_id = auth.uid());

CREATE POLICY "client_saved_meals_insert_own" ON client_saved_meals
  FOR INSERT WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_saved_meals_update_own" ON client_saved_meals
  FOR UPDATE USING (client_user_id = auth.uid())
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_saved_meals_delete_own" ON client_saved_meals
  FOR DELETE USING (client_user_id = auth.uid());

CREATE POLICY "client_saved_meal_items_select_own" ON client_saved_meal_items
  FOR SELECT USING (client_user_id = auth.uid());

CREATE POLICY "client_saved_meal_items_insert_own" ON client_saved_meal_items
  FOR INSERT WITH CHECK (
    client_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM client_saved_meals
      WHERE client_saved_meals.id = client_saved_meal_items.saved_meal_id
        AND client_saved_meals.client_user_id = auth.uid()
    )
  );

CREATE POLICY "client_saved_meal_items_update_own" ON client_saved_meal_items
  FOR UPDATE USING (client_user_id = auth.uid())
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client_saved_meal_items_delete_own" ON client_saved_meal_items
  FOR DELETE USING (client_user_id = auth.uid());
