# Operation Prodi – Feature Implementation Guide

## 1. How to Use This Document
- **Audience:** New engineers onboarding or touching unfamiliar areas. Assume TypeScript/React/Next.js knowledge.
- **Scope:** Every feature exposed through the sidebar or auth routes. Each section calls out routes, components, hooks, data flows, and extension notes.
- **Architecture:** Enterprise-grade Next.js 15 solution with Server-Side Streaming and Edge Caching.
- **State conventions:** Supabase-first persistence with automatic `localStorage` migration and fallback.
- **Routing:** Production UI lives under `app/(app)`. Auth is under `app/(auth)`. `app/page.tsx` redirects to `/dashboard`.
- **Temporary local auth bypass:** `middleware.ts` currently sets `DISABLE_AUTH_FOR_TESTING = true`, so route protection is intentionally disabled during local testing. Re-enable this before staging/production by changing that flag back to `false`.
- **Testing:** Playwright E2E tests, custom performance benchmarks, and a 113-assertion mathematical validation suite.

## 2. Global Architecture Overview
- **High-Performance Rendering:** Next.js 15 with **Server-Side Streaming**. Heavy data-driven components (Dashboard, Rezepte) use `<Suspense>` with shimmering skeletons to provide an instant-feel UI.
- **Edge Caching:** BLS food data is cached at the edge via `unstable_cache` (Vercel Data Cache). Database queries that used to take seconds now resolve in ~20ms.
- **Layout stack:** `app/layout.tsx` applies fonts, theme provider, toasts. `app/(app)/layout.tsx` wires the `SidebarProvider`, `AppSidebar`, and global search. It is **non-blocking** (search index is lazy-loaded on demand).
- **Command palette:** `components/food-search-command.tsx` provides global `cmd+k` food search. The 1.5MB search index is **lazy-loaded** via `/api/foods/search-index` only when the search is first opened.
- **Mock data + utilities:**
  - `@/lib/nutrients.ts`, `@/lib/reference-values.ts`, `@/lib/prodi-score.ts`, `@/lib/sustainability.ts` implement calculation logic shared across features.
- **Stateful hooks:** CRUD hooks in `hooks/` (e.g., `usePatients`, `useCustomFoods`, `useRecipes`) follow a **Supabase-first with local fallback** pattern where implemented. Data is synced to the cloud when authenticated but remains available in `localStorage` for offline use.
- **Export pipeline:** Real file generation lives behind server routes in `app/api/exports/*`. Client pages build typed payloads, the server renders PDF/CSV output, and export metadata is written to `export_jobs`.

## 3. Data & State Layers
- **Supabase-First Persistence:** 
  - **Patients, Recipes, Meal Plans, Protocols, Invoices, Appointments:** All have full backend persistence.
  - **Patient clinical workspace:** Anthropometrics, diagnoses, medications, screenings, lab values, activities, therapy settings/integrations, PROCAM, and digital protocol links are all persisted in Supabase with automatic local fallback and login-time migration.
  - **Digital protocol submissions:** Public patient diary submissions are persisted in `digital_protocol_submissions` and can be marked `new`, `reviewed`, or `converted` with an attached `converted_protocol_id`.
  - **Still local-only in the patient workspace:** Demo analytics panels and assistant cards remain client-side only unless otherwise noted.
  - **Auto-Migration:** Hooks automatically detect "dirty" local data on login and migrate it to the Supabase cloud.
  - **Robustness:** All database calls use `withTimeout` and `try-catch` to ensure the UI stays responsive even if the backend is slow.
- **Foods & Search:**
  - **Search-on-Demand:** Instead of pre-fetching 7,000 foods, the app uses a lightweight search index. Full food details are fetched only when an item is selected.
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
- **Custom foods:** Local custom foods are still merged into page 1 so offline/unauthenticated entries remain visible without reintroducing full-catalog hydration.
- **OFF details:** Foods with `sourceId === "off"` show attribution ("Produktdaten von Open Food Facts") and `dataQualityScore` in the detail page.

### 4.6 Rezepte Overview (`/rezepte`)
- **Component:** `app/(app)/rezepte/page.tsx`
  - Uses `<Suspense>` for the recipe list.
  - **Cached Rendering:** Recipe cards display kcal/macros instantly using cached values from the `recipes` table, avoiding heavy ingredient loading for the entire list.

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
  - **Real exports:** `PDF erstellen` and `CSV/Nährstoffdaten` POST to `/api/exports/report`.
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
  - **Supported v1 scopes:** CSV for Lebensmittel/Rezepte/Patienten/Ernährungspläne/Berichte, JSON for Lebensmittel/Rezepte/Patienten/Ernährungspläne, PDF for Patienten/Berichte.
  - **History:** the `Verlauf` tab loads real persisted rows from `/api/export-jobs`; the former mock `EXPORT_HISTORY` list is no longer the source of truth for exports.

### 4.17 Praxis-Statistiken (`/praxis-statistiken`)
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

## 7. Testing & Verification Checklist
For each feature update:
1. **Performance:** Hard-refresh a page. The layout should appear in < 300ms. Heavy data should shimmer-load.
2. **Search:** Open global search (Cmd+K). Initial load should show a spinner once, then be instant.
3. **Foods browser:** On `/lebensmittel`, verify page 1 renders immediately, page navigation works, source/category filters round-trip through `/api/foods/browser`, and fuzzy name search still finds typo variants.
4. **Smart-Eingabe:** Enter "1 Glas Milch" in a protocol. It should resolve the ID, amount, and unit correctly.
5. **Offline Resilience:** Disconnect internet, create a recipe. It should save to local storage and show a success message.
6. **Data Integrity:** Run `npm run validate:nutrients`. All tests must pass before any change to `lib/nutrients.ts`.
7. **Backend Sync:** Log in with a new account. Confirm that local recipes, patients, and invoices are automatically pushed to Supabase.
8. **Patient Clinical Record:** On `/patienten/[id]`, add an anthropometric entry, diagnosis, medication, screening, lab value, activity, therapy module, integration sync event, PROCAM result, and digital protocol link; reload and confirm each persists.
9. **Digital Protocol Conversion:** Create or open a received digital submission, convert it into a draft from the patient `Protokolle` tab, save the resulting protocol, and confirm the submission can be marked/seen as converted with a linked internal protocol.
10. **Report Export:** On `/berichte`, verify PDF and CSV downloads complete and the preview opens a generated PDF instead of a placeholder.
11. **Export History:** On `/api-export`, trigger a real export and confirm the `Verlauf` tab reflects a persisted `export_jobs` row.
12. **Patient Mail Merge:** On `/patienten`, generate a document batch and verify the download is a PDF, not a text file.
13. **OFF catalog:** Run `npm run etl:off`, confirm validated OFF products appear under `/lebensmittel` source filter `Open Food Facts`, and verify detail pages show attribution plus quality score.

Following this guide ensures new engineers can trace each feature from route → component → hook → data, understand persistence, and avoid breaking coupled flows.
