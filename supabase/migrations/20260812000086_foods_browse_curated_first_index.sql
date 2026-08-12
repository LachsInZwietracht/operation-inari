-- ============================================================================
-- B-tree index for the curated-first alphabetical browse.
--
-- fetchFoodsBrowserPageByQuery now orders the catalog by
-- `is_branded ASC, name ASC` so the curated BLS/SFK reference foods lead and
-- branded Open Food Facts products follow — matching the ranking the name
-- search RPCs already apply (20260629000066_search_bls_priority). Without a
-- matching index this repeats the exact failure 20260629000068 fixed for the
-- plain name browse: no index can serve the two-key ordering, so Postgres
-- sorts all ~101k rows, and combined with the food_nutrients embed the
-- statement exceeds the timeout ("canceling statement due to statement
-- timeout"). The API then returns an empty page and the browser shows
-- "0 Lebensmittel".
--
-- (is_branded, name) lets the all-sources browse walk the index in the exact
-- output order and stop after one page. idx_foods_data_source_name still
-- serves the source-filtered browse, where is_branded is constant per source
-- and the leading column is data_source_id.
--
-- Additive and reversible: creating an index changes no rows and no
-- application contract. `DROP INDEX idx_foods_is_branded_name;` reverts it.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_foods_is_branded_name
  ON foods (is_branded, name);
