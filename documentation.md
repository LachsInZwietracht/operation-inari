# Operation Prodi - Feature Guide

## 1. How to Use This Document

Purpose:
- This is an implementation guide for engineers and AI agents working on unfamiliar features.
- Use it to find the relevant route, components, hooks, data flow, and persistence model before editing.

Precedence:
- Code and migrations are the source of truth.
- Use this guide as a map, not as permission to assume behavior without checking the implementation.
- `docs/database-guide.md` is authoritative for nutrition-data and Supabase schema details.
- `docs/product-requirements.md` is a roadmap and product-intent document, not an implementation spec.

Working assumptions:
- Production UI lives under `app/(app)`.
- Auth routes live under `app/(auth)`.
- `app/page.tsx` redirects to `/dashboard`.
- Most stateful features use Supabase-first persistence with `localStorage` fallback where noted.
- `middleware.ts` currently uses `DISABLE_AUTH_FOR_TESTING = true` for local development. Treat that as a temporary local convenience, not a product invariant.

Validation note:
- Prefer proportional validation. Use the lightest reliable check for the area you changed.
- For nutrient math changes, run `npm run validate:nutrients`.
- For workflow changes, run the most relevant Playwright coverage instead of defaulting to the full suite.

## 2. Global Architecture Overview
- **Rendering:** Next.js 15 with server rendering and `<Suspense>` boundaries for heavier routes.
- **Caching:** BLS food data is cached via `unstable_cache` where applicable.
- **Layout stack:** `app/layout.tsx` applies fonts, theme provider, toasts. `app/(app)/layout.tsx` wires the `SidebarProvider`, `AppSidebar`, and global search. It is **non-blocking** (search index is lazy-loaded on demand).
- **Command palette:** `components/food-search-command.tsx` provides global `cmd+k` food search. The search index is loaded on first use via `/api/foods/search-index`.
- **Mock data + utilities:**
  - `@/lib/nutrients.ts`, `@/lib/reference-values.ts`, `@/lib/prodi-score.ts`, `@/lib/sustainability.ts` implement calculation logic shared across features.
- **Stateful hooks:** CRUD hooks in `hooks/` (e.g., `usePatients`, `useCustomFoods`, `useRecipes`) follow a **Supabase-first with local fallback** pattern where implemented. Data is synced to the cloud when authenticated but remains available in `localStorage` for offline use.
- **Reference values:** Official DGE/ÖGE/SGE/RDA rows now load from Supabase. Custom profiles, user defaults, and patient-specific assignments persist remotely with bundled fallback data for pre-migration environments.
- **Export pipeline:** Real file generation lives behind server routes in `app/api/exports/*`. Client pages build typed payloads, the server renders PDF/CSV output, and export metadata is written to `export_jobs`.

## 3. Data & State Layers
- **Supabase-First Persistence:** 
  - **Patients, Recipes, Meal Plans, Institution Menu Plans, Protocols, Invoices, Appointments:** All have full backend persistence.
  - **Counseling workflow:** Counseling sessions and counseling templates now persist in Supabase with local fallback and login-time migration from older local-only browser data.
  - **Patient clinical workspace:** Anthropometrics, diagnoses, medications, screenings, lab values, activities, therapy settings/integrations, PROCAM, and digital protocol links are all persisted in Supabase with automatic local fallback and login-time migration.
  - **Digital protocol submissions:** Public patient diary submissions are persisted in `digital_protocol_submissions` and can be marked `new`, `reviewed`, or `converted` with an attached `converted_protocol_id`.
  - **Still local-only in the patient workspace:** Demo analytics panels and assistant cards remain client-side only unless otherwise noted.
  - **Auto-Migration:** Hooks migrate dirty local data to Supabase on login where that behavior is implemented.
  - **Robustness:** All database calls use `withTimeout` and `try-catch` to ensure the UI stays responsive even if the backend is slow.
- **Foods & Search:**
  - **Search-on-Demand:** Instead of pre-fetching the full food catalog, the app uses a lightweight search index. Full food details are fetched only when needed.
  - **Server-backed foods browser:** `/lebensmittel` no longer hydrates the full list view into the client. The route loads an initial paginated server result and the client fetches subsequent pages through `/api/foods/browser`.
  - **Client-safe fetchers:** `lib/data/foods-client.ts` provides optimized browser-side Supabase queries.
- **Scientific Integrity:** 
  - All nutrient calculations are mathematically validated against the BLS 4.0 ground truth via `scripts/validate-nutrient-math.ts`.
- **Cached Recipe Nutrients:** Recipes store their calculated totals in the database (`cached_kcal_per_portion`, etc.) to allow for instant rendering in lists without ingredient hydration.

## 4. Feature Reference
Each subsection includes route, core components, important hooks/utilities, and extension notes.

### 4.1 Dashboard (`/dashboard`)
- **Implementation:**
  - `app/(app)/dashboard/page.tsx` uses **two independent `<Suspense>` boundaries** to optimize LCP:
    1. **`DashboardMetrics`** (renders instantly) — fetches only recipes, meal plans, and the lightweight search index in parallel. Renders `DashboardMetricsClient` with the page header, 3 metric cards (food count, recipe count, active plan), and quick action buttons.
    2. **`DashboardNutritionSection`** (streams in after food fetch) — fetches recipes + meal plans (deduped by React `cache()`), extracts referenced food IDs, then fetches only those foods via `fetchFoodsViaRpc`. Renders `DashboardNutritionClient` with the kcal card, macro ring chart, and meal plan detail.
  - This split avoids blocking the visible header/metrics on the sequential food fetch chain (recipes → extract IDs → foods RPC).
  - **Components:** `dashboard-metrics-client.tsx` (top), `dashboard-nutrition-client.tsx` (bottom).

### 4.2 Lebensmittel (Foods) (`/lebensmittel`)
- **Listing + search:** `app/(app)/lebensmittel/page.tsx`
  - Server page calls `fetchFoodsBrowserPage()` for the initial result set and the initial OFF-branded tab payload.
  - Client page (`lebensmittel-client.tsx`) keeps the existing search modes and filters, but fetches page changes through `/api/foods/browser`.
  - Hooks: `useCustomFoods`, `useFoodSynonyms`.
  - UI: Search mode buttons, filters (source, categories), paginated results table, OFF-branded products tab.
  - Data: `FOOD_CATEGORIES`, `FOOD_SOURCES`, `FOOD_GROUPS`, `fetchFoodsBrowserPage()`, `/api/foods/browser`.
- **Group navigation:** `FoodGroupTree` uses `FOOD_GROUPS`; ensure new groups update `getFoodGroupDescendants`.
- **Search contract:** name-mode search prefers the `search_foods_with_total` RPC and falls back to `search_foods()` if the new migration has not been applied yet. Code/group/browse modes use direct paginated Supabase queries.
- **Custom foods:** Page 1 still merges local custom-food migration candidates so offline or unauthenticated entries remain visible, but authenticated saves now canonicalize to Supabase IDs immediately and localStorage keeps only unmigrated/offline entries.
- **OFF details:** Foods with `sourceId === "off"` show attribution ("Produktdaten von Open Food Facts") and `dataQualityScore` in the detail page.

### 4.6 Rezepte Overview (`/rezepte`)
- **Component:** `app/(app)/rezepte/page.tsx`
  - Uses `<Suspense>` for the recipe list.
  - **Cached Rendering:** Recipe cards display kcal/macros instantly using cached values from the `recipes` table, avoiding heavy ingredient loading for the entire list.
  - **Meal-Master Import:** Supports uploading legacy `.mmf` or `.txt` recipe formats. Parses the file structure and uses NLP to intelligently match string ingredients against the BLS database. If an ingredient cannot be perfectly matched, an interactive `RecipeImportReviewDialog` is presented allowing the user to manually search and resolve the ingredient before saving.

### 4.7 Recipe Detail (`/rezepte/[id]`)
- **Routing:** `app/(app)/rezepte/[id]/page.tsx` fetches the recipe from Supabase.
- **Optimization:** No longer loads the full 7,000 food catalog.
- **Hydration:** The page fetches recipe metadata first, then **asynchronously hydrates** only the specific foods used as ingredients via `fetchFoodsByIds`.

### 4.8 Recipe Form (`/rezepte/neu`, `/rezepte/[id]/bearbeiten`)
- **Component:** `components/recipe-form.tsx`
  - Uses `FoodSearchDialog` for on-demand ingredient selection.
  - **Local-Save First:** Always persists to `localStorage` before attempting Supabase sync, ensuring data safety for offline/unauthenticated users.
  - **Nutrient Caching:** Automatically calculates and persists calorie/macro totals into the `recipes` table for performant list rendering.

### 4.13 Patient Detail (`/patienten/[id]` + nested tabs)
- **Clinical record core:**
  - Anthropometrie, Diagnosen, Medikamente, Screening history, Laborwerte, Aktivität, Therapiemodule/-integrationen, PROCAM, and digitale Protokoll-Links now use Supabase-first persistence with offline `localStorage` fallback.
  - The patient-detail tabs show sync-aware empty states while remote data is loading after authentication.
  - Medical calculators (Creatinine Clearance, MNA, SGA) are fully integrated. Cockcroft-Gault now supports `mg/dL` and `µmol/L`, stores structured calculation metadata in the lab record, and shows the applied weight basis. MNA covers the full 18-item form, and SGA stores the expanded history/physical assessment answers in `patient_screenings`.
  - The patient workspace now exposes a patient-bound `ReferenceProfileSelector`, so protocol analysis and related comparisons use the same persisted reference assignment for that patient.
- **Digital Protocols:**
  - Practitioners create public protocol links in the `Protokolle` tab and can review incoming submissions directly in the patient workspace.
  - `app/protokoll/[linkId]` hosts the public patient-facing form. Submissions post to `/api/protokoll/submit`, which validates the link, stores the submission, and moves the link to `received`.
  - Submitted diaries can be opened as a prefilled draft via `/patienten/[id]/protokolle/neu?digitalSubmission=<id>`.
  - Draft generation uses `lib/digital-protocol-conversion.ts`: confident food matches are prefilled as protocol rows, unmatched free text is preserved in notes, and the resulting protocol metadata records the submission source.
  - Final conversion is completed server-side through `/api/digital-protocol-submissions/convert`, which sets the submission status to `converted` and stores the created protocol ID.
- **Smart-Eingabe (NLP Lite):** The `ProtocolForm` includes an AI-assisted input that allows entering food like "1 Glas Apfelsaft" or "2 Scheiben Brot".
- **NLP Engine:** `lib/nlp-matching.ts` parses free-text for quantity, unit, and food name using keyword heuristics.
- **Persistence:** Protocols use `useProtocols` for Supabase-first persistence with automatic local fallback.

### 4.14 Berichte (`/berichte`)
- **Component:** `app/(app)/berichte/berichte-client.tsx`
  - Builds a typed `ReportExportRequest` from the currently selected plan, visible nutrient rows, active sections, and resolved placeholder notes.
  - Generic report comparisons now use the persisted user default reference preference instead of a hardcoded DGE adult baseline.
  - **Patient-aware handoff:** accepts optional `patientId`, `planId`, and `protocolId` query params. `patientId` adds a context banner, `planId` preselects a valid plan once on load, and `protocolId` is informational only in v1.
  - **Patient-bound reopen:** accepts `reportId` to reload a saved patient report record, restore the saved report length/sections/notes, and reopen the linked plan context.
  - **Archived reopen:** accepts `reportVersionId` to open a frozen patient report version from stored snapshot data instead of recalculating from the current meal plan.
  - **Real exports:** `PDF erstellen` and `CSV/Nährstoffdaten` POST to `/api/exports/report`.
  - **Patient report persistence:** non-inline exports with valid patient + plan context now create or update a `patient_reports` parent record, append an immutable `patient_report_versions` row, and upload the generated file to private Supabase Storage.
  - **Archived mode:** historical report versions render as read-only snapshot views, expose direct file download, and remain readable even if the source meal plan changes later.
  - **Preview:** `Druckvorschau anzeigen` requests the same PDF payload with inline disposition and opens it in a new tab.
  - **Contract boundary:** the page owns selection and payload assembly; rendering lives in `lib/exports/pdf.tsx` and CSV formatting in `lib/exports/csv.ts`.

### 4.15 Patienten Mail Merge (`/patienten`)
- **Component:** `app/(app)/patienten/page.tsx`
  - The authoring UI for templates/placeholders is still client-side.
  - **Real exports:** `Dokumente erzeugen` now renders a merged PDF via `/api/exports/mail-merge` instead of creating a local text bundle.
  - **Batch tracking:** the existing client batch history is still used for UI state, but the actual export is also logged to `export_jobs`.

### 4.16 API & Export (`/api-export`)
- **Component:** `app/(app)/api-export/page.tsx`
  - Export cards now call `/api/exports/datasets` with typed `format` + `scope` combinations.
  - The default report export builder resolves references via the same user preference pipeline used in the interactive UI.
  - **Supported v1 scopes:** CSV for Lebensmittel/Rezepte/Patienten/Ernährungspläne/Berichte, JSON for Lebensmittel/Rezepte/Patienten/Ernährungspläne, PDF for Patienten/Berichte.
  - **History:** the `Verlauf` tab loads real persisted rows from `/api/export-jobs`; the former mock `EXPORT_HISTORY` list is no longer the source of truth for exports.

### 4.17 Beratungen (Patient Counseling)
- **New counseling session:** `app/(app)/patienten/[id]/beratungen/neu/page.tsx` uses `components/counseling-session-form.tsx`.
- **Counseling detail:** `app/(app)/patienten/[id]/beratungen/[beratungId]/page.tsx` renders the session workspace for timeline entries, materials, and progress metrics.
- **Persistence:** `hooks/use-counseling.ts` is Supabase-first with localStorage fallback, remote sync, and migration of legacy local-only sessions after login.
- **Bootstrap behavior:** Supabase-backed patient/practice hooks initialize from local migration candidates only; canned mock rows are no longer injected into runtime state before remote sync.
- **Template source:** `components/counseling-template-picker.tsx` now reads live templates from `hooks/use-counseling-templates.ts` instead of importing static mock data directly.
- **Data layer:** `lib/data/counseling-client.ts` handles `counseling_sessions` and `counseling_templates`, including legacy-id migration support and patient ID resolution against the `patients` table.
- **Schema:** migration `20260508000024_counseling.sql` adds the counseling tables, patient foreign key, JSONB payloads for timeline/material/progress sections, and per-user RLS policies.

### 4.18 Praxis-Statistiken (`/praxis-statistiken`)
- **Component:** `app/(app)/praxis-statistiken/page.tsx` (client component)
- **Data sources:** All KPIs and charts are dynamically computed from real data via `usePatients`, `usePracticeAppointments`, and `usePracticeInvoices`. There are no hardcoded mock KPIs.
- **Dynamic KPIs (top row, 4 cards):**
  - **Aktive Patienten** — total patient count with new-patient trend.
  - **Sitzungen (Monat)** — current month appointment count vs. previous month.
  - **Ø Sitzungsdauer** — average duration in minutes, compared to previous month.
  - **Umsatz (Monat)** — current month invoice total, compared to previous month.
  - Each KPI shows a trend indicator (TrendingUp / TrendingDown / Minus) comparing the current month against the previous month, using a 2 % threshold in `getTrend()`.
- **Time-range filter:** A `<Tabs>` strip below the KPIs filters appointments, invoices, and demographic charts by range:
  - Dieser Monat | Letzte 3 Monate | Dieses Jahr | Gesamt.
  - KPIs always compare current vs. previous month regardless of the selected range.
- **Charts (Recharts):**
  - **Timeline Terminvolumen** — `LineChart` showing daily appointment and patient-slot counts.
  - **Mix der Termine** — `BarChart` with appointment type breakdown (Beratung, Follow-up, Team, Workshop).
  - **Monatlicher Umsatz** — stacked `BarChart` (Bezahlt vs. Offen/Mahnung) aggregated by month.
- **Patient Demographics (3-column grid):**
  - **Geschlechterverteilung** — donut `PieChart` (Männlich / Weiblich / Divers).
  - **Top Indikationen** — horizontal `BarChart` showing the 5 most common patient indications.
  - **Neuzugänge** — `BarChart` of new patients per month within the selected time range.
- **Additional analytics:**
  - **Leistungsauslastung** — progress bars for slot utilization (current week vs. 20-slot capacity), payment rate, and recurring appointment share.
  - **Statistische Kennzahlen** — table with mean/min/max/std for appointment duration, invoice amount, and active patient count.
  - **Umsatz & Risiken** — summary cards for total revenue, outstanding amount, average ticket, and overdue invoice count.
  - **Warnungen** — list of overdue invoices with destructive badges.
- **Utilities:** `calculateDurationMinutes()` derives session length from start/end times; `computeStats()` calculates descriptive statistics; `getTrend()` classifies month-over-month change.
- **Extension notes:** To add new KPIs, append to the `dynamicKpis` array in the main `useMemo`. New chart sections can be added to the grid layout. The time-range filter automatically propagates via `rangeStart` to any `useMemo` that depends on `filteredAppointments` or `filteredInvoices`.

### 4.19 Einrichtung – Menüplanung (`/institution/menueplaene`)
- **Route:** `app/(app)/institution/menueplaene/page.tsx` (server) → `menueplaene-client.tsx` (client).
- **Server data:** `fetchMenuPlans()` from `lib/data/menu-plans.ts` reads the authenticated user's Supabase menus (plus any shared `user_id IS NULL` rows) and otherwise returns an empty list.
- **Hook:** `useInstitutionMenu(initialMenus, recipes)` in `hooks/use-institution-menu.ts`. Follows the Supabase-first + localStorage fallback pattern.
  - **CRUD:** `createMenu(params)` generates a UUID and persists locally + Supabase. `deleteMenu(menuId)` removes from state and calls `deleteMenuPlanClient`. `setMenuStatus(menuId, status)` toggles between `draft`/`active`/`archived`.
  - **Editing:** `assignRecipe`, `removeRecipe`, `updatePortionCount` modify slots in the nested week→day→dietMenu→slot structure and sync to Supabase.
  - **Derived data:** `generateProductionList(menuId, week, day)` and `generateShoppingList(menuId, week)` compute ingredient aggregations with category-based cost estimates from the food database.
- **Client data layer:** `lib/data/menu-plans-client.ts` provides `fetchMenuPlansClient`, `persistMenuPlan`, and `deleteMenuPlanClient` for browser-side Supabase operations.
- **UI features:**
  - **Empty state:** When no menu exists yet, the page shows an explicit onboarding card instead of pre-populated demo plans.
  - **Drag-and-drop planner:** Recipes are dragged from a Sheet sidebar (`Rezeptbibliothek`) into a 7-day × 3-meal grid per diet form tab. Drop triggers a portion count dialog.
  - **Create dialog:** Name, cycle length (1/2/4 weeks), start date, and multi-checkbox diet form selection.
  - **Delete:** AlertDialog confirmation, disabled when only one menu remains.
  - **Status toggle:** DropdownMenu on the card badge to switch Aktiv/Entwurf/Archiviert.
  - **Sync indicator:** Shows "Gespeichert" with check icon or "Synchronisiere…" with spinner.
  - **Production tab:** Day-selectable production list with expandable ingredient details.
  - **Shopping tab:** Category-grouped shopping list with portion scaling and CSV export.
- **Extension notes:** To add new meal slots, extend `VISIBLE_MEAL_SLOTS` and ensure `MEAL_SLOT_LABELS` has a matching entry. To add new diet form categories, extend `DIET_FORMS` in `lib/mock-data/institution.ts`. Shopping cost estimates use `CATEGORY_COST_PER_KG` in the hook — update when adding new food categories.

### 4.20 Allergen & Intolerance Management

- **Files:** `lib/allergen-constants.ts`, `lib/allergen-warnings.ts`, `lib/data/patient-allergens-client.ts`, `hooks/use-patient-allergens.ts`
- **DB:** `patient_allergens` table (migration `20260507000023`)
- **Constants:** `ALLERGEN_DEFINITIONS` — EU 14 mandatory allergens + histamine, fructose, sorbit intolerances. Each entry has `foodMatchTokens` for matching against free-text allergen strings on foods/recipes.
- **Patient UI:** In the Diagnosen tab (`components/patient-tabs.tsx`), a dedicated "Allergien & Intoleranzen" card lets counselors add/remove allergen entries with type (allergy/intolerance/preference) and severity (mild/moderate/severe). Entries display as color-coded badges.
- **Therapy tab:** `AllergenAutomationCard` (`components/therapy-panels.tsx`) shows a read-only view of the patient's allergen profile.
- **Meal plan warnings:** When a `patientId` query param is provided on `/ernaehrungsplan`, adding a food or recipe with matching allergens triggers a non-blocking toast warning. Conflicting entries show a warning icon.
- **Food/Recipe detail:** `FoodDetailContent` and `RecipeDetailContent` accept optional `patientAllergens` prop. When conflicts are detected, a destructive Alert is shown above allergen badges.
- **Recipe form:** `RECIPE_ALLERGENS` sourced from `ALLERGEN_DEFINITIONS` (EU 14 only).
- **Warning engine:** `checkAllergenConflicts()` in `lib/allergen-warnings.ts` — pure function matching item allergen strings against patient allergen entries via `foodMatchTokens`.

### 4.21 Krankenhaus – Inpatient Meal Workflow (`/institution/krankenhaus`)
- **Route:** `app/(app)/institution/krankenhaus/page.tsx` (server) → `krankenhaus-client.tsx` (client).
- **Persistence:** `inpatient_stays` and `meal_orders` (migration `20260509000025_hospital_meal_workflow.sql`).
- **Hooks / client data:** `hooks/use-inpatient-stays.ts`, `hooks/use-meal-orders.ts`, `lib/data/inpatient-stays-client.ts`, `lib/data/meal-orders-client.ts`.
- **Selection engine:** `lib/hospital-workflow.ts`.
  - Resolves service candidates for a selected date and meal slot.
  - Blocks options that violate assigned diet forms or patient allergen entries.
- **Workflow UI:**
  - Assign a real patient to station / room / bed with one or more diet forms.
  - Open a staff-side selection dialog for breakfast, lunch, or dinner.
  - Persist exactly one order per inpatient stay and service window.
  - Update order state from `pending` to `confirmed` to `delivered`.
- **Empty state behavior:** Without an active menu or active stays, the route shows explicit empty states and disables meal selection instead of synthesizing demo service options.
- **Kitchen output:** The `Küche` tab aggregates saved service orders by recipe, patient list, and special instructions instead of relying on planned menu portions alone.
- **Tray cards:** `/institution/krankenhaus/tablettenkarten` renders a print view from saved `meal_orders` using `date`, `mealSlot`, and `station` query params.

### 4.21a Einrichtung – Nährstoff-Compliance (`/institution/compliance`)
- **Route:** `app/(app)/institution/compliance/page.tsx` (server) → `compliance-client.tsx` (client).
- **Data sources:** `fetchMenuPlans()`, `fetchRecipes()`, `fetchFoodsForInstitution()`, `fetchInpatientStays()`, `fetchMealOrders()`, `fetchPatientAllergens()`.
- **Shared analytics engine:** `lib/institution-analytics.ts`.
  - Resolves the active institution menu cycle.
  - Calculates per-day nutrient totals per diet form from real menu slots, recipe ingredients, and food nutrients.
  - Compares actual intake against `DIET_FORMS[].nutrientTargets` and produces `DayCompliance` rows plus daily and cycle averages.
- **UI behavior:** The page filters by diet form, shows trend bars over the active cycle, and renders nutrient-level result tables for each cycle date. When no active calculable menu exists, it shows an explicit empty state.

### 4.21b Einrichtung – Statistiken (`/institution/statistiken`)
- **Route:** `app/(app)/institution/statistiken/page.tsx` (server) → `statistiken-client.tsx` (client).
- **Data sources:** Same shared institutional analytics payload as `/institution/compliance`.
- **KPIs:** Occupancy, average daily and per-portion cost, active diet forms, and compliance rate now come from real inpatient stays, meal orders, and menu-derived cost/compliance calculations.
- **Tabs:**
  - `Kostformen` shows real diet-form distribution from active inpatient stays.
  - `Menüwahl` shows most-ordered recipes plus real order-fulfillment status analytics instead of mock recipe ratings.
  - `Kosten` charts cycle-wide daily cost and per-portion cost from menu-derived shopping math.
  - `Übersicht` summarizes restriction-heavy cases, allergen profiles, pending orders, and cycle status from the same shared dataset.
- **Fallback behavior:** The pages no longer own local mock analytics datasets or server-side canned institution records. They render from shared derived data and show an empty state when no active cycle is available.

### 4.22 Patient Workflow Hub (`/patienten/[id]`)
- **Primary surface:** `components/patient-tabs.tsx` now opens on a dedicated `Workflow` tab before `Stammdaten`.
- **Purpose:** Present the investor/demo-ready ambulatory patient journey in one place without introducing a new backend workflow entity.
- **Core component:** `components/patient-workflow-tab.tsx`.
- **Derived stages:** `Intake`, `Assessment`, `Plan`, `Report`, `Follow-up`.
  - Stages are derived from existing persisted records, not stored separately.
  - Inputs come from digital protocol links/submissions, internal protocols, counseling sessions, patient screenings/anthropometrics, and patient-linked appointments.
- **Behavior:**
  - Shows a top summary with next recommended action, latest activity, and readiness count.
  - Renders per-stage status cards with guided CTAs into existing routes like protocol creation, counseling, reports, and appointments.
  - Aggregates a compact patient timeline from digital submissions, protocols, counseling milestones, and follow-up appointments.
- **Report history:** The workflow now lists patient-bound report records from `patient_reports`. The `Report` stage becomes `done` once a report record exists and deep-links back into `/berichte?reportId=...`.
- **Route handoff:** `/termine` now accepts an optional `patientId` query param to prefilter the calendar for a patient-specific follow-up flow.
- **Implementation note:** Patient report records are metadata-only in v1. Reports are rebuilt from current source data on reopen; PDF/CSV binaries are not retained.

## 5. Supporting Modules
- **Food Search Command (`components/food-search-command.tsx`):** Global command palette. Lazy-loads the search index from `/api/foods/search-index` only on first use.
- **Nutrient utilities (`@/lib/nutrients.ts`):** Mathematically validated core logic. Handles ingredient scaling and summing.
- **Fuzzy Search (`@/lib/search/fuzzy-search.ts`):** Optimized client-side search over the food index using Trigram similarity and Cologne phonetics.
- **Exports (`lib/exports/*`):**
  - `constants.ts` defines allowed format/scope combinations.
  - `pdf.tsx` contains branded PDF rendering for reports and patient documents.
  - `report-builder.ts` creates a default report payload for generic exports.
  - `server.ts` centralizes file responses and export job creation.

## 6. Scripts & ETL
- **BLS Import (`scripts/etl/import-bls.ts`):** Syncs the 7,140 food items from the Excel source to Supabase.
- **OFF Integration (`scripts/etl/import-off.ts`):** Implements the "Quarantine Pipeline" for branded products from Open Food Facts. Supports local-file, remote-URL, or live-sample inputs, stages raw rows in `off_staging`, validates them, computes a `data_quality_score`, and promotes valid rows to `foods` + `food_nutrients`.
- **Scientific Validation (`scripts/validate-nutrient-math.ts`):** Running `npm run validate:nutrients` performs 113+ mathematical assertions to ensure calculation parity with official standards.

## 7. Verification Checklist

Use the relevant subset for the area you changed instead of treating this as a mandatory full regression list.

- Search: open global search with `Cmd+K`; first open should load the index, later opens should be instant.
- Foods browser: on `/lebensmittel`, verify page navigation, source/category filters, and typo-tolerant search still work.
- Smart-Eingabe: enter a phrase like `1 Glas Milch` and verify amount, unit, and match resolution.
- Offline resilience: create or edit a recipe while offline and verify local persistence still works.
- Nutrient math: run `npm run validate:nutrients` before shipping changes to `lib/nutrients.ts` or closely related calculation paths.
- Backend sync: if you touched migration or fallback logic, confirm local entities still sync to Supabase after login.
- Patient workspace: if you touched patient detail flows, create and reload the affected records to confirm persistence.
- Hospital workflow: assign a patient to a bed, save a safe meal order, verify a blocked allergen conflict, and confirm tray-card rendering.
- Digital protocol conversion: if you touched submission or conversion code, verify draft creation and converted-state tracking.
- Report export: if you touched `/berichte` or export rendering, verify PDF, CSV, and preview behavior.
- Export history: if you touched export jobs, verify `/api-export` reflects persisted `export_jobs` rows.
- Mail merge: if you touched `/patienten` exports, verify the generated download is a PDF.
- OFF catalog: if you touched OFF ingestion or food browsing, verify promoted entries appear with attribution and quality metadata.

Use this guide to trace route -> component -> hook -> data flow. Verify current code when the guide and implementation diverge.
