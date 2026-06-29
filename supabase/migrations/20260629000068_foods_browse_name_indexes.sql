-- ============================================================================
-- B-tree indexes to keep the foods browser's alphabetical browse fast at scale.
--
-- fetchFoodsBrowserPageByQuery orders the catalog by name (optionally filtered
-- to one data source) and takes a page. With only a few thousand BLS rows the
-- sort was negligible, but after ~220k Open Food Facts products were promoted,
-- `ORDER BY name` over the filtered set needs a full sort (~2s) and, combined
-- with the food_nutrients embed, exceeds Postgres' statement timeout — the API
-- returns 500 and the browser shows "0 Lebensmittel". The existing name index is
-- a GIN trigram index (for ILIKE/similarity search) and cannot serve ORDER BY.
--
-- Two plain b-tree indexes let the browse use an index scan in name order
-- instead of sorting:
--   - (data_source_id, name) for the source-filtered browse (e.g. OFF only),
--   - (name) for the all-sources browse.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_foods_data_source_name
  ON foods (data_source_id, name);

CREATE INDEX IF NOT EXISTS idx_foods_name
  ON foods (name);
