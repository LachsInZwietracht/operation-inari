-- Adds clinical metadata and lifecycle state to daily meal plans.

ALTER TABLE daily_meal_plans
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'approved', 'archived')),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS target_profile_id UUID REFERENCES reference_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS daily_meal_plans_user_patient_date_idx
  ON daily_meal_plans(user_id, patient_id, date DESC);

CREATE INDEX IF NOT EXISTS daily_meal_plans_user_status_date_idx
  ON daily_meal_plans(user_id, status, date DESC);
