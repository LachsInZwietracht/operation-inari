-- ============================================================================
-- Rank curated reference foods (BLS/SFK) above branded products (Open Food
-- Facts) in name search.
--
-- Open Food Facts is imported as an optional supplement but is default-visible.
-- With ~220k branded German OFF products in the catalog, a generic query like
-- "Milch" returns thousands of branded hits whose trigram similarity is as high
-- as (or higher than) the canonical BLS entries, so branded products crowd the
-- top of the result list and push the clinical reference foods down.
--
-- Fix: make `is_branded` the PRIMARY sort key (generic foods first, branded
-- after), with similarity and name as the secondary/tertiary keys. BLS and SFK
-- are is_branded = FALSE; promoted OFF foods are is_branded = TRUE. Branded
-- products still appear (OFF stays a visible supplement) but never displace the
-- reference foods at the top.
--
-- Trade-off: a weakly-matching generic food now outranks a strongly-matching
-- branded one. That is the intended clinical behavior — the curated BLS catalog
-- is the primary source and should lead. The match filter (trigram threshold +
-- ILIKE + synonyms) is unchanged, so only genuinely relevant rows are ranked.
--
-- Only the two relevance-ranked RPCs change. filter_foods_by_nutrient is left
-- ordered by the nutrient amount on purpose ("sort foods by protein" must keep
-- ranking by the nutrient, not by source). Signatures are unchanged from
-- 20260628000065, so CREATE OR REPLACE is sufficient.
-- ============================================================================

-- ── search_foods_with_total ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_foods_with_total(
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
  ORDER BY
    matched_foods.is_branded ASC,
    matched_foods.sim_score DESC,
    matched_foods.name ASC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── search_foods (no total count; fallback path) ────────────────────────────
CREATE OR REPLACE FUNCTION search_foods(
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
  ORDER BY f.is_branded ASC, sim_score DESC, f.name ASC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;
