-- ============================================================================
-- Hospital inpatient stays and meal orders
-- ============================================================================

CREATE TABLE inpatient_stays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  station TEXT NOT NULL,
  room TEXT NOT NULL,
  bed TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'discharged')),
  admission_date DATE NOT NULL,
  discharge_date DATE,
  diet_form_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX inpatient_stays_user_id_idx ON inpatient_stays(user_id);
CREATE INDEX inpatient_stays_patient_id_idx ON inpatient_stays(patient_id);
CREATE INDEX inpatient_stays_status_idx ON inpatient_stays(user_id, status, admission_date DESC);

CREATE TABLE meal_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inpatient_stay_id UUID NOT NULL REFERENCES inpatient_stays(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  station TEXT NOT NULL,
  room TEXT NOT NULL,
  bed TEXT NOT NULL,
  service_date DATE NOT NULL,
  meal_slot TEXT NOT NULL CHECK (
    meal_slot IN ('fruehstueck', 'snack_vormittag', 'mittagessen', 'snack_nachmittag', 'abendessen')
  ),
  recipe_id TEXT NOT NULL,
  recipe_name TEXT NOT NULL,
  diet_form_ids_snapshot TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  allergen_ids_snapshot TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  restriction_summary TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  special_instructions TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'delivered', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX meal_orders_service_unique_idx
  ON meal_orders(inpatient_stay_id, service_date, meal_slot);

CREATE INDEX meal_orders_user_date_idx ON meal_orders(user_id, service_date DESC, meal_slot);
CREATE INDEX meal_orders_patient_idx ON meal_orders(patient_id, service_date DESC);

CREATE TRIGGER inpatient_stays_updated_at
  BEFORE UPDATE ON inpatient_stays
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER meal_orders_updated_at
  BEFORE UPDATE ON meal_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE inpatient_stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inpatient_stays_read_own" ON inpatient_stays
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "inpatient_stays_insert_own" ON inpatient_stays
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "inpatient_stays_update_own" ON inpatient_stays
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "inpatient_stays_delete_own" ON inpatient_stays
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "meal_orders_read_own" ON meal_orders
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "meal_orders_insert_own" ON meal_orders
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "meal_orders_update_own" ON meal_orders
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "meal_orders_delete_own" ON meal_orders
  FOR DELETE USING (user_id = auth.uid());
