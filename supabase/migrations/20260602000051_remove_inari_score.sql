-- Remove retired nutrition quality score fields from runtime schema and RPC output.

DROP FUNCTION IF EXISTS get_foods_with_nutrients(TEXT[], UUID[], INTEGER, INTEGER);

ALTER TABLE foods DROP COLUMN IF EXISTS prod_score;
ALTER TABLE recipes DROP COLUMN IF EXISTS prod_score;

CREATE OR REPLACE FUNCTION get_foods_with_nutrients(
  nutrient_filter TEXT[] DEFAULT NULL,
  food_id_filter UUID[] DEFAULT NULL,
  page_limit INTEGER DEFAULT 10000,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  food_id UUID,
  food_name TEXT,
  data_source_id TEXT,
  source_food_id TEXT,
  source_version TEXT,
  bls_code TEXT,
  food_group_id TEXT,
  category_id TEXT,
  manufacturer TEXT,
  allergens TEXT[],
  additives TEXT[],
  tags TEXT[],
  is_branded BOOLEAN,
  is_custom BOOLEAN,
  is_recipe_derived BOOLEAN,
  co2_per_portion NUMERIC,
  sustainability_score NUMERIC,
  data_quality_score NUMERIC,
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  nutrients JSONB
)
LANGUAGE sql STABLE
AS $$
  SELECT
    f.id AS food_id,
    f.name AS food_name,
    f.data_source_id,
    f.source_food_id,
    f.source_version,
    f.bls_code,
    f.food_group_id,
    f.category_id,
    f.manufacturer,
    f.allergens,
    f.additives,
    f.tags,
    f.is_branded,
    f.is_custom,
    f.is_recipe_derived,
    f.co2_per_portion,
    f.sustainability_score,
    f.data_quality_score,
    f.imported_at,
    f.created_at,
    f.updated_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'nutrient_id', fn.nutrient_id,
          'amount', fn.amount,
          'per_amount', fn.per_amount
        )
      ) FILTER (WHERE fn.nutrient_id IS NOT NULL),
      '[]'::jsonb
    ) AS nutrients
  FROM foods f
  LEFT JOIN food_nutrients fn
    ON fn.food_id = f.id
    AND (nutrient_filter IS NULL OR fn.nutrient_id = ANY(nutrient_filter))
  WHERE
    (food_id_filter IS NULL OR f.id = ANY(food_id_filter))
  GROUP BY f.id
  ORDER BY f.name
  LIMIT page_limit
  OFFSET page_offset;
$$;
