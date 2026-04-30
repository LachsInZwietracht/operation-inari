-- ============================================================================
-- Cologne Phonetics (Koelner Phonetik) for server-side German sound matching
--
-- Ports the algorithm from lib/search/cologne-phonetics.ts into Postgres so
-- the search RPCs can match phonetically without a client-side fallback.
--
-- Adds:
--   1. cologne_phonetics(TEXT) -> TEXT  immutable function
--   2. Generated phonetic_code columns on foods and food_synonyms
--   3. GIN trigram indexes on the new columns
--   4. Updated search_foods / search_foods_with_total RPCs with phonetic branch
-- ============================================================================

-- 1. Core phonetic encoder --------------------------------------------------

CREATE OR REPLACE FUNCTION cologne_phonetics(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
AS $$
DECLARE
  normalized TEXT;
  chars TEXT[];
  codes TEXT[];
  c TEXT;
  prev TEXT;
  nxt TEXT;
  code TEXT;
  i INT;
  raw TEXT := '';
  result TEXT := '';
BEGIN
  -- Normalize: lowercase, replace German umlauts, strip non-alpha
  normalized := lower(trim(input));
  normalized := replace(normalized, chr(228), 'ae'); -- ä
  normalized := replace(normalized, chr(246), 'oe'); -- ö
  normalized := replace(normalized, chr(252), 'ue'); -- ü
  normalized := replace(normalized, chr(223), 'ss'); -- ß
  normalized := regexp_replace(normalized, '[^a-z]', '', 'g');

  IF length(normalized) = 0 THEN
    RETURN '';
  END IF;

  chars := regexp_split_to_array(normalized, '');

  FOR i IN 1..array_length(chars, 1) LOOP
    c := chars[i];
    prev := CASE WHEN i > 1 THEN chars[i - 1] ELSE '' END;
    nxt  := CASE WHEN i < array_length(chars, 1) THEN chars[i + 1] ELSE '' END;

    CASE c
      WHEN 'a','e','i','o','u' THEN code := '0';
      WHEN 'h' THEN code := '';
      WHEN 'b' THEN code := '1';
      WHEN 'p' THEN
        code := CASE WHEN nxt = 'h' THEN '3' ELSE '1' END;
      WHEN 'd','t' THEN
        code := CASE WHEN nxt IN ('c','s','z') THEN '8' ELSE '2' END;
      WHEN 'f','v','w' THEN code := '3';
      WHEN 'g','k','q' THEN code := '4';
      WHEN 'c' THEN
        IF i = 1 THEN
          code := CASE WHEN nxt IN ('a','h','k','l','o','q','r','u','x') THEN '4' ELSE '8' END;
        ELSIF prev IN ('s','z') THEN
          code := '8';
        ELSE
          code := CASE WHEN nxt IN ('a','h','k','o','q','u','x') THEN '4' ELSE '8' END;
        END IF;
      WHEN 'x' THEN
        code := CASE WHEN prev IN ('c','k','q') THEN '8' ELSE '48' END;
      WHEN 'l' THEN code := '5';
      WHEN 'm','n' THEN code := '6';
      WHEN 'r' THEN code := '7';
      WHEN 's','z' THEN code := '8';
      WHEN 'j','y' THEN code := '0';
      ELSE code := '';
    END CASE;

    raw := raw || code;
  END LOOP;

  -- Remove consecutive duplicate codes
  FOR i IN 1..length(raw) LOOP
    IF i = 1 OR substr(raw, i, 1) <> substr(raw, i - 1, 1) THEN
      result := result || substr(raw, i, 1);
    END IF;
  END LOOP;

  -- Remove vowel codes (0) except leading position
  IF length(result) > 1 THEN
    result := substr(result, 1, 1) || replace(substr(result, 2), '0', '');
  END IF;

  RETURN result;
END;
$$;

-- 2. Generated columns -------------------------------------------------------

ALTER TABLE foods
  ADD COLUMN IF NOT EXISTS phonetic_code TEXT
  GENERATED ALWAYS AS (cologne_phonetics(name)) STORED;

ALTER TABLE food_synonyms
  ADD COLUMN IF NOT EXISTS phonetic_code TEXT
  GENERATED ALWAYS AS (cologne_phonetics(name)) STORED;

-- 3. Indexes ------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_foods_phonetic_trgm
  ON foods USING gin (phonetic_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_food_synonyms_phonetic_trgm
  ON food_synonyms USING gin (phonetic_code gin_trgm_ops);

-- 4. Updated search RPCs -----------------------------------------------------

-- 4a. search_foods (base version without total_count)
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
DECLARE
  query_phonetic TEXT := cologne_phonetics(search_query);
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
      ), 0),
      -- Phonetic similarity: compare phonetic codes via trigram
      CASE WHEN query_phonetic <> '' AND f.phonetic_code <> '' THEN
        similarity(f.phonetic_code, query_phonetic) * 0.6
      ELSE 0 END
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
      OR (query_phonetic <> '' AND f.phonetic_code % query_phonetic)
      OR EXISTS (
        SELECT 1 FROM food_synonyms s
        WHERE s.food_id = f.id
          AND (
            s.name % search_query
            OR s.name ILIKE '%' || search_query || '%'
            OR (query_phonetic <> '' AND s.phonetic_code % query_phonetic)
          )
      )
    )
  ORDER BY sim_score DESC, f.name ASC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4b. search_foods_with_total (paginated version with COUNT OVER)
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
DECLARE
  query_phonetic TEXT := cologne_phonetics(search_query);
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
        ), 0),
        CASE WHEN query_phonetic <> '' AND f.phonetic_code <> '' THEN
          similarity(f.phonetic_code, query_phonetic) * 0.6
        ELSE 0 END
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
        OR (query_phonetic <> '' AND f.phonetic_code % query_phonetic)
        OR EXISTS (
          SELECT 1
          FROM food_synonyms s
          WHERE s.food_id = f.id
            AND (
              s.name % search_query
              OR s.name ILIKE '%' || search_query || '%'
              OR (query_phonetic <> '' AND s.phonetic_code % query_phonetic)
            )
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
