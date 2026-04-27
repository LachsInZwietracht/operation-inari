-- Add source column to food_portions to distinguish system-generated from user-created portions
ALTER TABLE food_portions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'system'
  CHECK (source IN ('system', 'user'));
