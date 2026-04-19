-- ============================================================================
-- Institution Menu Plans
-- ============================================================================

CREATE TABLE institution_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cycle_length INTEGER NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  diet_form_ids TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'archived')),
  
  -- Ownership
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE institution_menu_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES institution_menus(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,  -- 0 (Monday) to 6 (Sunday) or similar convention
  diet_form_id TEXT NOT NULL,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('fruehstueck', 'snack_vormittag', 'mittagessen', 'snack_nachmittag', 'abendessen')),
  recipe_id UUID NOT NULL REFERENCES recipes(id),
  portion_count INTEGER NOT NULL DEFAULT 1,
  
  UNIQUE(menu_id, week_number, day_of_week, diet_form_id, slot_type)
);

-- ============================================================================
-- Triggers
-- ============================================================================
CREATE TRIGGER institution_menus_updated_at
  BEFORE UPDATE ON institution_menus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE institution_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_menu_slots ENABLE ROW LEVEL SECURITY;

-- institution_menus
CREATE POLICY "menus_read_own" ON institution_menus
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "menus_insert_own" ON institution_menus
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "menus_update_own" ON institution_menus
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "menus_delete_own" ON institution_menus
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- institution_menu_slots
CREATE POLICY "menu_slots_read_own" ON institution_menu_slots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM institution_menus
      WHERE institution_menus.id = institution_menu_slots.menu_id
        AND (institution_menus.user_id = auth.uid() OR institution_menus.user_id IS NULL)
    )
  );

CREATE POLICY "menu_slots_insert_own" ON institution_menu_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM institution_menus
      WHERE institution_menus.id = institution_menu_slots.menu_id
        AND institution_menus.user_id = auth.uid()
    )
  );

CREATE POLICY "menu_slots_update_own" ON institution_menu_slots
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM institution_menus
      WHERE institution_menus.id = institution_menu_slots.menu_id
        AND institution_menus.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM institution_menus
      WHERE institution_menus.id = institution_menu_slots.menu_id
        AND institution_menus.user_id = auth.uid()
    )
  );

CREATE POLICY "menu_slots_delete_own" ON institution_menu_slots
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM institution_menus
      WHERE institution_menus.id = institution_menu_slots.menu_id
        AND institution_menus.user_id = auth.uid()
    )
  );
