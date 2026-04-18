CREATE OR REPLACE FUNCTION search_foods_with_total(
  search_query TEXT,
  source_filter TEXT DEFAULT NULL,
  category_filter TEXT DEFAULT NULL,
  group_filter TEXT DEFAULT NULL,
  branded_only BOOLEAN DEFAULT NULL,
  requesting_user_id UUID DEFAULT NULL,
  result_limit INTEGER DEFAULT 50,
  result_offset INTEGER DEFAULT 0
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
