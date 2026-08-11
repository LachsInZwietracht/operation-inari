-- ============================================================================
-- The part of a day that is not a number.
--
-- `client_food_log_days.notes` has existed since the module was built and has
-- never had a field to write it in. That is the wrong thing to leave unused:
-- "Einladung bei Freunden", "kaum geschlafen", "Stress im Büro" is the line a
-- dietitian actually reads, and it explains the numbers around it in a way no
-- macro breakdown can.
--
-- Water gets a column of its own rather than a food log entry. It is a volume,
-- not a food; modelling it as an entry would mean inventing a catalog item
-- with no nutrients and then filtering it back out of every total.
-- ============================================================================

ALTER TABLE client_food_log_days
  ADD COLUMN water_ml INTEGER
    CHECK (water_ml IS NULL OR (water_ml >= 0 AND water_ml <= 20000));

COMMENT ON COLUMN client_food_log_days.water_ml IS
  'Fluid intake for the day in millilitres. NULL means not tracked, which is different from 0.';
