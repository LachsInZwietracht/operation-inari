-- ============================================================================
-- Core nutrition data tables
-- ============================================================================

-- Tracks which external databases we've imported (BLS, OFF, Swiss, USDA, etc.)
CREATE TABLE data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record_count INTEGER,
  nutrient_count INTEGER,
  license TEXT,
  url TEXT
);

-- Canonical nutrient definitions (superset of all sources)
-- Starts with our 28 mock nutrients, will grow to 138+ with BLS 4.0
CREATE TABLE nutrient_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  nutrient_group TEXT NOT NULL
    CHECK (nutrient_group IN ('makronaehrstoffe', 'vitamine', 'mineralstoffe', 'aminosaeuren', 'fettsaeuren', 'sonstige')),
  sort_order INTEGER NOT NULL,
  -- ETL mapping helpers
  bls_column_name TEXT,
  eurofir_code TEXT
);

-- Unified food table — all sources merge here
CREATE TABLE foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,

  -- Source provenance
  data_source_id TEXT NOT NULL REFERENCES data_sources(id),
  source_food_id TEXT NOT NULL,
  source_version TEXT,

  -- BLS code as canonical crosswalk key (NULL for non-BLS foods)
  bls_code TEXT,

  -- Classification
  food_group_id TEXT,
  category_id TEXT,

  -- Metadata
  manufacturer TEXT,
  allergens TEXT[],
  additives TEXT[],
  tags TEXT[],
  is_branded BOOLEAN NOT NULL DEFAULT FALSE,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  is_recipe_derived BOOLEAN NOT NULL DEFAULT FALSE,

  -- Sustainability (nullable until data available)
  co2_per_portion NUMERIC,
  sustainability_score NUMERIC,
  prod_score NUMERIC,

  -- Quality tracking (used for OFF quarantine validation)
  data_quality_score NUMERIC,

  -- Timestamps
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- For user-created custom foods (RLS)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Prevent duplicate imports from the same source
  UNIQUE(data_source_id, source_food_id)
);

-- Normalized nutrient values — one row per food per nutrient
-- Sparse: only stores nutrients that have actual data (no rows for missing values)
CREATE TABLE food_nutrients (
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  nutrient_id TEXT NOT NULL REFERENCES nutrient_definitions(id),
  amount NUMERIC NOT NULL,
  per_amount NUMERIC NOT NULL DEFAULT 100,
  PRIMARY KEY (food_id, nutrient_id)
);

-- Portion size definitions per food (e.g., "1 Stück = 120g")
CREATE TABLE food_portions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_grams NUMERIC NOT NULL
);

-- Food synonyms for search (multilingual aliases, user-defined names)
CREATE TABLE food_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'de-DE',
  source TEXT NOT NULL DEFAULT 'system'
    CHECK (source IN ('system', 'user')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Crosswalk for mapping foods across sources
-- e.g., a BLS food mapped to its USDA equivalent
CREATE TABLE food_source_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  external_source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 1.0
    CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(food_id, external_source)
);

-- DGE/ÖGE reference values — age and gender stratified
CREATE TABLE reference_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nutrient_id TEXT NOT NULL REFERENCES nutrient_definitions(id),
  amount NUMERIC NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('m', 'w')),
  age_min INTEGER,
  age_max INTEGER,
  life_phase TEXT CHECK (life_phase IS NULL OR life_phase IN ('pregnancy', 'lactation')),
  source TEXT NOT NULL DEFAULT 'DGE 2024',
  label TEXT NOT NULL
);

-- Open Food Facts quarantine staging table
-- Products land here first and must pass validation before promotion to foods
CREATE TABLE off_staging (
  barcode TEXT PRIMARY KEY,
  product_name TEXT,
  brands TEXT,
  categories TEXT,
  countries_tags TEXT[],
  nutriments JSONB,
  data_quality_errors JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated BOOLEAN NOT NULL DEFAULT FALSE,
  promoted BOOLEAN NOT NULL DEFAULT FALSE,
  validation_errors TEXT[]
);

-- ============================================================================
-- Trigger: auto-update updated_at on foods
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER foods_updated_at
  BEFORE UPDATE ON foods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
