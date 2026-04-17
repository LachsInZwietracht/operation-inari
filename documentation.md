# Operation Prodi – Feature Implementation Guide

## 1. How to Use This Document
- **Audience:** New engineers onboarding or touching unfamiliar areas. Assume TypeScript/React/Next.js knowledge.
- **Scope:** Every feature exposed through the sidebar or auth routes. Each section calls out routes, components, hooks, data flows, and extension notes.
- **Architecture:** Enterprise-grade Next.js 15 solution with Server-Side Streaming and Edge Caching.
- **State conventions:** Supabase-first persistence with automatic `localStorage` migration and fallback.
- **Routing:** Production UI lives under `app/(app)`. Auth is under `app/(auth)`. `app/page.tsx` redirects to `/dashboard`.
- **Testing:** Playwright E2E tests, custom performance benchmarks, and a 113-assertion mathematical validation suite.

## 2. Global Architecture Overview
- **High-Performance Rendering:** Next.js 15 with **Server-Side Streaming**. Heavy data-driven components (Dashboard, Rezepte) use `<Suspense>` with shimmering skeletons to provide an instant-feel UI.
- **Edge Caching:** BLS food data is cached at the edge via `unstable_cache` (Vercel Data Cache). Database queries that used to take seconds now resolve in ~20ms.
- **Layout stack:** `app/layout.tsx` applies fonts, theme provider, toasts. `app/(app)/layout.tsx` wires the `SidebarProvider`, `AppSidebar`, and global search. It is **non-blocking** (search index is lazy-loaded on demand).
- **Command palette:** `components/food-search-command.tsx` provides global `cmd+k` food search. The 1.5MB search index is **lazy-loaded** via `/api/foods/search-index` only when the search is first opened.
- **Mock data + utilities:**
  - `@/lib/nutrients.ts`, `@/lib/reference-values.ts`, `@/lib/prodi-score.ts`, `@/lib/sustainability.ts` implement calculation logic shared across features.
- **Stateful hooks:** CRUD hooks in `hooks/` (e.g., `usePatients`, `useCustomFoods`, `useRecipes`) follow a **Supabase-first with local fallback** pattern. Data is synced to the cloud when authenticated but always available in `localStorage` for offline use.

## 3. Data & State Layers
- **Supabase-First Persistence:** 
  - **Patients, Recipes, Meal Plans, Protocols, Invoices:** All have full backend persistence.
  - **Auto-Migration:** Hooks automatically detect "dirty" local data on login and migrate it to the Supabase cloud.
  - **Robustness:** All database calls use `withTimeout` and `try-catch` to ensure the UI stays responsive even if the backend is slow.
- **Foods & Search:**
  - **Search-on-Demand:** Instead of pre-fetching 7,000 foods, the app uses a lightweight search index. Full food details are fetched only when an item is selected.
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
  - Hooks: `useFoodSearch`, `useCustomFoods`, `useFoodSynonyms`.
  - UI: Search mode buttons, filters (source, categories), results table.
  - Data: `FOODS`, `FOOD_CATEGORIES`, `FOOD_SOURCES`, `FOOD_GROUPS`.
- **Group navigation:** `FoodGroupTree` uses `FOOD_GROUPS`; ensure new groups update `getFoodGroupDescendants`.

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
- **Digital Protocols:**
  - **Smart-Eingabe (NLP Lite):** The `ProtocolForm` includes an AI-assisted input that allows entering food like "1 Glas Apfelsaft" or "2 Scheiben Brot".
  - **NLP Engine:** `lib/nlp-matching.ts` parses free-text for quantity, unit, and food name using keyword heuristics.
  - **Persistence:** Protocols use `useProtocols` for Supabase-first persistence with automatic local fallback.

## 5. Supporting Modules
- **Food Search Command (`components/food-search-command.tsx`):** Global command palette. Lazy-loads the search index from `/api/foods/search-index` only on first use.
- **Nutrient utilities (`@/lib/nutrients.ts`):** Mathematically validated core logic. Handles ingredient scaling and summing.
- **Fuzzy Search (`@/lib/search/fuzzy-search.ts`):** Optimized client-side search over the food index using Trigram similarity and Cologne phonetics.

## 6. Scripts & ETL
- **BLS Import (`scripts/etl/import-bls.ts`):** Syncs the 7,140 food items from the Excel source to Supabase.
- **OFF Integration (`scripts/etl/import-off.ts`):** Implements the "Quarantine Pipeline" for branded products from Open Food Facts. Stages, validates, and promotes foods.
- **Scientific Validation (`scripts/validate-nutrient-math.ts`):** Running `npm run validate:nutrients` performs 113+ mathematical assertions to ensure calculation parity with official standards.

## 7. Testing & Verification Checklist
For each feature update:
1. **Performance:** Hard-refresh a page. The layout should appear in < 300ms. Heavy data should shimmer-load.
2. **Search:** Open global search (Cmd+K). Initial load should show a spinner once, then be instant.
3. **Smart-Eingabe:** Enter "1 Glas Milch" in a protocol. It should resolve the ID, amount, and unit correctly.
4. **Offline Resilience:** Disconnect internet, create a recipe. It should save to local storage and show a success message.
5. **Data Integrity:** Run `npm run validate:nutrients`. All tests must pass before any change to `lib/nutrients.ts`.
6. **Backend Sync:** Log in with a new account. Confirm that local recipes, patients, and invoices are automatically pushed to Supabase.

Following this guide ensures new engineers can trace each feature from route → component → hook → data, understand persistence, and avoid breaking coupled flows.
