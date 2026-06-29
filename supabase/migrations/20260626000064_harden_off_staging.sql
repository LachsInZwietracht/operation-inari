-- ============================================================================
-- Harden Open Food Facts staging metadata
-- ============================================================================

ALTER TABLE off_staging
  ADD COLUMN IF NOT EXISTS raw_product JSONB,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS selected_name_locale TEXT,
  ADD COLUMN IF NOT EXISTS quantity TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS last_modified_t BIGINT,
  ADD COLUMN IF NOT EXISTS last_modified_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nutriscore_grade TEXT,
  ADD COLUMN IF NOT EXISTS nova_group INTEGER,
  ADD COLUMN IF NOT EXISTS ecoscore_grade TEXT,
  ADD COLUMN IF NOT EXISTS allergens_tags TEXT[],
  ADD COLUMN IF NOT EXISTS additives_tags TEXT[],
  ADD COLUMN IF NOT EXISTS labels_tags TEXT[],
  ADD COLUMN IF NOT EXISTS ingredients_text TEXT,
  ADD COLUMN IF NOT EXISTS data_quality_score NUMERIC;

CREATE INDEX IF NOT EXISTS idx_off_staging_last_modified
  ON off_staging(last_modified_t);

CREATE INDEX IF NOT EXISTS idx_off_staging_quality_score
  ON off_staging(data_quality_score);
