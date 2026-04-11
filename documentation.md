# Operation Prodi – Feature Implementation Guide

## 1. How to Use This Document
- **Audience:** New engineers onboarding or touching unfamiliar areas. Assume TypeScript/React/Next.js knowledge.
- **Scope:** Every feature exposed through the sidebar or auth routes. Each section calls out routes, components, hooks, data flows, and extension notes.
- **Data model:** Until backend wiring exists, most features read from `@/lib/mock-data` and persist to `localStorage` via hooks in `hooks/`.
- **State conventions:** Each hook documents its storage key. Never reset or delete user data without migrations.
- **Routing:** Production UI lives under `app/(app)`. Auth is under `app/(auth)`. `app/page.tsx` redirects to `/dashboard`.
- **UI primitives:** Components under `components/ui/` wrap Radix primitives; `PageHeader`, `Card`, `Badge`, etc. keep the layout consistent. Prefer reusing them.
- **Testing:** There are no automated tests per feature; rely on manual flows described under each section. When adding logic, consider Playwright coverage.

## 2. Global Architecture Overview
- **Layout stack:** `app/layout.tsx` applies fonts, theme provider, toasts. `app/(app)/layout.tsx` wires the `SidebarProvider`, `AppSidebar`, header search trigger, and `PwaStatus`.
- **Navigation:** `AppSidebar` defines sections and routes. Maintain the structure so documentation “features” map 1:1 to sidebar entries.
- **Command palette:** `components/food-search-command.tsx` provides global `cmd+k` food search with fuzzy + synonym results.
- **Mock data + utilities:**
  - `@/lib/mock-data` (and nested files) emulate BLS foods, recipes, patients, billing, etc.
  - `@/lib/nutrients.ts`, `@/lib/reference-values.ts`, `@/lib/prodi-score.ts`, `@/lib/sustainability.ts` implement calculation logic shared across features.
- **Stateful hooks:** Most CRUD-ish screens use hooks in `hooks/` (e.g., `usePatients`, `useMealPlan`). They load mock data + stored overrides and persist user mutations.
- **Auth integration:** `components/auth-form.tsx` talks to Supabase via `createClient`. Authentication state isn’t enforced yet, but forms and flows are ready.

## 3. Data & State Layers
- **Recipes and foods:** `FOODS`, `RECIPES`, `BRANDED_FOODS`, etc. combine with `useCustomFoods` to allow extending the dataset. Recipes can be converted into foods.
- **Reference values:** `useReferenceProfiles` stores the active standard & life stage in `localStorage`. `resolveReferenceForPatient` converts those choices into per-nutrient baselines.
- **Patient-related hooks:**
  - `usePatients` stores additions/edits (`prodi_patients`).
  - `useEgkScanner` simulates card readers; `useEgkInbox` keeps scanned card events.
  - `useMailMergeHistory`, `useBirthdayReminders`, `useDiagnoses`, etc. provide specialized local persistence for sub-features in the patient tabs.
- **Practice hooks:** `usePracticeAppointments` and `usePracticeInvoices` manage scheduling/billing data (keys `prodi_practice_*`).
- **Meal plan data:** `useMealPlan` merges mock plans with stored entries under `prodi_meal_plans`.
- **Search & synonyms:** `useFoodSearch` handles multi-mode search states. `useFoodSynonyms` merges system + user synonyms and persists them (`prodi_food_synonyms_v1`).

## 4. Feature Reference
Each subsection includes route, core components, important hooks/utilities, and extension notes.

### 4.1 Dashboard (`/dashboard`)
- **Purpose:** High-level KPIs (food/recipe counts, today’s plan, macro chart, quick actions).
- **Implementation:**
  - `app/(app)/dashboard/page.tsx` renders `metrics`, macro chart, and today’s meal plan summary.
  - Uses `FOODS`, `RECIPES`, `MEAL_PLANS`, `MEAL_SLOT_LABELS`, nutrient utilities, and `MacroRingChart`.
- **Extensions/Pitfalls:**
  - When adding new metrics, keep `metrics` array declarative. Ensure calculations use the same nutrient helpers as other features for consistency.
  - Quick-action routes should exist; update sidebar + documentation if you add more.

### 4.2 Lebensmittel (Foods) (`/lebensmittel`)
- **Listing + search:** `app/(app)/lebensmittel/page.tsx`
  - Hooks: `useFoodSearch`, `useCustomFoods`, `useFoodSynonyms`.
  - UI: Search mode buttons, filters (source, categories), results table, brand tab (BRANDED_FOODS cards).
  - Data: `FOODS`, `FOOD_CATEGORIES`, `FOOD_SOURCES`, `FOOD_GROUPS`, `calculateProdScore`, `getProdScoreBadge`.
- **Group navigation:** `FoodGroupTree` uses `FOOD_GROUPS`; ensure new groups update `getFoodGroupDescendants` for search.
- **Synonyms:** `FoodSynonymManager` dialog allows alias CRUD. Uses `preferredSynonymMap` to highlight active names.
- **Brand cards:** rely on `BRANDED_FOODS`, show allergens/additives and CO₂ data.
- **Edge cases:** Searching by code expects BLS-style IDs; keep `food.blsCode` populated when introducing new items.

### 4.3 Lebensmittel Detail (`/lebensmittel/[id]`)
- **Routing:** `app/(app)/lebensmittel/[id]/page.tsx` decides between static food, user food (`FoodDetailClient`), or 404.
- **Main component:** `components/food-detail-content.tsx`
  - Summaries (category, source, product info, sustainability), macros, macro ring, nutrient tabs.
  - Reference integration: `ReferenceProfileSelector` and `useReferenceProfiles` -> `resolveReferenceForPatient`.
  - Sustainability: `estimateFoodCo2` fallback when `co2PerPortion` missing.
- **Custom foods:** `FoodDetailClient` reads from `localStorage`. Missing entries call `notFound()`.
- **Extension tips:** Keep nutrient groups aligned with `NUTRIENT_GROUP_LABELS`. Adding new nutrient definitions requires updates to `NUTRIENT_DEFINITIONS` and corresponding UI.

### 4.4 Neues Lebensmittel (`/lebensmittel/neu`)
- **Component:** `app/(app)/lebensmittel/neu/page.tsx` with `react-hook-form` + `zod` validation.
- **Hook usage:** `useCustomFoods().addFood` persists entries.
- **Form fields:** Category, source (populated from `FOOD_CATEGORIES`, `FOOD_SOURCES`), nutrients (basic macros), portion sizes, allergens/additives.
- **Extension notes:**
  - `additives` uses comma-separated input; consider tag UI if more structure needed.
  - Currently only basic nutrients; to add micronutrients, adjust schema + local storage serialization.

### 4.5 Lebensmittel Vergleich (`/lebensmittel/vergleichen`)
- **Component:** `app/(app)/lebensmittel/vergleichen/page.tsx`
  - Select two foods, adjust portion sliders, show nutrient comparison table.
- **Data:** `FOODS`, `BRANDED_FOODS`, `useCustomFoods` combined in `foods` array.
- **Scaling:** Uses `scaleNutrients` for portion adjustments.
- **Extensions:** Add more nutrients by editing `NUTRIENTS_TO_COMPARE`. Keep UI responsive by limiting columns.

### 4.6 Rezepte Overview (`/rezepte`)
- **Component:** `app/(app)/rezepte/page.tsx`
  - Search/filter by category and source (personal vs community).
  - Add/import/export actions; dialogs handle JSON/CSV import/export.
  - Local storage key: `prodi_custom_recipes` (via helper functions at top of file).
- **Mock vs custom:** `RECIPES` flagged with `sourceType`. Custom ones stored with `sourceType: "personal"`.
- **Import/export:** `handleImportSubmit`, `handleExport` operate on `filtered` array. CSV uses fixed headers.
- **Extensions:** Validate imported recipes more rigorously; add ingredient parsing later.

### 4.7 Recipe Detail (`/rezepte/[id]`)
- **Routing:** `app/(app)/rezepte/[id]/page.tsx` uses mock recipe when available, otherwise hydration client.
- **Component:** `components/recipe-detail-content.tsx`
  - Displays hero image, metadata, ingredients table, instructions, macro panel, sustainability, reference comparisons, macro ring, vitamin/mineral highlights.
  - Hooks: `useCustomFoods` (convert recipe to food), `useFoodSynonyms` (alias display names).
  - Calculations: `calculateRecipeNutrients`, `calculatePerServing`, `MacroRingChart`.
- **Extension notes:**
  - `handleConvert` uses `convertRecipeToFood` to store per-serving nutrients as a new food; ensure `useCustomFoods` remains up to date when editing recipes.
  - Add new nutrient highlights by adjusting filters on `NUTRIENT_DEFINITIONS`.

### 4.8 Recipe Form (`/rezepte/neu`, `/rezepte/[id]/bearbeiten`)
- **Component:** `components/recipe-form.tsx`
  - Shared between create and edit pages. Uses `react-hook-form`, `useFieldArray` for ingredients/instructions.
  - Live nutrient preview via `useNutrientCalculation` (sum of selected foods scaled to servings).
  - Local persistence: `getCustomRecipes`/`saveCustomRecipes` functions.
  - Additional metadata: allergens, additives (comma-separated), PRODIscore, CO₂ per portion.
- **Editing limitations:** Standard recipes (from `RECIPES`) cannot be saved over; editing path warns users.
- **Extension tips:** When adding new fields ensure schema + `Recipe` type stay in sync. Keep `useNutrientCalculation` inputs valid (only include ingredients with `foodId`).

### 4.9 Meal Planning (`/ernaehrungsplan`)
- **Component:** `app/(app)/ernaehrungsplan/page.tsx`
  - Features: calendar navigation (day/week/cycle views), command palette to add entries (foods/recipes), nutrient bars, compliance indicators, exchange dialog, sustainability stats.
  - Hooks: `useMealPlan` for state (per-day plans, add/remove/update entries), `useReferenceProfiles` for reference comparisons.
  - Data: `FOODS`, `RECIPES`, `NUTRIENT_DEFINITIONS`, `DIET_LINES`, `FOOD_CATEGORIES`.
  - Calculations: `scaleNutrients`, `sumNutrients`, `calculateRecipeNutrients`, `getNutrientValue`, `MEAL_SLOT_LABELS`, `calculateProdScore`, `evaluatePlanSustainability`.
- **Persistence:** Local storage by date; merging ensures empty slots added automatically.
- **Extension notes:** Keep `MealSlotCard` drag IDs in sync if adding DnD interactions. Exchange dialog uses categories + nutrients; ensure new categories exist in data.

### 4.10 Reference Values (`/referenzwerte`)
- **Component:** `app/(app)/referenzwerte/page.tsx`
  - Tabs for comparing standards, managing custom profiles, etc.
  - Uses `REFERENCE_STANDARDS`, `AGE_GROUPS`, `NUTRIENT_DEFINITIONS`, `LIFE_STAGE_LABELS`.
  - Hook: `useReferenceProfiles` for storing active selection and custom profiles (CRUD via dialogs).
- **Resolver:** `resolveReferenceValues` + `resolveReferenceForPatient` compute actual numbers used by other screens.
- **Extension notes:** When adding standards, update `REFERENCE_STANDARDS` and ensure flag mapping contains new locales. Provide migrations when changing storage format.

### 4.11 Exchange Tables (`/austauschtabellen`)
- **Component:** `app/(app)/austauschtabellen/page.tsx`
  - Filters foods by nutrient and category, sorts ascending/descending.
  - Data: `FOODS`, `FOOD_CATEGORIES`, `NUTRIENT_DEFINITIONS`, `getNutrientValue`.
- **Extension tips:** Sorting uses `sortDir` state; ensure units displayed align with chosen nutrient. Consider virtualization if dataset grows.

### 4.12 Patienten Overview (`/patienten`)
- **Component:** `app/(app)/patienten/page.tsx`
  - Hooks: `usePatients` for list, `useEgkScanner`/`useEgkInbox`, `useMailMergeHistory`, `useBirthdayReminders` for integrated flows.
  - Features: search/filter, template-based mail merge preview, eGK intake simulation, birthday reminders, batch download.
- **Mock data:** `COUNSELING_SESSIONS`, `MAIL_MERGE_TEMPLATES`, etc.
- **Extension notes:**
  - Keep `renderTemplate` tokens synchronized with placeholders documented; when adding tokens update both UI and documentation.
  - eGK functions rely on browser APIs; guard server access.

### 4.13 Patient Detail (`/patienten/[id]` + nested tabs)
- **Routing:** `app/(app)/patienten/[id]/page.tsx` resolves patient and renders `PatientTabs`.
- **PatientTabs:** Multi-tab view covering anthropometrics, diagnoses, medications, lab values, therapy settings, activities, screenings, PROCAM, digital protocols, counseling logs, and more.
  - Each sub-feature stored via dedicated hooks: e.g., `useAnthropometric`, `useDiagnoses`, `useMedications`, `useLabValues`, `useTherapySettings`, `useTherapyIntegrations`, `useScreenings`, `useProcam`, `useDigitalProtocols`, `useActivities`.
  - Charts: `AnthropometricChart`, `PediatricPercentileChart` rely on `GROWTH_PERCENTILES` and user data.
- **Extension notes:** Because tabs share many hooks, verify that storage keys do not conflict. When adding new therapy panels, update `components/therapy-panels.tsx` and ensure patient types support them.

### 4.14 Reports (`/berichte`)
- **Component:** `app/(app)/berichte/page.tsx`
  - Features: Template selection (`useReportTemplates`), nutrient charts, macro distribution, LMIV tables, placeholder tokens, health claim checks, report generation dialogs.
  - Data: `MEAL_PLANS`, `FOODS`, `RECIPES`, `NUTRIENT_DEFINITIONS`.
  - Calculations: `scaleNutrients`, `sumNutrients`, `percentOfReference`, `resolveReferenceForPatient`.
- **Extension notes:** `REPORT_SECTIONS` drives toggles, maintain IDs when referencing in other modules. `LOCALSTORAGE_KEY` for saved plans must stay consistent.

### 4.15 Termine (Scheduling) (`/termine`)
- **Component:** `app/(app)/termine/page.tsx`
  - Hooks: `usePracticeAppointments` for CRUD; `usePatients` for name lookup.
  - Features: day/week/month switching, filters, recurring appointments, reminders, dialog for create/edit.
- **Extension notes:** Keep `PracticeAppointment` type aligned with form fields. `REMINDER_OPTIONS`, `RECURRING_OPTIONS` lists drive UI; update caution.

### 4.16 Abrechnung (Billing) (`/abrechnung`)
- **Component:** `app/(app)/abrechnung/page.tsx`
  - Hooks: `usePracticeInvoices`, `usePracticeAppointments`, `usePatients` (for patient lookup).
  - Features: Stats cards, revenue trend chart (Recharts), insurance breakdown, payment aging, invoice form.
- **Extension notes:** When adjusting invoice schema, update `InvoiceEntry` type and `STATUS_META`. Recharts expects data in consistent shape; maintain keys.

### 4.17 Praxis-Statistiken (`/praxis-statistiken`)
- **Component:** `app/(app)/praxis-statistiken/page.tsx`
  - Combines appointment + invoice metrics into charts and tables.
  - Calculations: custom `computeStats`, slot utilization, payment rate, type breakdown.
- **Extension notes:** Keep data alignment between practice hooks and KPIs. If new appointment types added, extend `TYPE_LABELS` and breakdown logic.

### 4.18 Wissen (`/wissen`)
- **Component:** `app/(app)/wissen/page.tsx`
  - Features: knowledge cards search/filter, PRODIscore monitor for sample recipe + plan, sustainability metrics, top foods highlights.
  - Data: `KNOWLEDGE_CARDS`, `SUSTAINABILITY_METRICS`, `FOODS`, `FOOD_CATEGORIES`, `MEAL_PLANS`, `RECIPES`.
  - Calculations: `calculateRecipeNutrients`, `calculatePerServing`, `calculateProdScore`, `evaluatePlanSustainability`.
- **Extension notes:** When adding categories, update `knowledgeCategories` derivation. Keep `categoryMap` in sync with `FOOD_CATEGORIES`.

### 4.19 API & Export (`/api-export`)
- **Component:** `app/(app)/api-export/page.tsx`
  - Tabs: Export/import scopes, REST endpoints, integrations, webhooks, job history.
  - Data: `API_ENDPOINTS`, `API_KEYS`, `WEBHOOK_CONFIGS`, `INTEGRATION_TOGGLES`, `EXPORT_HISTORY`.
  - State: `exportScopes`, `importFormat`, `integrationStates`, `webhookStates`, `revealedKeys`.
- **Extension notes:** Keep method/style maps up to date when adding HTTP verbs. When hooking to real backend, replace toast mocks with API calls.

### 4.20 Leistung (Performance) (`/leistung`)
- **Component:** `app/(app)/leistung/page.tsx`
  - Features: KPIs (latency, errors), response time chart, load test simulator, database stats, system resources, regression logs.
  - Data: `PERFORMANCE_KPIS`, `LOAD_TEST_RESULTS`, `DATABASE_QUERY_STATS`, `SYSTEM_RESOURCES`, `RESPONSE_TIME_HISTORY`.
  - Stress test simulation uses interval increments; ensures cleanup on unmount.
- **Extension notes:** When integrating with real telemetry, swap static arrays with API fetches; maintain UI contract for color coding.

### 4.21 Tarife (`/admin/tarife`)
- **Component:** `app/(app)/admin/tarife/page.tsx`
  - Features: Current billing summary, toggle monthly/annual cycles, tier cards (`PRODUCT_TIERS`), usage metrics, add-on activations, invoice history.
  - State: `billingCycle`, `selectedTier`.
- **Extension notes:** Tier selection triggers toasts; hooking to backend would replace `handleTierSelect`. Keep `BILLING_STATUS_BADGE` colors matched to statuses.

### 4.22 Admin & Users (`/admin/users`)
- **Component:** `app/(app)/admin/users/page.tsx`
  - Features: Team overview, role changes, status toggling, MFA reset actions, invitation form, security controls, audit log filter, backup/compliance panels.
  - Data: `ADMIN_USERS`, `ROLE_MATRIX`, `AUDIT_LOG`, `BACKUP_STATUS`, `SECURITY_CONTROLS`, `ENCRYPTION_LAYERS`, `COMPLIANCE_CHECKLIST`, `SESSION_METRICS`, `RECOVERY_OBJECTIVES`.
  - State: `users`, `controlStates`, `inviteForm`, `auditFilter`.
- **Extension notes:** When adding new controls/logs, update derived structures (stats, color maps). Keep invites validated before sending requests.

### 4.23 Institution Modules (`/institution/*`)
- **Menus (`/institution/menueplaene`), Production (`/institution/produktion`), Compliance, Krankenhaus, Statistiken** share institutional data.
- **Shared hook: `hooks/use-institution-menu.ts`**
  - Central state management for all institutional menu operations. Persists to localStorage (`institution-menus`).
  - Exposes: `menus`, `activeMenu`, `assignRecipe()`, `removeRecipe()`, `updatePortionCount()`, `generateProductionList()`, `generateShoppingList()`.
  - `generateProductionList(menuId, week, day)` computes scaled ingredient lists per recipe/diet-form/slot from the active menu plan.
  - `generateShoppingList(menuId, week)` aggregates ingredients across all days, groups by food category, and estimates costs.
- **Menu plan page (`/institution/menueplaene`):**
  - Three tabs: Wochenplan, Produktion, Einkauf.
  - **Wochenplan:** Diet-form-tabbed weekly grid with droppable cells. Recipes are dragged from a sidebar Sheet (`Rezeptbibliothek`) using HTML5 DataTransfer. On drop, a PortionDialog prompts for portion count before assigning.
  - **Produktion:** Day selector → dynamically generated production list from menu plan data. Expandable rows show per-recipe ingredient breakdowns.
  - **Einkauf:** Aggregated weekly shopping list with category grouping, portion scaling, cost estimates, and CSV export.
  - Drag type constant: `application/prodi-institution-recipe-id`.
- **Production page (`/institution/produktion`):**
  - Uses `useInstitutionMenu` hook to dynamically generate production and shopping data from the active menu plan (no longer static mock data).
  - State: `selectedWeek`, `selectedDay`, `expandedRows`, `portionScale`.
  - Utilities: `MEAL_SLOT_LABELS`, helper conversions (g ↔ kg, ml ↔ l), currency formatter.
- **Extension notes:** Keep `MEAL_SLOT_ORDER` consistent. The production/shopping flows are now fully derived from menu plan state — any change to the weekly planner automatically updates lists. If adding more tabs, document them alongside relevant data sets.

### 4.24 Datenbank Updates (`/datenbank`)
- **Component:** `app/(app)/datenbank/page.tsx`
  - Shows release history with `FOOD_DATABASE_UPDATES` + `FOOD_SOURCES` metadata.
  - Filter by source, highlight counts.
- **Extension notes:** When integrating real release data, maintain `Card` layout structure and summary counts.

### 4.25 Wissen (Knowledge) – already covered above.

## 5. Supporting Modules
- **Food Search Command (`components/food-search-command.tsx`):** Global command palette tied to `useFoodSynonyms` for alias display. When changing search heuristics, update `fuzzySearchFoods` in `@/lib/search`.
- **Synonym management (`components/food-synonym-manager.tsx` + `hooks/use-food-synonyms.ts`):** Keep storage keys versioned (`_v1`). Provide migrations when schema changes.
- **Nutrient utilities (`@/lib/nutrients.ts` & `hooks/use-nutrient-calculation.ts`):** Only operate on arrays of `{ nutrientId, amount }`. Reuse for any new nutrient-based features to avoid drift.
- **Reference resolution (`@/lib/reference-values.ts` & `hooks/use-reference-profiles.ts`):** Central source for age/standard mapping. Use `resolveReferenceForPatient` whenever comparing values to RDI.
- **PRODIscore (`@/lib/prodi-score.ts`):** Computes quality/badge for foods/recipes/plans. When changing scoring weights, update both data and UI badges.
- **Sustainability (`@/lib/sustainability.ts`):** Provides plan + food CO₂ estimation. Keep in sync with product requirements.
- **PWA status (`components/pwa-status.tsx`):** Shows online/offline badge; listens to browser events.

## 6. Auth & Access
- **Routes:**
  - `/login` (`app/(auth)/login/page.tsx`) and `/registrieren` share `AuthForm`.
  - `app/(auth)/layout.tsx` (not shown earlier) wraps cards; ensure styles match marketing.
- **AuthForm:** Handles register/login flows via Supabase. `mode` prop determines fields. After login, router pushes `/dashboard` and refreshes.
- **Extension notes:**
  - Replace toast-only error handling with real UI states when backend is ready.
  - Add route protection middleware once Supabase auth is enforced.

## 7. Testing & Verification Checklist
For each feature update:
1. **Dashboard:** Load `/dashboard`, verify metrics and macros update when mock data changes.
2. **Foods:** Search across all modes, create custom food, confirm detail view + synonyms, compare foods.
3. **Recipes:** Create, edit, import, export, convert to food; verify detail macros.
4. **Meal plan:** Add foods/recipes via command palette, adjust dates, check nutrient bars/reference compliance.
5. **Reference values:** Switch standards, genders, create custom profile, ensure other features pick up new standard.
6. **Patients:** Add/edit patient, exercise EGK scan/inbox, send mail merge sample, check birthday reminders.
7. **Patient tabs:** Update anthropometric data, labs, medications, therapy settings; confirm persistence across reloads.
8. **Reports:** Generate template, toggle sections, export previews.
9. **Scheduling/Billing/Stats:** Add appointments/invoices, ensure numbers ripple through `/termine`, `/abrechnung`, `/praxis-statistiken`.
10. **Admin/Institution/API/Leistung:** Toggle controls, simulate stress test, activate add-ons, change integration/webhook toggles.
11. **Auth:** Register/login via Supabase dev project, confirm redirects and stored metadata.

Following this guide ensures new engineers can trace each feature from route → component → hook → data, understand persistence, and avoid breaking coupled flows.
