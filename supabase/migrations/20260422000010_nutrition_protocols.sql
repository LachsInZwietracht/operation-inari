-- ============================================================================
-- Nutrition protocols
-- ============================================================================

CREATE TABLE nutrition_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ernaehrungsprotokoll', '24h_recall', 'food_frequency', 'household')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE nutrition_protocol_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES nutrition_protocols(id) ON DELETE CASCADE,
  protocol_date DATE NOT NULL,
  food_id UUID NOT NULL REFERENCES foods(id),
  amount NUMERIC NOT NULL,
  meal_slot TEXT NOT NULL
    CHECK (meal_slot IN ('fruehstueck', 'snack_vormittag', 'mittagessen', 'snack_nachmittag', 'abendessen')),
  entry_time TEXT,
  notes TEXT,
  measurement_mode TEXT
    CHECK (measurement_mode IN ('grams', 'household')),
  household_measurement JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX nutrition_protocols_user_patient_date_idx
  ON nutrition_protocols(user_id, patient_id, start_date DESC);

CREATE INDEX nutrition_protocol_entries_protocol_date_idx
  ON nutrition_protocol_entries(protocol_id, protocol_date, sort_order);

CREATE TRIGGER nutrition_protocols_updated_at
  BEFORE UPDATE ON nutrition_protocols
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE nutrition_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_protocol_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_protocols_read_own" ON nutrition_protocols
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "nutrition_protocols_insert_own" ON nutrition_protocols
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "nutrition_protocols_update_own" ON nutrition_protocols
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "nutrition_protocols_delete_own" ON nutrition_protocols
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "nutrition_protocol_entries_read_own" ON nutrition_protocol_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM nutrition_protocols
      WHERE nutrition_protocols.id = nutrition_protocol_entries.protocol_id
        AND nutrition_protocols.user_id = auth.uid()
    )
  );

CREATE POLICY "nutrition_protocol_entries_insert_own" ON nutrition_protocol_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM nutrition_protocols
      WHERE nutrition_protocols.id = nutrition_protocol_entries.protocol_id
        AND nutrition_protocols.user_id = auth.uid()
    )
  );

CREATE POLICY "nutrition_protocol_entries_update_own" ON nutrition_protocol_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM nutrition_protocols
      WHERE nutrition_protocols.id = nutrition_protocol_entries.protocol_id
        AND nutrition_protocols.user_id = auth.uid()
    )
  );

CREATE POLICY "nutrition_protocol_entries_delete_own" ON nutrition_protocol_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM nutrition_protocols
      WHERE nutrition_protocols.id = nutrition_protocol_entries.protocol_id
        AND nutrition_protocols.user_id = auth.uid()
    )
  );
