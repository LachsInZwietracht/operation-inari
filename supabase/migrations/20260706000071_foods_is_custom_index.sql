-- ============================================================================
-- Partial index to keep the custom-foods fetch off a full table scan.
--
-- fetchCustomFoodsClient (lib/data/custom-foods-client.ts) selects foods where
-- is_custom = true and embeds food_nutrients + food_portions. There was no
-- index on is_custom, so Postgres sequentially scanned the whole foods table
-- (~228k rows after Open Food Facts promotion). The bare id scan was tolerable,
-- but combined with the two embeds the query exceeds Postgres' statement
-- timeout — the API returns 500 (57014) on every plan/food page load, and the
-- custom-foods list silently fails. Same failure mode as the browse-name
-- indexes migration (20260629000068).
--
-- Custom foods are a tiny fraction of the catalog, so a partial index over
-- is_custom = TRUE (mirroring idx_foods_is_branded) stays small and turns the
-- filter into an index scan — the embeds then run only for matching rows.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_foods_is_custom
  ON foods (is_custom)
  WHERE is_custom = TRUE;
