-- ============================================================================
-- Open Food Facts: Parquet -> OFF-native JSONL converter (DuckDB)
-- ============================================================================
--
-- Reshapes the Hugging Face OFF Parquet export
-- (https://huggingface.co/datasets/openfoodfacts/product-database, split `food`)
-- into the flat OFF-native JSONL shape that `scripts/etl/import-off.ts` consumes,
-- filtered to German products.
--
-- Why this exists: the plain `openfoodfacts-products.jsonl.gz` snapshot can ship
-- with empty `nutriments` for EU products (a defective/partial export). The
-- Parquet of the same dataset is complete (~70% German nutrition coverage). See
-- docs/database-guide.md "Open Food Facts ETL".
--
-- Two differences from the JSONL shape are normalized here:
--   1. Localized fields (product_name, generic_name, ingredients_text) are
--      STRUCT(lang, text)[] in Parquet -> flattened to `<field>` (main/en) and
--      `<field>_de`.
--   2. `nutriments` is STRUCT(name, value, "100g", serving, ...)[] in Parquet ->
--      flattened to the flat `{ "<name>_100g": <num>, ... }` map OFF JSONL uses.
--
-- Usage (DuckDB CLI; install once: `brew install duckdb`):
--   1. Download the Parquet to data/off/food.parquet:
--        curl -L -o data/off/food.parquet \
--          https://huggingface.co/datasets/openfoodfacts/product-database/resolve/main/food.parquet
--   2. Convert:
--        duckdb < scripts/etl/off-parquet-to-jsonl.sql
--   3. Import via the existing pipeline:
--        OFF_SOURCE_FILE=data/off/off-germany.jsonl npm run etl:off
--
-- To target a different country, change 'en:germany' below.
-- ============================================================================

COPY (
  SELECT
    code,
    coalesce(
      list_filter(product_name, lambda x: x.lang = 'main')[1].text,
      list_filter(product_name, lambda x: x.lang = 'en')[1].text,
      product_name[1].text
    ) AS product_name,
    list_filter(product_name, lambda x: x.lang = 'de')[1].text AS product_name_de,
    coalesce(
      list_filter(generic_name, lambda x: x.lang = 'main')[1].text,
      list_filter(generic_name, lambda x: x.lang = 'en')[1].text,
      generic_name[1].text
    ) AS generic_name,
    list_filter(generic_name, lambda x: x.lang = 'de')[1].text AS generic_name_de,
    brands,
    categories,
    categories_tags,
    countries_tags,
    labels_tags,
    allergens_tags,
    additives_tags,
    quantity,
    lang,
    coalesce(
      list_filter(ingredients_text, lambda x: x.lang = 'main')[1].text,
      list_filter(ingredients_text, lambda x: x.lang = 'en')[1].text,
      ingredients_text[1].text
    ) AS ingredients_text,
    list_filter(ingredients_text, lambda x: x.lang = 'de')[1].text AS ingredients_text_de,
    nutriscore_grade,
    nova_group,
    nutrition_data_per,
    last_modified_t,
    map_from_entries(
      list_concat(
        list_transform(
          list_filter(nutriments, lambda n: n['100g'] IS NOT NULL),
          lambda n: {'key': n.name || '_100g', 'value': n['100g']}
        ),
        list_transform(
          list_filter(nutriments, lambda n: n.serving IS NOT NULL),
          lambda n: {'key': n.name || '_serving', 'value': n.serving}
        ),
        list_transform(
          list_filter(nutriments, lambda n: n.value IS NOT NULL),
          lambda n: {'key': n.name || '_value', 'value': n.value}
        )
      )
    ) AS nutriments
  FROM read_parquet('data/off/food.parquet')
  WHERE list_contains(countries_tags, 'en:germany')
) TO 'data/off/off-germany.jsonl' (FORMAT JSON);
