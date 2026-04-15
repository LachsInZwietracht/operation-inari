-- ============================================================================
-- Food search function using pg_trgm similarity
--
-- IMPORTANT: The API layer MUST always pass auth.uid() as requesting_user_id.
-- If NULL is passed, custom foods will silently be excluded from results
-- (the WHERE clause checks f.user_id = requesting_user_id for custom foods).
-- Example call from a server action:
--   SELECT * FROM search_foods('Karotte', requesting_user_id := auth.uid());
-- ============================================================================

CREATE OR REPLACE FUNCTION search_foods(
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
    -- Visibility: public foods OR user's own custom foods
    (f.is_custom = FALSE OR f.user_id = requesting_user_id)
    -- Optional filters
    AND (source_filter IS NULL OR f.data_source_id = source_filter)
    AND (category_filter IS NULL OR f.category_id = category_filter)
    AND (group_filter IS NULL OR f.food_group_id = group_filter)
    AND (branded_only IS NULL OR f.is_branded = branded_only)
    -- Trigram match, ILIKE substring, or synonym match
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

-- Set the similarity threshold (default 0.3 is fine for German food names)
-- Can be adjusted per-session if needed: SET pg_trgm.similarity_threshold = 0.2;
