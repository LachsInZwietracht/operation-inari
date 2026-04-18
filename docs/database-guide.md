# Database Guide

Single source of truth for Operation Prodi's nutrition database layer: schema design, data sources, ETL pipelines, and migration strategy. Consult this when working on anything related to food data, nutrients, Supabase tables, or data imports.

---

## Table of Contents

1. [Current State of the Codebase](#1-current-state-of-the-codebase)
2. [Available Datasets — Ranked by Priority](#2-available-datasets--ranked-by-priority)
3. [Database Schema (Supabase/Postgres)](#3-database-schema-supabasepostgres)
4. [Nutrient ID Mapping — Mock to BLS 4.0](#4-nutrient-id-mapping--mock-to-bls-40)
5. [ETL Implementation Details per Source](#5-etl-implementation-details-per-source)
6. [Migration Strategy — Mock Data to Real Data](#6-migration-strategy--mock-data-to-real-data)
7. [Search Architecture](#7-search-architecture)
8. [Key Constraints and Gotchas](#8-key-constraints-and-gotchas)
9. [Sources](#9-sources)

---

## 1. Current State of the Codebase

> **Latest dev update — April 2025**
> - **Remote Supabase:** The project is connected to a hosted Supabase instance (project ref `fiywitnrtuewnvainyfe`). Local Supabase is no longer required for development. The CLI is linked via `supabase link`; push new migrations with `supabase db push`.
> - **Remote setup workflow:** After linking, push migrations (`supabase db push`), then seed nutrient definitions + data sources (run `supabase/seed.sql` against the remote DB), then run all ETL scripts: `npm run etl:bls`, `npm run etl:verify:bls`, `npm run etl:reference-values`, `npm run etl:recipes`. ETL scripts require `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars (not the `NEXT_PUBLIC_` variants).
> - **BLS pipeline:** Run `npm run etl:bls` then `npm run etl:verify:bls` (requires `SUPABASE_SERVICE_ROLE_KEY`). The verifier compares Supabase row counts with the Excel input and fails fast on drift.
> - **Local dev (optional):** If you prefer local Supabase, bring up Docker (`supabase start`), run `supabase db reset` after syncing migrations, then re-run the BLS import + verifier. The seed now requires every `data_sources.version` value (e.g., the `hersteller` source uses `'varies'`).
> - **Category mapping:** `scripts/etl/import-bls.ts` now resolves subgroup IDs (`fg_G6`, etc.) and maps them to the expanded UI categories (`cat_eier`, `cat_gewuerze`, `cat_unbekannt`). Keep those IDs in sync with `lib/mock-data/categories.ts`.
>   - Kartoffeln (`fg_K`) intentionally stay under `cat_gemuese` for now; add a dedicated category later if the UI needs potatoes separated.
> - **Recipe + meal plan seeding:** After the BLS import succeeds, run `npm run etl:recipes` to upsert the shared recipe catalog (with normalized ingredients) and the default meal plan templates. The script resolves legacy ingredient IDs to Supabase foods via their BLS codes.
> - **Supabase-only templates:** Recipes, meal plans, dashboards, and report pages no longer bundle mock fallbacks. If Supabase is empty you'll see blank states, so always run `npm run etl:recipes` after the BLS import when setting up a new environment.
> - **Data access layer:** Fetch foods via `lib/data/foods.ts` (`fetchFoods`, `fetchFoodById`). Begin swapping pages and hooks away from `@/lib/mock-data/foods` so the UI can use Supabase without refactors later.
>   - All top-level loaders (`fetchAllFoods*`) now page through Supabase in 2.5k-row batches, so `npm run etl:bls` can import all 7k+ BLS foods without truncating table views—no per-call `limit` overrides required.
>   - `lib/legacy-food-map.ts` temporarily maps the old mock IDs (`food_apfel`) to their BLS codes, but compatibility is now handled at load/persist boundaries via `lib/data/food-reference-normalization.ts`. Generic runtime calculation/render paths should no longer resolve legacy IDs ad hoc.
> - **Food delivery:** The layout now loads only a lightweight search index (`FoodSearchProvider`). Pages that actually compute nutrients wrap their client component in `FoodsProvider` *inside* the route and call `fetchAllFoods()` there. That keeps the default payload below ~200 KB while still giving dashboards/forms full data when needed.
>   - Protocol detail pages now use `fetchFoodsForProtocols()` instead of `fetchAllFoods()`, and paginated `fetchAllFoods*` loaders skip expensive `COUNT(*)` queries to reduce statement timeouts under test/dev load.
> - **Institution tooling:** `useInstitutionMenu` now derives shopping categories/costs directly from the Supabase foods (via `categoryId`). If you add new categories, update both `FOOD_CATEGORIES` and the cost table in the hook. The food detail route now queries Supabase lazily with `fetchFoodById`, so you no longer need to preload every food just to show a single detail page.
> - **Reference standards:** Sync DGE/ÖGE/SGE/RDA matrices with `npm run etl:reference-values` (filter with `--standard=dge`). The script consumes `lib/mock-data/reference-standards.ts` so the app + database stay in lockstep, and the `reference_values` table now stores fractional age ranges plus trimester-specific life stages.
> - **Export system:** Reports, patient mail-merge, and `API & Export` now create real files server-side. Export metadata is persisted in `export_jobs`; binaries are generated on demand and are not stored in the database.

### Data Model (TypeScript Types)

The app already has well-structured types that support multi-source food data:

**`lib/types/food.ts` — `Food` interface:**
- `id`, `name`, `categoryId` — basic identification
- `source`, `sourceId`, `sourceVersion` — provenance tracking (e.g., `"BLS 3.02"`, `"bls"`, `"3.02"`)
- `blsCode` — BLS code field already exists (e.g., `"G410100"` for Karotte)
- `foodGroupId` — hierarchical BLS group reference (e.g., `"fg_G4"` for Wurzelgemüse)
- `nutrients: NutrientValue[]` — array of `{ nutrientId, amount }` per 100g base
- `baseAmount: number` — always 100 in current mock data
- `isBranded`, `isCustom`, `manufacturer`, `allergens`, `additives` — metadata fields
- `co2PerPortion`, `sustainabilityScore`, `prodScore` — sustainability (nullable)

**`lib/types/nutrients.ts` — `NutrientDefinition` interface:**
- `id`, `name`, `shortName`, `unit`, `group`, `sortOrder`
- Groups: `"makronaehrstoffe"` | `"vitamine"` | `"mineralstoffe"`

**`lib/types/food.ts` — `FoodSearchItem` interface (lightweight, used by search index):**
- `id`, `name`, `categoryId` — the minimum for Cmd+K search and display
- `sourceId?`, `isCustom?` — optional metadata for filtering

**`FoodSourceId` type:** `"bls"` | `"sfk"` | `"usda"` | `"afcd"` | `"swiss"` | `"ciqual"` | `"cofid"` | `"off"` | `"hersteller"` | `"custom"`

### Current Mock Data Inventory

| File | Content | Count |
|---|---|---|
| `lib/mock-data/foods.ts` | Food items with full nutrient arrays | ~48 foods |
| `lib/mock-data/nutrients.ts` | Nutrient definitions | 28 nutrients (9 macro, 10 vitamins, 8+1 minerals) |
| `lib/mock-data/reference-values.ts` | DGE reference values (adults 25–51) | 27 nutrients × 2 genders |
| `lib/mock-data/food-groups.ts` | BLS hierarchy | 15 main groups, ~60 subgroups |
| `lib/mock-data/categories.ts` | UI categories with icons | 16 categories (incl. Eier, Gewürze, Unkategorisiert) |
| `lib/mock-data/food-sources.ts` | Source metadata | 6 sources |
| `lib/mock-data/recipes.ts` | Sample recipes | 8 recipes |
| `lib/mock-data/meal-plans.ts` | Sample daily plans | 2 plans |

### Core Nutrient IDs (28 nutrients displayed in UI)

These are the IDs used throughout the entire app — every component, calculation, and display depends on them. The database stores 42 nutrient definitions total (28 core + 14 additional from BLS 4.0), but the UI currently only renders these 28:

**Macronutrients:** `energie` (kcal), `eiweiss` (g), `fett` (g), `kohlenhydrate` (g), `ballaststoffe` (g), `zucker` (g), `gesaettigte_fettsaeuren` (g), `ungesaettigte_fettsaeuren` (g), `wasser` (ml)

**Vitamins:** `vitamin_a` (µg), `vitamin_b1` (mg), `vitamin_b2` (mg), `vitamin_b6` (mg), `vitamin_b12` (µg), `vitamin_c` (mg), `vitamin_d` (µg), `vitamin_e` (mg), `folsaeure` (µg), `niacin` (mg)

**Minerals:** `calcium` (mg), `eisen` (mg), `magnesium` (mg), `kalium` (mg), `natrium` (mg), `zink` (mg), `phosphor` (mg), `jod` (µg)

### Nutrient Calculation Pipeline (stays unchanged)

These functions in `lib/nutrients.ts` are source-agnostic and will work with real data:
- `scaleNutrients(nutrients, baseAmount, targetAmount)` — scales per-100g to any portion
- `sumNutrients(nutrientArrays)` — combines multiple foods
- `calculateRecipeNutrients(recipe, foods)` — sums scaled ingredients
- `calculatePerServing(nutrients, servings)` — divides by servings
- `percentOfReference(value, referenceValue)` — Ist/Soll percentage

### Data Persistence

**Supabase (primary):**
- Schema defined in `supabase/migrations/` (6 migration files, run in order)
- Seed data in `supabase/seed.sql` (nutrient definitions, data sources, DGE reference values)
- BLS 4.0 imported: 7,140 foods + ~265k nutrient rows + English synonyms
- Food detail pages use `fetchFoodById()` for single-record queries

**localStorage (still used for user data):**
- `prodi_custom_foods`, `prodi_custom_recipes`, `prodi_meal_plans`, `institution-menus`
- Custom foods merge with Supabase data at runtime via `useCustomFoods(baseFoods)`
- Will migrate to Supabase once auth is implemented (see Phase 5 below)

### Data Access Architecture

The app uses a two-tier data delivery pattern to balance payload size vs. functionality:

**Tier 1 — Search index (~100 KB, always loaded):**
- `fetchFoodSearchIndex()` in `lib/data/foods.ts` fetches only `id`, `name`, `category_id`, `data_source_id`, `is_custom` from Supabase
- Loaded once in `app/(app)/layout.tsx` and provided via `FoodSearchProvider` context
- Consumed by the Cmd+K search palette (`useFoodSearchIndex()`) and any component that only needs food names
- Type: `FoodSearchItem[]`

**Tier 2a — List-optimised food catalog (~2-3 MB, preferred for list/table views):**
- `fetchAllFoodsForList()` in `lib/data/foods.ts` fetches all food columns + only 13 selected nutrients (4 table display + 9 PRODIscore), no portions
- Uses the `nutrientIds` filter on `fetchFoods()` which leverages PostgREST embedded resource filtering (`food_nutrients.nutrient_id=in.(...)`)
- ~97% smaller than the full payload (~2-3 MB vs ~46 MB)
- Used by `/lebensmittel` list page, `/dashboard`, and any route that only needs table columns + scoring

**Tier 2b — Full food catalog with all nutrients (~46 MB, use sparingly):**
- `fetchAllFoods()` in `lib/data/foods.ts` fetches all columns + all `food_nutrients` + `food_portions` joins
- Required only for pages that do full nutrient math across all 37 nutrients (e.g., recipe editing, detailed meal plan analysis)
- Consumed via `useFoods()` hook in client components
- Type: `Food[]`
- Deduplicated within a single request via React `cache()`

**Key files:**
| File | Role |
|---|---|
| `lib/data/foods.ts` | All Supabase queries: `fetchFoods()`, `fetchFoodById()`, `fetchFoodsViaRpc()`, `fetchFoodsChunked()`, `fetchAllFoods()`, `fetchAllFoodsForList()`, `fetchFoodSearchIndex()` |
| `components/foods-provider.tsx` | Two React contexts: `FoodsProvider` (full data) + `FoodSearchProvider` (search index) |
| `app/(app)/layout.tsx` | Fetches search index, wraps app in `FoodSearchProvider` |
| Individual `page.tsx` files | Pages needing nutrients fetch via `fetchAllFoodsForList()` or `fetchAllFoods()` and wrap client in `FoodsProvider` |

**Pattern for new pages:**
- If you only need food names/categories: use `useFoodSearchIndex()` — no page-level fetch needed
- If you need table display nutrients + PRODIscore: use `fetchAllFoodsForList()` + `FoodsProvider` (preferred)
- If you need all 37 nutrients (e.g., full nutrient breakdown, recipe calculation): use `fetchAllFoods()` + `FoodsProvider`
- If you need protocol analysis/day views: use `fetchFoodsForProtocols()` instead of `fetchAllFoods()`
- `fetchFoods()` also accepts a `nutrientIds` string array to fetch an arbitrary subset of nutrients
- `fetchFoods()` exposes `withCount` (default `true`) to disable expensive `COUNT(*)` queries when paginating manually

---

## 2. Available Datasets — Ranked by Priority

**Strategy:** Assemble an open-data core (BLS 4.0 + national tables) and only license commercial add-ons (SFK, branded feeds) once we have paying customers to justify the cost.

### Tier 1 — Must-Have for Launch

#### BLS 4.0 (Bundeslebensmittelschlüssel)
- **Coverage:** 7,140 German foods, 138 nutrients per food
- **License:** Free (newly opened by Max Rubner Institut, 2025)[^5]
- **Format:** Excel workbook (.xlsx) download from blsdb.de (API planned)
- **Why essential:** It's the German standard for nutrition counselling and labelling (LMIV). Our mock data already uses BLS codes. Going from 48 mock foods to 7,140 real foods is the single biggest improvement.
- **Integration effort:** Medium — parse the official Excel workbook, map 138 BLS nutrient columns to our nutrient IDs, bulk-insert into Postgres
- **URL:** https://www.blsdb.de/[^5]

#### DGE Reference Values (Official)
- **Coverage:** Full nutrient reference intake values by age, gender, pregnancy/lactation status
- **License:** Publicly available from DGE publications
- **Why essential:** Our mock reference values only cover adults 25–51. Real clinical use requires age-stratified values.
- **Integration effort:** Low — manual data entry from official DGE tables into seed SQL

### Tier 2 — High Value, Low Cost (Add After BLS)

#### Open Food Facts
- **Coverage:** Millions of crowd-sourced branded products with labels, NOVA classes, Nutri-Score, barcodes
- **License:** Open Database License (ODbL) — attribution + share-alike[^12]
- **Format:** Nightly JSONL/MongoDB dumps + delta exports
- **Why valuable:** Fills the branded product gap (Barilla, Alpro, Dr. Oetker, etc.) without manufacturer agreements
- **Critical caveat:** Data quality varies enormously. **Must** use quarantine pipeline — import to staging, validate (energy present? macros approximately sum to energy? no absurd values?), promote only passing entries.
- **Integration effort:** Medium-High — nightly delta sync, validation pipeline, quarantine schema
- **URL:** https://world.openfoodfacts.org/data[^12]

#### Swiss Food Composition Database 7.0
- **Coverage:** 1,220 Swiss foods, macro + micronutrients, multilingual (DE/FR/IT/EN)
- **License:** Free for commercial/scientific reuse with attribution[^8][^9]
- **Format:** Excel download **and** REST API
- **Why valuable:** Covers DACH market, has an actual API (unlike most), multilingual names help localization
- **Integration effort:** Low — they provide an API spec
- **URL:** https://www.naehrwertdaten.ch/de/[^8]

### Tier 3 — International Expansion (Not Day-One)

| Dataset | Coverage | License | Format | URL |
|---|---|---|---|---|
| **USDA FoodData Central** | US foundation + branded; API-first, nightly updates | CC0 public domain[^6] | REST API (1,000 req/h) + JSON dumps | https://fdc.nal.usda.gov/[^6] |
| **AFCD (Australia)** | 1,534 foods, up to 256 nutrients | CC BY 2.5 AU[^7] | XLSX/CSV | https://data.gov.au/[^7] |
| **ANSES Ciqual 2020 (France)** | 3,484 French foods | Licence Ouverte[^10] | XML/XLS | https://www.data.gouv.fr/[^10] |
| **UK CoFID 2021** | McCance & Widdowson reference | Open Government Licence v3[^11] | Excel | https://www.gov.uk/[^11] |
| **EFSA EU Food Composition DB** | Pan-EU dataset (planned mid-2026) | Open access[^13] | TBD | https://www.efsa.europa.eu/[^13] |

### Tier 4 — Commercial (Only After Revenue)

- **Souci-Fachmann-Kraut (SFK):** ~800 foods, 300+ nutrients — requires paid license[^3]
- **Heseker tables:** Simplified profiles — proprietary
- **Manufacturer data modules:** Bilateral agreements per brand

---

## 3. Database Schema (Supabase/Postgres)

The full schema is defined in Supabase migration files under `supabase/migrations/`. These are the authoritative source — **do not duplicate SQL here**. The migrations run in order:

| Migration File | Content |
|---|---|
| `20260412000001_extensions.sql` | Enables `pg_trgm` (fuzzy search) and `unaccent` extensions |
| `20260412000002_nutrition_core_tables.sql` | Core tables: `data_sources`, `nutrient_definitions`, `foods`, `food_nutrients`, `food_portions`, `food_synonyms`, `food_source_mappings`, `reference_values`, `off_staging` + auto-update trigger for `updated_at` |
| `20260412000003_recipes_and_meal_plans.sql` | `recipes`, `recipe_ingredients`, `recipe_reference_targets`, `daily_meal_plans`, `meal_entries`, `diet_line_presets`, `diet_line_targets`. Note: `meal_entries.reference_id` is polymorphic (no FK — see comment in file) |
| `20260412000004_indexes.sql` | GIN trigram indexes for search, B-tree indexes for all common query patterns |
| `20260412000005_rls_policies.sql` | Row Level Security: public foods readable by all, custom foods/recipes/meal plans private per user, OFF staging admin-only. Reference tables (data_sources, nutrient_definitions, reference_values) are SELECT-only — writes require `service_role` key |
| `20260412000006_search_function.sql` | `search_foods()` Postgres function with trigram similarity, filtering, and pagination. **Must** receive `auth.uid()` as `requesting_user_id` or custom foods will be silently excluded |
| `20260427000014_invoices.sql` | `invoices` table with RLS, indexes on `user_id`/`status`/`due_date`, and auto-update trigger |
| `20260428000015_export_jobs.sql` | `export_jobs` table for persisted export/import history with user-scoped RLS |
| `20260429000016_appointments.sql` | `appointments` table with RLS, indexes on `user_id`/`date`/`type`/`patient_id`, and auto-update trigger |

**Seed data** (`supabase/seed.sql`): 10 data sources, 42 nutrient definitions (28 original + 14 from BLS 4.0), 54 DGE reference values (adults 25–51, gender-stratified).

### Table Overview

| Table | Purpose | Key columns |
|---|---|---|
| `data_sources` | Registry of imported databases | `id` (bls, off, swiss...), `version`, `imported_at` |
| `nutrient_definitions` | Canonical nutrient catalog | `id` (energie, vitamin_a...), `unit`, `bls_column_name` (BLS code for ETL) |
| `foods` | Unified food table (all sources) | `data_source_id`, `source_food_id`, `bls_code`, `food_group_id`, `category_id`, `user_id` (for custom foods) |
| `food_nutrients` | Normalized nutrient values (sparse) | `food_id`, `nutrient_id`, `amount`, `per_amount` (always 100) |
| `food_portions` | Portion size definitions | `food_id`, `label` ("Stück"), `amount_grams` |
| `food_synonyms` | Multilingual search aliases | `food_id`, `name`, `locale`, `source` (system/user) |
| `food_source_mappings` | Cross-source crosswalk | `food_id`, `external_source`, `external_id`, `confidence` |
| `reference_values` | DGE daily intake targets | `nutrient_id`, `amount`, `gender`, `age_min`, `age_max`, `life_phase` |
| `off_staging` | Open Food Facts quarantine | `barcode`, `nutriments` (JSONB), `validated`, `promoted` |
| `recipes` | User/community recipes | `user_id`, `source_type`, `servings`, `instructions` |
| `recipe_ingredients` | Recipe → food links | `recipe_id`, `food_id`, `amount` (grams) |
| `daily_meal_plans` | One plan per user per day | `user_id`, `date` (unique together) |
| `meal_entries` | Items in a meal slot | `meal_plan_id`, `slot_type`, `entry_type` (food/recipe), `reference_id` (polymorphic) |
| `diet_line_presets` | Nutritional target presets | `name`, `user_id` (NULL = system preset) |
| `invoices` | Practice billing / invoices | `user_id`, `patient_id`, `service`, `amount`, `status` (offen/bezahlt/mahnung), `due_date`, `insurance`, `notes` |
| `export_jobs` | Real export/import audit metadata | `user_id`, `type`, `format`, `scope`, `status`, `file_size`, `created_by`, `file_name`, `parameters` |
| `appointments` | Practice calendar appointments | `user_id`, `title`, `date`, `start_time`, `end_time`, `patient_id`, `type` (beratung/kontrolle/team/webinar), `recurring`, `reminder` |

### Export Job Notes

- `export_jobs` stores **metadata only**. The generated PDF/CSV/JSON binaries are returned directly by `app/api/exports/*` and are not persisted in Supabase storage in v1.
- RLS is user-scoped:
  - users can read their own export rows
  - users can insert their own export rows
- Current export producers:
  - `/api/exports/report`
  - `/api/exports/mail-merge`
  - `/api/exports/datasets`
- Current history consumer:
  - `/api/export-jobs`

### Why Normalized `food_nutrients` Instead of a JSON Array?

The current mock data stores nutrients as `NutrientValue[]` on each food object. For the database, we split this into a junction table because:

1. **Queryability:** "Find all foods with > 10mg iron" becomes a simple WHERE clause
2. **Extensibility:** BLS 4.0 has 138 nutrients. Adding more doesn't require schema changes.
3. **Aggregation:** SUM/AVG across nutrients in SQL for meal plan totals
4. **Storage efficiency:** Many foods have NULL for rare nutrients — sparse rows save space vs. 138 JSON fields

The app layer reconstructs the `NutrientValue[]` array from the query result, so existing calculation functions remain unchanged.

---

## 4. Nutrient ID Mapping — Mock to BLS 4.0

BLS 4.0 uses standardized nutrient codes as column prefixes. Each nutrient occupies 3 columns in the Excel file:
1. `CODE Description [unit/100g]` — the numeric value
2. `CODE Datenherkunft` — data provenance category (Analyse, Rezeptberechnung, Logische Null, etc.)
3. `CODE Referenz` — literature/source reference

The ETL script (`scripts/etl/import-bls.ts`) matches columns by checking if the header starts with the code followed by a space.

**Verified mapping** (confirmed against actual `BLS_4_0_Daten_2025_DE.xlsx` headers):

| Our `nutrient_id` | Our Unit | BLS Code | BLS Column Header (actual) | Notes |
|---|---|---|---|---|
| `energie` | kcal | `ENERCC` | `ENERCC Energie (Kilokalorien) [kcal/100g]` | |
| `energie_kj` | kJ | `ENERCJ` | `ENERCJ Energie (Kilojoule) [kJ/100g]` | |
| `eiweiss` | g | `PROT625` | `PROT625 Protein (Nx6,25) [g/100g]` | |
| `fett` | g | `FAT` | `FAT Fett [g/100g]` | |
| `kohlenhydrate` | g | `CHO` | `CHO Kohlenhydrate, verfügbar [g/100g]` | |
| `ballaststoffe` | g | `FIBT` | `FIBT Ballaststoffe, gesamt [g/100g]` | |
| `zucker` | g | `SUGAR` | `SUGAR Zucker (Mono- und Disaccharide), gesamt [g/100g]` | |
| `gesaettigte_fettsaeuren` | g | `FASAT` | `FASAT Fettsäuren, gesättigt, gesamt [g/100g]` | |
| `ungesaettigte_fettsaeuren` | g | *computed* | — | `FAMS` + `FAPU` (mono + polyunsaturated) |
| `wasser` | g | `WATER` | `WATER Wasser [g/100g]` | |
| `alkohol` | g | `ALC` | `ALC Alkohol (Ethanol) [g/100g]` | |
| `vitamin_a` | µg | `VITA` | `VITA Vitamin A, Retinol-Äquivalent (RE) [µg/100g]` | |
| `vitamin_b1` | mg | `THIA` | `THIA Vitamin B1 (Thiamin) [mg/100g]` | |
| `vitamin_b2` | mg | `RIBF` | `RIBF Vitamin B2 (Riboflavin) [mg/100g]` | |
| `vitamin_b6` | mg | `VITB6` | `VITB6 Vitamin B6 [µg/100g]` | **Unit mismatch!** BLS uses µg, we use mg → ETL divides by 1000 |
| `vitamin_b12` | µg | `VITB12` | `VITB12 Vitamin B12 (Cobalamine) [µg/100g]` | |
| `vitamin_c` | mg | `VITC` | `VITC Vitamin C [mg/100g]` | |
| `vitamin_d` | µg | `VITD` | `VITD Vitamin D [µg/100g]` | |
| `vitamin_e` | mg | `VITE` | `VITE Vitamin E (Alpha-Tocopherol) [mg/100g]` | |
| `folsaeure` | µg | `FOL` | `FOL Folat-Äquivalent [µg/100g]` | DFE (dietary folate equivalents) |
| `niacin` | mg | `NIAEQ` | `NIAEQ Niacin-Äquivalent [mg/100g]` | NE, includes tryptophan conversion |
| `vitamin_k` | µg | `VITK` | `VITK Vitamin K [µg/100g]` | |
| `biotin` | µg | `BIOT` | `BIOT Biotin [µg/100g]` | |
| `pantothensaeure` | mg | `PANTAC` | `PANTAC Pantothensäure [mg/100g]` | |
| `salz` | g | `NACL` | `NACL Salz (Natriumchlorid) [g/100g]` | |
| `natrium` | mg | `NA` | `NA Natrium [mg/100g]` | |
| `chlorid` | mg | `CLD` | `CLD Chlorid [mg/100g]` | |
| `kalium` | mg | `K` | `K Kalium [mg/100g]` | |
| `calcium` | mg | `CA` | `CA Calcium [mg/100g]` | |
| `magnesium` | mg | `MG` | `MG Magnesium [mg/100g]` | |
| `phosphor` | mg | `P` | `P Phosphor [mg/100g]` | |
| `eisen` | mg | `FE` | `FE Eisen [mg/100g]` | |
| `zink` | mg | `ZN` | `ZN Zink [mg/100g]` | |
| `jod` | µg | `ID` | `ID Iodid [µg/100g]` | |
| `kupfer` | µg | `CU` | `CU Kupfer [µg/100g]` | |
| `mangan` | µg | `MN` | `MN Mangan [µg/100g]` | |
| `fluorid` | µg | `FD` | `FD Fluorid [µg/100g]` | |
| `cholesterin` | mg | `CHORL` | `CHORL Cholesterin [mg/100g]` | |

### Special BLS Data Values

The ETL script must handle these non-numeric cell values correctly:

| Display | Datenherkunft | Meaning | ETL handling |
|---|---|---|---|
| Numeric value | Analyse, Literatur, etc. | Measured or derived nutrient amount per 100g | Parse as number |
| `TR` | Spuren | Trace amounts — detected but too small to measure | Store as `NULL` (not zero) |
| `-` | Fehlender Wert | No data available — NOT zero | Store as `NULL` |
| `<LOD or <LOQ` | (various) | Below detection/quantification limit | Store as `NULL` |

> **Important:** A missing value (`-`) does NOT mean the food contains zero of that nutrient. It means no reliable data is available. The UI should display "k.A." (keine Angabe), not "0".

> **Documentation reference:** The official BLS 4.0 documentation (`BLS_4_0_Dokumentation_DE.pdf`) and component reference (`BLS_4_0_Components_DE_EN.xlsx`) are included in the download and stored in `data/BLS_4_0_2025_DE/`.

**Important:** BLS 4.0 provides ~138 nutrients. Our current app only displays 28. The ETL should import **all 138** into `food_nutrients` (mapped to new `nutrient_definition` rows) but the UI only renders the ones it knows. This way, expanding the UI later doesn't require re-importing data.

### Nutrients Already Added from BLS 4.0

These nutrients were added to `nutrient_definitions` (via seed.sql) and are mapped in the ETL's `NUTRIENT_MAP` (`scripts/etl/bls-shared.ts`). The ETL imports values for all of them:

- `energie_kj` — Energy in kJ (parallel to kcal)
- `alkohol` — Alcohol (g)
- `cholesterin` — Cholesterol (mg)
- `vitamin_k` — Vitamin K (µg)
- `biotin` — Biotin (µg)
- `pantothensaeure` — Pantothenic acid (mg)
- `kupfer` — Copper (µg)
- `mangan` — Manganese (µg)
- `fluorid` — Fluoride (µg)
- `chlorid` — Chloride (mg)
- `salz` — Salt / NaCl (g)

### Nutrients Still Missing (not yet in NUTRIENT_MAP)

BLS 4.0 provides ~138 nutrients total. The ETL currently maps 34 (28 original + 6 new). Clinically relevant nutrients still unmapped:

- `mehrfach_ungesaettigte_fettsaeuren` — Polyunsaturated fatty acids (FAPU, g) — currently only used as part of the `ungesaettigte_fettsaeuren` sum
- `einfach_ungesaettigte_fettsaeuren` — Monounsaturated fatty acids (FAMS, g) — same
- `selen` — Selenium (µg) — not in current BLS NUTRIENT_MAP
- `omega_3` / `omega_6` — if available in the BLS columns (check headers)
- Various amino acids, fatty acid breakdown, organic acids, etc.

---

## 5. ETL Implementation Details per Source

### 5.1 BLS 4.0 ETL

**Implementation:**
- `scripts/etl/import-bls.ts` — main ETL script (reads Excel, upserts into Supabase)
- `scripts/etl/bls-shared.ts` — shared module (workbook parsing, `NUTRIENT_MAP`, `parseNutrientValue`) reused by both the importer and verifier
- `scripts/etl/verify-bls-import.ts` — post-import verifier (compares Supabase row counts with Excel source)

**Input:** `data/BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx` — a single Excel workbook (.xlsx), UTF-8 encoded, comma as decimal separator. The first sheet contains all 7,140 foods across 418 columns.

**Local run checklist:**
- Start Supabase locally with Docker (`supabase start` once; rerun if Docker restarts).
- Whenever you pull new migrations, run `supabase db reset` so schema + `supabase/seed.sql` are reapplied. The seed enforces non-null `data_sources.version`, so don't remove placeholder values like `'varies'` for manufacturer feeds.
- Export `SUPABASE_SERVICE_ROLE_KEY` from the Supabase CLI output (or `.env.local`) before invoking ETL scripts.
- Execute `npm run etl:bls` to import and `npm run etl:verify:bls` to confirm row counts against the Excel source.

**Output:** Rows in `foods` + `food_nutrients` + `food_synonyms`

**Column structure** (3 columns per nutrient, 138 nutrients = 414 nutrient columns + 3 identification columns + 1 BOM artifact = 418):
- Column A: `BLS Code` — 7-character alphanumeric ID (e.g., `C131000`)
- Column B: `Lebensmittelbezeichnung` — German food name
- Column C: `Food name` — English food name (stored as synonym with locale `en-US`)
- Columns D onwards: triplets of `CODE Description [unit/100g]`, `CODE Datenherkunft`, `CODE Referenz`

```
ETL Pipeline:
1. Read the .xlsx file using the SheetJS (xlsx) library
2. Parse first sheet into array of objects (headers → keys)
3. Build a code → header map by extracting the CODE prefix from each header
   (e.g., "ENERCC Energie (Kilokalorien) [kcal/100g]" → code "ENERCC")
   Only map VALUE columns, skip "Datenherkunft" and "Referenz" columns
4. For each food row:
   a. Extract BLS code (column "BLS Code") → source_food_id AND bls_code
   b. Extract German name (column "Lebensmittelbezeichnung") → name
   c. Derive food_group_id from the BLS code letter **and** subgroup digit (e.g., `G610100` → `fg_G6`), fallback to the main group if no digit exists
   d. Map that group to a UI category via `FOOD_GROUP_TO_CATEGORY` (e.g., `fg_E` → `cat_eier`, `fg_G6` → `cat_huelsenfruechte`, `fg_W` → `cat_gewuerze`)
   e. For each nutrient in NUTRIENT_MAP:
      - Look up the BLS code in codeToHeader map
      - Parse cell value (handle '-', 'TR', '<LOD or <LOQ' as NULL)
      - Apply unit conversion if needed (VITB6: µg → mg, factor 0.001)
      - Skip NULL values (no row inserted = missing data, not zero)
   f. Compute "ungesättigte Fettsäuren" = FAMS + FAPU
5. Upsert foods in batches of 200 via Supabase service role client
6. Upsert food_nutrients in batches of 2000
7. Insert English food names as food_synonyms
```

**Run command:** `npm run etl:bls` (requires `SUPABASE_SERVICE_ROLE_KEY` env var)

**Verification:** `npm run etl:verify:bls` compares Supabase row counts with the Excel workbook and fails fast if they diverge.

**Watch out for:**
- VITB6 unit mismatch: BLS provides µg, our app expects mg — ETL applies `* 0.001`
- Non-numeric cells (`-`, `TR`, `<LOD or <LOQ`) must be treated as NULL, not zero
- The Excel file has a BOM (`\uFEFF`) prefix on the first header — the script handles both `BLS Code` and `\uFEFFBLS Code`
- BLS code structure: 7 characters, first letter = main food group, digits encode subgroup + preparation method
- SheetJS parses numeric cells directly as JavaScript numbers, so German decimal commas in the .xlsx are already handled by the library (only relevant if re-exported to CSV)

### 5.2 Open Food Facts ETL

**Input:** Nightly JSONL dump or delta CSV from https://world.openfoodfacts.org/data
**Output:** Rows in `off_staging` → validated rows promoted to `foods` + `food_nutrients`

```
ETL Pipeline:
1. Download German products dump (filter: countries_tags contains 'en:germany')
2. Parse JSONL, for each product:
   a. Extract barcode → source_food_id
   b. Extract product_name_de or product_name → name
   c. Extract brands → manufacturer
   d. Extract nutriments object → raw JSONB into off_staging
3. Validation pass (on off_staging):
   a. REJECT if no energy value
   b. REJECT if no product name
   c. WARN if macros don't approximately sum to energy (±20%)
   d. WARN if any nutrient value is implausibly high (e.g., >1000g protein per 100g)
   e. Score data quality 0-1 based on completeness + consistency
4. Promotion pass:
   a. For quality_score > 0.7: insert into foods + food_nutrients
   b. Set is_branded = TRUE
   c. Map OFF nutrient keys to our nutrient_ids:
      - energy_kcal_100g → energie
      - proteins_100g → eiweiss
      - fat_100g → fett
      - carbohydrates_100g → kohlenhydrate
      - fiber_100g → ballaststoffe
      - sugars_100g → zucker
      - saturated-fat_100g → gesaettigte_fettsaeuren
      - etc.
```

**Watch out for:**
- OFF data often has `nutrition_data_per` set to "serving" not "100g" — normalize!
- Many products are duplicates or have incomplete data
- Product names are inconsistent (brand sometimes in name, sometimes not)
- ODbL license requires attribution in the app (e.g., "Product data from Open Food Facts")

### 5.3 Swiss Food Composition Database ETL

**Input:** REST API (see https://www.naehrwertdaten.ch/de/downloads/ for spec) or Excel download
**Output:** Rows in `foods` + `food_nutrients`

```
ETL Pipeline:
1. Call API endpoint for all foods (paginated)
2. For each food:
   a. Use Swiss food ID → source_food_id
   b. Use German name (field: name_de) → name
   c. Map Swiss nutrient IDs to our nutrient_ids
   d. Try to match to BLS code via name similarity (crosswalk)
3. Insert into foods with data_source_id = 'swiss'
```

**Advantage:** This is the easiest integration — they have a REST API with structured JSON responses.

### 5.4 USDA FoodData Central ETL

**Input:** REST API at https://fdc.nal.usda.gov/api-guide.html (free API key) or bulk JSON dumps
**Output:** Rows in `foods` + `food_nutrients` + `food_source_mappings`

```
Strategy: Use bulk JSON dumps for initial load, API for incremental updates.

ETL Pipeline:
1. Download Foundation Foods + SR Legacy JSON dumps
2. For each food:
   a. Use fdcId → source_food_id
   b. Use description → name (English — store in food_synonyms with locale='en-US')
   c. Map USDA nutrient numbers to our nutrient_ids
   d. Unit conversion: some USDA values use IU (International Units) — convert to µg/mg
3. Insert with data_source_id = 'usda'
```

**USDA nutrient number mapping (selection):**
| USDA # | USDA Name | Our nutrient_id |
|---|---|---|
| 1008 | Energy (kcal) | `energie` |
| 1003 | Protein | `eiweiss` |
| 1004 | Total lipid (fat) | `fett` |
| 1005 | Carbohydrate | `kohlenhydrate` |
| 1079 | Fiber | `ballaststoffe` |
| 2000 | Sugars, total | `zucker` |
| 1258 | Fatty acids, saturated | `gesaettigte_fettsaeuren` |
| 1106 | Vitamin A (RAE) | `vitamin_a` |
| 1162 | Vitamin C | `vitamin_c` |
| 1087 | Calcium | `calcium` |
| 1089 | Iron | `eisen` |

---

## 6. Migration Strategy — Mock Data to Real Data

### Phase 1: Schema Migration — COMPLETE
1. ~~Create Supabase migrations for all tables in Section 4~~ — 6 migrations in `supabase/migrations/`
2. ~~Seed `nutrient_definitions` with our existing 28 + new BLS nutrients~~ — 42 definitions in `seed.sql`
3. ~~Seed `data_sources` with source metadata~~ — 10 sources seeded (note: `hersteller` uses `version: 'varies'` as placeholder)
4. ~~Seed `reference_values` with official DGE values (age-stratified)~~ — 54 reference values (adults 25–51, gender-stratified)

### Phase 2: BLS 4.0 Import — COMPLETE
1. ~~Run BLS ETL script~~ — 7,140 foods + ~265k nutrient rows + English synonyms imported
2. ~~Verify import~~ — `npm run etl:verify:bls` confirms row counts match Excel source
3. ~~Generate food_group and category mappings~~ — `deriveFoodGroupFromBlsCode()` resolves subgroup IDs + UI categories

### Phase 3: App Migration (Mock → Supabase) — COMPLETE

All pages now fetch food data from Supabase instead of the `FOODS` mock constant. The migration followed this pattern:

**Architecture:**
- Server `page.tsx` components call `fetchAllFoods()` (or `fetchFoodById()` for detail pages)
- They wrap their client component in `<FoodsProvider>` to make data available via `useFoods()` hook
- The layout provides a lightweight search index via `<FoodSearchProvider>` (see Data Access Architecture in Section 1)

**What still uses mock data (intentionally):**
| Mock constant | Reason to keep |
|---|---|
| `BRANDED_FOODS` | Placeholder branded products until OFF integration |
| `NUTRIENT_DEFINITIONS` | Static reference data, stable across sources |
| `FOOD_CATEGORIES` | UI category catalog, stable |
| `FOOD_GROUPS` | BLS hierarchy, stable |
| `REFERENCE_VALUES` | DGE values — in Supabase seed but UI still reads mock |
| `INSTITUTION_MENUS` | Institution menu defaults — localStorage |

**What was migrated:**
- Zero remaining imports of `FOODS` from `@/lib/mock-data/foods` in any page or component
- `useCustomFoods(baseFoods)` merges localStorage custom foods with Supabase base data
- `useInstitutionMenu(recipes?)` reads foods from context, derives categories from `food.categoryId`
- Food detail pages use `fetchFoodById()` for single-record Supabase queries

### Legacy Food References in Existing Mock/Local Records

Older mock and localStorage-backed records still contain legacy food IDs such as `food_apfel` or `food_kartoffel`. Those IDs are no longer treated as valid runtime references across the app.

**Current rule:**
- Normalize legacy food references when records are loaded or persisted.
- Store canonical Supabase food IDs in active app state whenever possible.
- Do not add new runtime fallback logic in nutrient utilities, reports, or UI components.

**Where normalization currently happens:**
- Recipes
- Meal plans
- Nutrition protocols

**Resolver strategy:**
- `lib/legacy-food-map.ts` maps old mock IDs to their historical BLS codes.
- `lib/data/food-reference-normalization.ts` maps those BLS codes to the current Supabase `foods.id` values using the loaded food catalog.

**Implication for future work:**
- Any remaining legacy-heavy modules should adopt the same boundary-normalization approach.
- New persisted records must write canonical Supabase food IDs only.
- Once old mock/local records are migrated, delete `lib/legacy-food-map.ts`.

### Phase 4: Search Migration — IN PROGRESS

- ✅ Cmd+K command palette calls `search_foods()` via Supabase RPC (passing `auth.uid()` when available), with `shouldFilter={false}` so cmdk doesn't re-filter results. ILIKE substring fallback ensures short/partial queries return results even below the 0.3 trigram threshold. Local fuzzy search shows instantly while the RPC loads; remote results replace them when available.
- ⏳ `/lebensmittel` table filters still use the local fuzzy search helpers. When OFF/Swiss data lands, replace `useFoodSearch()` with server-backed queries (or pagination) so the page scales as well as the palette.

### Phase 5: localStorage → Supabase (Remaining User Data) — NOT STARTED

Custom foods plus user-created recipes/meal plans still live in localStorage (the shared templates now live in Supabase). Once Supabase auth is implemented:

1. Ship a one-off migration hook that runs on first load after the release: it reads `prodi_custom_foods`, `prodi_custom_recipes`, and `prodi_meal_plans`, POSTs them to new Supabase endpoints, and only purges the local keys after a successful `201` response.
2. If the user is not authenticated, queue the data in memory and prompt them to create an account before uploading (or keep the local fallback until auth is available).
3. Log every migration attempt (success/failure) to Sentry so CS can help recover data if the upload fails.
4. After a grace period (e.g., two releases), remove the migration code and treat the absence of Supabase data as "fresh account".

Document this behavior in the release notes so testers know their custom entries will be moved server-side.

### Phase 6: Payload Optimization — PARTIALLY COMPLETE

`fetchAllFoods()` loads all 7,140 foods with all 37 nutrients + portions (~46 MB). This caused Playwright test timeouts and sluggish page loads.

**Done:**
- Added `nutrientIds` filter to `fetchFoods()` — uses PostgREST embedded resource filtering to fetch only selected nutrients
- Created `fetchAllFoodsForList()` — fetches 13 nutrients (4 table display: energie/eiweiss/fett/kohlenhydrate + 9 PRODIscore), no portions (~2-3 MB)
- Switched `/lebensmittel` and `/dashboard` to use the lighter fetch

**Remaining:**
1. **Migrate more pages:** Other routes still use `fetchAllFoods()` — audit each to determine if `fetchAllFoodsForList()` suffices
2. **Paginated client hooks:** Replace the "load everything" pattern with paginated React Query hooks backed by Supabase server-side filtering
3. **On-demand nutrient fetch:** Fetch full nutrients lazily only when a user drills into a food detail page

---

## 7. Search Architecture

### Current: Client-Side Fuzzy Search (operating on 7,140 BLS foods)
- Layout loads a lightweight search index (`FoodSearchItem[]` — id, name, categoryId only, ~100 KB) via `fetchFoodSearchIndex()`
- Cmd+K palette calls the `search_foods()` Postgres RPC for typed queries; falls back to the lightweight `FoodSearchProvider` list while idle
- `/lebensmittel` table still uses client-side `fuzzySearchFoods()` for filtering
- Cologne phonetics for German sound matching ("Karotte" ↔ "Garotte")
- Trigram similarity scoring
- Synonym lookup via `useFoodSynonyms()` hook
- Works acceptably for 7,140 foods but will degrade with OFF/Swiss additions (10k+ items)

### Deployed: Postgres Trigram + ILIKE Search

The `search_foods()` Postgres function combines trigram similarity (`%` operator) with ILIKE substring fallback for short queries. See `supabase/migrations/20260412000006_search_function.sql` for the full implementation.

**Key details:**
- `shouldFilter={false}` on the cmdk `Command` component — prevents cmdk from re-filtering our server-ranked results
- ILIKE fallback ensures short queries (e.g. "Ei") that fall below the 0.3 trigram threshold still return results
- **Must** pass `auth.uid()` as `requesting_user_id` or custom foods will be silently excluded

**Troubleshooting empty search results:** Check (1) PostgREST `max_rows` in `config.toml`, (2) auth token being passed correctly, (3) RLS policies allowing `authenticated` role to read `foods`.

**Future:** Port Cologne phonetics to a Postgres function for server-side German sound matching.

---

## 8. Key Constraints and Gotchas

### Unit Normalization
- BLS reports per 100g raw weight — implement yield-factor service for cooked foods
- USDA uses IU for some vitamins — convert: 1 IU Vitamin A = 0.3 µg RAE, 1 IU Vitamin D = 0.025 µg
- OFF sometimes reports per serving, not per 100g — always normalize to per 100g

### Data Quality
- BLS 4.0 is authoritative — treat as ground truth
- OFF data needs quarantine validation before clinical use
- "Missing" nutrient values (NULL) are different from zero — a food with no iron data ≠ 0mg iron
- Display "keine Daten" or "k.A." for NULL nutrients, not "0"

### German Number Formatting
- The official ETL reads the `.xlsx` file via SheetJS (numbers already parsed). If you ever re-export to CSV, remember German decimals use comma (`12,5` = 12.5) and normalize before parsing.

### Licensing & Attribution
- BLS 4.0: free, likely attribution required (check terms on blsdb.de)
- Open Food Facts: ODbL — must display attribution ("Data from Open Food Facts") and share-alike for derivatives
- Swiss DB: attribution required
- USDA: CC0, no restrictions
- Track license requirements in `data_sources` table

### FoodSourceId Type
The TypeScript type in `lib/types/food.ts` already covers all planned sources:
```typescript
type FoodSourceId = "bls" | "sfk" | "usda" | "afcd" | "swiss" | "ciqual" | "cofid" | "off" | "hersteller" | "custom";
```
When adding a new data source, add its ID here and insert a matching row in `data_sources` (via seed or migration).

### PostgREST `max_rows` Limit (Critical)

`supabase/config.toml` defines `max_rows` which caps rows PostgREST returns for **any** query, silently truncating results. Currently set to `10000` (sufficient for 7,140 BLS foods).

**Symptoms of a too-low `max_rows`:** searches for valid foods return zero results; the food list appears complete but is missing entries; no error is surfaced. Long-term fix: server-side pagination.

### BLS Food Group Letter Mapping

BLS code first letter maps to food groups. Note: **S = Süßwaren (sweets), T = Fische (fish)** — verify against actual BLS data when adding new mappings (e.g., Honig = S120000, Lachs = T410100).

If adding new food group mappings, verify against actual BLS data (e.g., Honig has code S120000 = Süßwaren, Lachs has code T410100 = Fisch).

### Legacy Food ID Compatibility

- Do not reintroduce runtime `foodId -> blsCode -> food` fallback logic in shared utilities or UI components.
- If a workflow still receives `food_*` mock IDs, normalize them at ingestion/load time via `lib/data/food-reference-normalization.ts`.
- `lib/legacy-food-map.ts` is transitional migration support only, not an application-level lookup layer.

### Performance Considerations

**Current architecture (7,140 BLS foods):**
- Layout ships a ~100 KB search index to every page (acceptable)
- List pages use `fetchAllFoodsForList()` — 13 nutrients only, ~2-3 MB (down from ~46 MB with all 37 nutrients + portions)
- Pages requiring full nutrient math use `fetchAllFoods()` — all 37 nutrients + portions (~46 MB, use sparingly)
- Protocol detail pages use `fetchFoodsForProtocols()` — protocol analysis/day-view nutrient subset, smaller than `fetchAllFoods()`
- Food detail pages use `fetchFoodById()` for single-record queries (efficient)
- React `cache()` deduplicates fetches within a single server request
- The `nutrientIds` filter on `fetchFoods()` uses PostgREST embedded resource filtering — it does NOT use `!inner`, so foods missing a particular nutrient are still returned (with an empty nutrients array for that nutrient)

**RPC-based food fetching:**
- Bulk food loading uses `fetchFoodsViaRpc()` which calls the `get_foods_with_nutrients` Postgres function
- Returns foods with pre-aggregated nutrients in a single round-trip (vs. PostgREST's separate joins)
- Supports `nutrient_filter`, `food_id_filter`, `page_limit`, and `page_offset` parameters
- Falls back to `fetchFoods()` with matching `limit`/`offset` if the RPC call fails

**Chunked caching (`fetchFoodsChunked`):**
- Next.js `unstable_cache` has a **2 MB per-entry limit** — entries exceeding this are silently dropped
- With ~7,140 foods, even the lightest variant (13 nutrients) serializes to ~21 MB — far above the limit
- `fetchFoodsChunked()` in `lib/data/foods.ts` solves this by splitting fetches into pages that each stay under 2 MB:
  1. Dynamically computes a safe chunk size based on nutrient count (`~1.5 MB target / estimated bytes per food`)
  2. Fetches each chunk via `fetchFoodsViaRpc()` with `limit`/`offset`
  3. Caches each chunk independently via `unstable_cache` with its own key (e.g., `foods-list-chunk-0`, `foods-list-chunk-1`)
  4. Reassembles all chunks into a single `Food[]`
- All 6 cached wrappers (`fetchAllFoods`, `fetchAllFoodsForList`, `fetchFoodsForMealPlans`, `fetchFoodsForReports`, `fetchFoodsForProtocols`, `fetchFoodsForInstitution`) use `fetchFoodsChunked`
- Dynamic chunk sizes by variant:

| Wrapper | Nutrients | ~Chunk size | ~Chunks |
|---|---|---|---|
| `fetchAllFoodsForList` | 13 | 1,935 | 4 |
| `fetchFoodsForMealPlans` | 16 | 1,666 | 5 |
| `fetchFoodsForReports` | 16 | 1,666 | 5 |
| `fetchFoodsForProtocols` | 28 | 1,304 | 6 |
| `fetchFoodsForInstitution` | 265 | 197 | 37 |
| `fetchAllFoods` | 265 | 197 | 37 |

- `fetchFoodSearchIndex` is **not** chunked — it fetches only 5 columns with no nutrients, well under 2 MB

**When to revisit (triggers for remaining Phase 6 work):**
- Total food count exceeds ~15k (e.g., after OFF integration) — search index grows past ~300 KB
- List payload exceeds ~5 MB — add server-side pagination
- Specific pages feel slow — consider fetching only referenced foods (e.g., only ingredients in a recipe) instead of the full catalog
- Consider materialized views for "top nutrients per food" if needed

### Playwright Testing with Supabase Auth

When `.env.local` provides `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the app's middleware enforces authentication on all routes. Playwright tests use a global setup (`tests/auth.setup.ts`) that:
1. Creates a test user via the Supabase Admin API (using `SUPABASE_SERVICE_ROLE_KEY`)
2. Logs in through the UI at `/login`
3. Saves the authenticated session to `tests/.auth/user.json` (storageState)
4. All test projects depend on this setup and reuse the saved auth state

**Test credentials** (defined in `tests/auth.setup.ts`):
- Email: `test@prodi.local`
- Password: `test-password-123!`

These are created automatically by the auth setup via the Supabase Admin API. They only exist in the local Supabase instance and are safe to commit — do **not** reuse them for production or staging environments.

The `playwright.config.ts` manually parses `.env.local` since Playwright doesn't use Next.js env loading.

### Versioning & Auditing
- Store `data_source.version` and `imported_at` on every food
- When BLS releases an update: import new version, keep old foods marked with old version
- Recipes/meal plans reference food UUIDs — if a food's nutrients change, existing historical plans should optionally reference a snapshot (future consideration)

---

## 9. Sources

[^1]: https://www.nutri-science.de/software/prodi.php
[^2]: https://www.nutri-science.de/software/nutribase.php
[^3]: https://www.wissenschaftliche-verlagsgesellschaft.de/produkt/souci-fachmann-kraut-naehrwert-tabellen-9-ueberarbeitete-und-ergaenzte-auflage/
[^4]: https://www.mri.bund.de/de/institute/ernaehrungsverhalten/forschungsbereiche/bundeslebensmittelschluessel-bls/
[^5]: https://www.blsdb.de/
[^6]: https://fdc.nal.usda.gov/api-guide.html
[^7]: https://data.gov.au/data/dataset/http-www-foodstandards-gov-au-science-monitoringnutrients-afcd-pages-default-aspx
[^8]: https://www.naehrwertdaten.ch/de/
[^9]: https://www.naehrwertdaten.ch/de/downloads/
[^10]: https://www.data.gouv.fr/fr/datasets/table-de-composition-nutritionnelle-des-aliments-ciqual-2020/
[^11]: https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid
[^12]: https://world.openfoodfacts.org/data
[^13]: https://www.efsa.europa.eu/en/data-report/food-composition-data
