-- Sort and threshold-filter foods by a single nutrient (PRODI-feedback #4).
--
-- The foods browser previously ordered only by search relevance or name. This
-- RPC powers "sort foods by protein" and "show foods with > 10 g protein/100 g":
-- it joins food_nutrients for one nutrient, normalizes the amount to a per-100 g
-- basis (per_amount is 100 for BLS/SFK rows but may differ for branded foods),
-- applies the same source/category/group/custom-visibility filters as
-- search_foods_with_total, and orders by the normalized amount.
--
-- A composite (nutrient_id, amount) index keeps the per-nutrient scan and sort
-- efficient across the full catalog.

CREATE INDEX IF NOT EXISTS idx_food_nutrients_nutrient_amount
  ON food_nutrients (nutrient_id, amount);

CREATE OR REPLACE FUNCTION filter_foods_by_nutrient(
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
  result_offset INTEGER DEFAULT 0
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
