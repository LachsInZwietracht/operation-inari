-- ============================================================================
-- Push data-source gating into the search/filter RPCs (pre-pagination).
--
-- Before this change, the app fetched a page of search results and then dropped
-- rows from blocked/disabled data sources (tariff-gated SFK, or any source an
-- organization switched off in /datenbank) in JS, AFTER LIMIT/OFFSET and AFTER
-- COUNT(*) OVER (). That was correct only while every source was small: it
-- silently shrank pages, skewed total_count, and — critically — let a large
-- optional source (Open Food Facts) crowd the candidate set and starve the
-- default BLS-first results before the JS filter ever ran.
--
-- This migration adds an `excluded_sources TEXT[]` parameter to the three
-- catalog RPCs so the exclusion happens inside the WHERE clause, before the
-- window count and before LIMIT/OFFSET. The app passes the resolved
-- blocked + organization-disabled source list. NULL/empty keeps every source
-- (unchanged behavior for callers that do not pass it).
--
-- Functions are dropped and recreated (not CREATE OR REPLACE) because adding an
-- argument changes the signature and would otherwise create an overload that
-- PostgREST cannot disambiguate from named arguments.
-- ============================================================================

-- ── 1. search_foods_with_total ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS search_foods_with_total(
  TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID, INTEGER, INTEGER
);

CREATE FUNCTION search_foods_with_total(
  search_query TEXT,
  source_filter TEXT DEFAULT NULL,
  category_filter TEXT DEFAULT NULL,
  group_filter TEXT DEFAULT NULL,
  branded_only BOOLEAN DEFAULT NULL,
  requesting_user_id UUID DEFAULT NULL,
  result_limit INTEGER DEFAULT 50,
  result_offset INTEGER DEFAULT 0,
  excluded_sources TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  food_id UUID,
  food_name TEXT,
  similarity_score REAL,
  data_source_id TEXT,
  bls_code TEXT,
  category_id TEXT,
  food_group_id TEXT,
  is_branded BOOLEAN,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH matched_foods AS (
    SELECT
      f.id,
      f.name,
      GREATEST(
        similarity(f.name, search_query),
        COALESCE((
          SELECT MAX(similarity(s.name, search_query))
          FROM food_synonyms s
          WHERE s.food_id = f.id
        ), 0)
      ) AS sim_score,
      f.data_source_id,
      f.bls_code,
      f.category_id,
      f.food_group_id,
      f.is_branded
    FROM foods f
    WHERE
      (f.is_custom = FALSE OR f.user_id = requesting_user_id)
      AND (source_filter IS NULL OR f.data_source_id = source_filter)
      AND (category_filter IS NULL OR f.category_id = category_filter)
      AND (group_filter IS NULL OR f.food_group_id = group_filter)
      AND (branded_only IS NULL OR f.is_branded = branded_only)
      AND (excluded_sources IS NULL OR f.data_source_id <> ALL(excluded_sources))
      AND (
        f.name % search_query
        OR f.name ILIKE '%' || search_query || '%'
        OR EXISTS (
          SELECT 1
          FROM food_synonyms s
          WHERE s.food_id = f.id
            AND (s.name % search_query OR s.name ILIKE '%' || search_query || '%')
        )
      )
  )
  SELECT
    matched_foods.id,
    matched_foods.name,
    matched_foods.sim_score,
    matched_foods.data_source_id,
    matched_foods.bls_code,
    matched_foods.category_id,
    matched_foods.food_group_id,
    matched_foods.is_branded,
    COUNT(*) OVER ()
  FROM matched_foods
  ORDER BY matched_foods.sim_score DESC, matched_foods.name ASC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── 2. search_foods (no total count; fallback path) ─────────────────────────
DROP FUNCTION IF EXISTS search_foods(
  TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID, INTEGER, INTEGER
);

CREATE FUNCTION search_foods(
  search_query TEXT,
  source_filter TEXT DEFAULT NULL,
  category_filter TEXT DEFAULT NULL,
  group_filter TEXT DEFAULT NULL,
  branded_only BOOLEAN DEFAULT NULL,
  requesting_user_id UUID DEFAULT NULL,
  result_limit INTEGER DEFAULT 50,
  result_offset INTEGER DEFAULT 0,
  excluded_sources TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  food_id UUID,
  food_name TEXT,
  similarity_score REAL,
  data_source_id TEXT,
  bls_code TEXT,
  category_id TEXT,
  food_group_id TEXT,
  is_branded BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    GREATEST(
      similarity(f.name, search_query),
      COALESCE((
        SELECT MAX(similarity(s.name, search_query))
        FROM food_synonyms s WHERE s.food_id = f.id
      ), 0)
    ) AS sim_score,
    f.data_source_id,
    f.bls_code,
    f.category_id,
    f.food_group_id,
    f.is_branded
  FROM foods f
  WHERE
    (f.is_custom = FALSE OR f.user_id = requesting_user_id)
    AND (source_filter IS NULL OR f.data_source_id = source_filter)
    AND (category_filter IS NULL OR f.category_id = category_filter)
    AND (group_filter IS NULL OR f.food_group_id = group_filter)
    AND (branded_only IS NULL OR f.is_branded = branded_only)
    AND (excluded_sources IS NULL OR f.data_source_id <> ALL(excluded_sources))
    AND (
      f.name % search_query
      OR f.name ILIKE '%' || search_query || '%'
      OR EXISTS (
        SELECT 1 FROM food_synonyms s
        WHERE s.food_id = f.id
          AND (s.name % search_query OR s.name ILIKE '%' || search_query || '%')
      )
    )
  ORDER BY sim_score DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── 3. filter_foods_by_nutrient ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS filter_foods_by_nutrient(
  TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, TEXT, UUID, INTEGER, INTEGER
);

CREATE FUNCTION filter_foods_by_nutrient(
  nutrient_key TEXT,
  min_per_100g NUMERIC DEFAULT NULL,
  max_per_100g NUMERIC DEFAULT NULL,
  sort_direction TEXT DEFAULT 'desc',
  source_filter TEXT DEFAULT NULL,
  category_filter TEXT DEFAULT NULL,
  group_filter TEXT[] DEFAULT NULL,
  branded_only BOOLEAN DEFAULT NULL,
  name_query TEXT DEFAULT NULL,
  requesting_user_id UUID DEFAULT NULL,
  result_limit INTEGER DEFAULT 50,
  result_offset INTEGER DEFAULT 0,
  excluded_sources TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  food_id UUID,
  food_name TEXT,
  data_source_id TEXT,
  bls_code TEXT,
  category_id TEXT,
  food_group_id TEXT,
  is_branded BOOLEAN,
  nutrient_amount NUMERIC,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH matched AS (
    SELECT
      f.id,
      f.name,
      f.data_source_id,
      f.bls_code,
      f.category_id,
      f.food_group_id,
      f.is_branded,
      (fn.amount * 100.0 / NULLIF(fn.per_amount, 0)) AS norm_amount
    FROM foods f
    JOIN food_nutrients fn
      ON fn.food_id = f.id AND fn.nutrient_id = nutrient_key
    WHERE
      (f.is_custom = FALSE OR f.user_id = requesting_user_id)
      AND (source_filter IS NULL OR f.data_source_id = source_filter)
      AND (category_filter IS NULL OR f.category_id = category_filter)
      AND (group_filter IS NULL OR f.food_group_id = ANY(group_filter))
      AND (branded_only IS NULL OR f.is_branded = branded_only)
      AND (excluded_sources IS NULL OR f.data_source_id <> ALL(excluded_sources))
      AND (name_query IS NULL OR f.name ILIKE '%' || name_query || '%')
      AND (
        min_per_100g IS NULL
        OR (fn.amount * 100.0 / NULLIF(fn.per_amount, 0)) >= min_per_100g
      )
      AND (
        max_per_100g IS NULL
        OR (fn.amount * 100.0 / NULLIF(fn.per_amount, 0)) <= max_per_100g
      )
  )
  SELECT
    matched.id,
    matched.name,
    matched.data_source_id,
    matched.bls_code,
    matched.category_id,
    matched.food_group_id,
    matched.is_branded,
    matched.norm_amount,
    COUNT(*) OVER ()
  FROM matched
  ORDER BY
    CASE WHEN sort_direction = 'asc' THEN matched.norm_amount END ASC NULLS LAST,
    CASE WHEN sort_direction <> 'asc' THEN matched.norm_amount END DESC NULLS LAST,
    matched.name ASC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;
