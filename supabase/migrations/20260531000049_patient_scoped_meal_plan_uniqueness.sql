-- Scope daily meal plan uniqueness by patient context.
--
-- The original user/date uniqueness allowed only one plan per day for a user,
-- even after patient_id was added. Patient-bound planning needs one plan per
-- patient/day plus one optional unassigned planner day.

ALTER TABLE daily_meal_plans
  DROP CONSTRAINT IF EXISTS daily_meal_plans_user_id_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS daily_meal_plans_user_unassigned_date_unique_idx
  ON daily_meal_plans(user_id, date)
  WHERE patient_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS daily_meal_plans_user_patient_date_unique_idx
  ON daily_meal_plans(user_id, patient_id, date)
  WHERE patient_id IS NOT NULL;
