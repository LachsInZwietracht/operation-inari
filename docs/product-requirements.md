# Operation Prodi - Product Requirements

## Overview

This document captures product intent, scope, and roadmap direction for Operation Prodi.

How to use it:
- Treat this file as roadmap and product context, not as the implementation source of truth.
- When this document conflicts with current code, migrations, or the feature guide, current implementation wins.
- Status labels are directional and may lag behind the latest branch changes.
- Use `docs/competitive-audit.md` for competitor landscape, clinic-first gaps, and market strategy.

Product direction:
- Build a modern nutrition counseling and therapy platform for clinics, practices, and pharmacies.
- Combine the scientific rigor expected from German nutrition tooling with a more usable SaaS workflow model.

---

## 1. Food & Nutrient Database

### 1.1 Food Composition Data
**Status:** Partially implemented. BLS 4.0 is imported to Supabase; SFK ETL pipeline is implemented (expanded nutrient definitions including aminosaeuren and fettsaeuren groups); broader multi-dataset coverage is still roadmap.
- Comprehensive food database with **14,000+ foods** from official sources
- Support for multiple food composition databases:
  - **BLS** (Bundeslebensmittelschluessel) — German standard
  - **Souci-Fachmann-Kraut (SFK)** — detailed reference work (**Scientific Gold Standard; critical for research parity**) — ETL pipeline implemented; data import requires paid license
  - **Austrian Food Data (ÖNWT)** — for the Austrian market
  - **Swiss Nutrient Database** — for the Swiss market
  - **USDA National Nutrient Database** — for international / English-speaking clients
  - **Australian Food Composition Database (AFCD)** — for Australian market and English-language support
- Up to **330+ nutrients** per food item, including:
  - Macronutrients (protein, fat, carbohydrates, fiber, water, alcohol)
  - 25 amino acids, 60+ fatty acid profiles, 35+ vitamins, 25+ minerals
- **Hohenheim Validation:** Calculation logic must be rigorously verified against University of Hohenheim research standards to displace EBISpro.
- **Multilingual food names** — Implement as a `food_translations` table linked to each food item; UI language selector determines which name is shown.

### 1.2 Manufacturer Product Database (The "Data Moat")
**Status:** Partially implemented (Open Food Facts validation/promotion pipeline is live; direct clinical manufacturer feeds and broader catalog depth remain open).
- **29,000+ branded products** from major food manufacturers.
- **Live API Integration (Market Leader Feature):** Move beyond PRODI's static updates by integrating with **Open Food Facts (OFF)** and direct clinical manufacturer feeds (Fresenius Kabi, Nutricia, Abbott).
- Ability to add and manage custom food entries with nutrient values, portions, and allergens.

### 1.3 Reference Values
**Status:** Implemented (Supabase-backed official standards, persisted custom profiles, patient-level assignment). **Gap (user-priority):** selectable PAL levels are not yet wired into reference/energy calculations.
- DGE (German), OeGE (Austrian), SGE (Swiss), and RDA values.
- Reference values adjustable by age, gender, pregnancy, lactation.
- **PAL (physical activity level) selection** — energy/reference targets must support multiple selectable PAL values per patient. Required by `docs/user-priority-feedback.md` (DGE/ÖGE built-in but individually adjustable, including PAL). Not yet implemented.

### 1.4 Advanced Food Search
**Status:** Implemented (Kölner Phonetik, trigram search, synonym management, and paginated server-backed `/lebensmittel` browsing).
- **Phonetic / fuzzy search (Kölner Phonetik)** — tolerate typos and umlaut variations. Implement using phonetic indexing (e.g., pg_trgm trigram index in PostgreSQL) to generate codes at food-insert time. This is a primary competitive advantage over international SaaS.
- **Multiple search modes** — food name, database code (BLS code), food group hierarchy, and full browse.
- **Nutrient sort & threshold filter (Gap, user-priority)** — sort the food list by any single nutrient (e.g. by protein) and filter by a nutrient threshold (e.g. foods with `> 10 g protein / 100 g`). Highlighted as a "very important" PRODI feature in `docs/user-priority-feedback.md`. Not yet implemented.
- **Food synonym management** — `food_synonyms` table linking user-defined names to food IDs; synonyms replace original names in search and printouts.

### 1.5 Database Management
**Status:** Partially implemented (live source catalog, per-organization activate/deactivate, nutrient-source diff UI).
- **Connected databases** — `/datenbank` shows the live `data_sources` catalog; owners/admins can activate or deactivate each source for their organization, which gates it in food search.
- **Nutrient/source diff** — side-by-side nutrient comparison between any two foods (incl. cross-source).
- **Deferred / removed:** the audited food-reference replacement workflow and the ETL-written database-lifecycle history were removed during the feature strip-down (see `20260610000057_drop_lifecycle_and_replacement.sql`); global search & replace, institution-wide replacement approvals, and broader version-migration tooling are out of current scope.

---

## 2. Recipe Management

### 2.1 Recipe Creation & Editing
**Status:** Implemented with active iteration. Check current persistence and editor behavior in code before changing data contracts.
- **Structured recipe rows** — support three types: Title (section headers), Ingredient (food ID + quantity), and Text (notes). Implement as a polymorphic `recipe_rows` table with a `row_type` enum.
- **Preparation instructions field** — dedicated rich-text field (JSONB) rendered below the ingredient list.
- **Water loss / cooking loss factor** — Optional `cooking_loss_percent` field on the recipe; final nutrient calculation: total nutrients / (raw weight × (1 - loss%)).
- **Recipe-level shopping list output** — generate list with configurable portion count and synonym resolution.

### 2.2 Recipe Analysis
**Status:** Implemented (LMIV allergen declaration, CO₂ footprint with per-ingredient breakdown).
- Full nutrient breakdown and comparison against intake recommendations.
- **Allergen declaration (LMIV-compliant)** — auto-derived from ingredient foods via three strategies: explicit `food.allergens`, BLS food-group-to-allergen inference, and name-token matching. Merged with manual allergens; auto-detected entries visually distinguished. Core logic in `lib/allergen-derivation.ts`.
- **CO₂ footprint calculation** — per-ingredient CO₂ computed from category emission factors, displayed in the ingredients table and sustainability card with plant/animal share visualization and top emitters. Remaining deferred: formal LMIV print output for PDF exports, "may contain traces" distinction.

### 2.3 Recipe Libraries
**Status:** Partially implemented. Plan-side library infrastructure shipped; recipe-side content depth still pending clinical curation.
- **Pre-built recipe & plan library** — Plan side: `/ernaehrungsplan/bibliothek` browser + detail view over `meal_plan_templates` with `source_type = 'system'`; 12 seeded templates across 6 indications with kcal/macro/style variants. Recipe side: 8 seed recipes still ship — target remains 1,300+ professionally curated entries.
- **Professional recipe exchange platform** — allow practitioners to publish recipes to a shared library within the app.
- **Meal-Master recipe import** — parser for `.mmf/.txt` legacy formats to migrate users from PRODI/EBISpro.

---

## 3. Meal Planning

### 3.1 Daily Meal Plans
**Status:** Implemented (Supabase-backed persistence with offline fallback, drag & drop, full plan lifecycle: create → analyze → compare → shop → discover).
- Automatic nutritional calculation for entire day across breakfast, snack, lunch, etc.
- **Broteinheiten (BE) display** — virtual nutrient (kohlenhydrate / 12) surfaced in totals, slot chips, Einzelanalyse, Plan-Vergleich, and Planvorlagen; bundled Diabetes-Diätlinie includes a BE target.
- **Einzelanalyse-Modus** — per-entry tab showing one row per food/recipe with configurable nutrient columns, %-of-total micro-bars, and an optional per-kg-body-weight normalization driven by the patient's latest anthropometric weight.
- **Zusatzstoffe / E-Nummern** — additive catalogue (`lib/reference-data/additives.ts`) with categories and clinical flags; canonicalising resolver displays badges on food, recipe, and plan-entry contexts and feeds the LMIV/Zusatzstoff sections in PDF exports.
- **Plan-Vergleich (`/ernaehrungsplan/vergleich`)** — pick up to 8 stored plans and view descriptive statistics per nutrient (Min/Max/⌀/Median/Stichproben-SD/CV) plus a per-nutrient bar chart with reference overlay. Matches PRODI's "Soll-Ist comparison" feature parity.
- **Einkaufsliste (`/ernaehrungsplan/einkaufsliste`)** — aggregate ingredients across up to 14 plans (≈ two weeks), expand recipes by `entry.amount / recipe.servings`, group by food category, foodId-key collapses synonyms; checkable list with `window.print()` export.
- **Planvorlagen (`/ernaehrungsplan/bibliothek`)** — browseable catalog of system and personal templates with scope, indication, and diet-line filters plus macro cards; overview can create a personal template from a saved Ernährungsplan, while the detail page applies via Calendar date picker (deep-link to planner with `?template=ID`) or clones into a personal-scope template.

### 3.2 Menu Plans
**Status:** Implemented (Supabase-backed persistence with offline fallback, week/4-week cycle planners).
- Full CRUD: create menu plans (name, cycle length 1/2/4 weeks, start date, diet forms), delete with confirmation, status toggle (Aktiv/Entwurf/Archiviert).
- Drag-and-drop recipe assignment with portion count dialog.
- Auto-generated production lists (per day) and shopping lists (per week) with category-based cost estimates and CSV export.
- Support for multi-day cycles and Teaching kitchen plans (Lehrkuechenplan).

### 3.3 Exchange Tables
**Status:** Implemented with mock-backed behavior.
- Food substitution lists based on similar nutritional profiles.

---

## 4. Dietary Assessment

### 4.1 Nutrition Protocols
**Status:** Implemented (guided assistant, templates, analytics).
- **AI-Assisted Food Matching (Market Leader Feature):** Implement NLP (Natural Language Processing) to map free-text patient entries ("1 Brötchen") to correct database IDs.
- **Freiburger Ernährungsprotokoll template** — standardized Freiburg protocol matching official DIN A4 layout.

### 4.2 Digital Client Protocol (Remote Entry)
**Status:** Implemented (public entry, practitioner review inbox, and draft conversion workflow).
- Web-based entry for patients via smartphone; submissions sync into the practitioner's dashboard.
- Practitioners can review incoming submissions and convert them into prefilled internal nutrition protocols for final clinical cleanup and save.

---

## 5. Patient/Client Management

### 5.1 Patient Records
**Status:** Implemented (Supabase-backed patient records, eGK demo workflow, PDF mail merge).
- **eGK Demo Workflow:** Simulate German insurance card intake via demo Web Serial / companion flows for patient onboarding demos and test runs.
- **Serial letter / mail merge** — Generate personalized PDFs using tokens (e.g., `{{patient.name}}`).
- **Birthday list** — dashboard widget for upcoming patient birthdays.

### 5.2 Counseling Workflow
**Status:** Implemented (Supabase-backed counseling sessions and template persistence with local fallback and login-time migration; patient-level workflow hub now orchestrates intake → assessment → planning → reporting → follow-up).
- Counseling sessions persist with patient linkage, structured follow-up timeline, shared materials, and progress metrics.
- Counseling templates persist per user and can be inserted into the session authoring flow instead of remaining browser-only.

### 5.3 Reports & Exports
**Status:** Implemented for investor-demo scope (real PDF/CSV generation, patient-bound immutable report history, archived reopen, export audit logging, admin-configured report retention metadata, live API-key issuance for the first external food-export boundary, and persisted webhook endpoint/queue management).
- **Clinical report export** — `/berichte` generates real server-side PDF and CSV files from the selected meal plan analysis, supports patient-aware workflow handoff via optional context query params, and now creates versioned patient-bound report records on export.
- **Patient document export** — `/patienten` mail merge creates branded PDF bundles with placeholder substitution.
- **Export journal** — `/api-export` persists real export history in Supabase via `export_jobs`.
- **API keys** — owner/admin users can issue and revoke hashed `prodi_` tokens for `exports:datasets:read`; API-key access is currently limited to non-custom Lebensmittel dataset exports.
- **Webhooks** — owner/admin users can create/disable HTTPS endpoints and inspect queued delivery attempts for export, report, and digital-protocol events.
- **Patient report history** — patient detail/workflow now surfaces immutable report versions with archived reopen and direct file download instead of relying only on the generic export journal.
- **Word/Excel export formats (Gap, user-priority)** — current exports are PDF and CSV. `docs/user-priority-feedback.md` asks for export of plans/results into Word and Excel (and possibly other clinic tools, ideally via API into clinic cloud/software environments, with DSGVO as a hard constraint). Native `.docx`/`.xlsx` output is not yet implemented; CSV is the only spreadsheet-compatible path today.
- **Remaining deferred scope:** scheduled exports, advanced backend print pipelines, and document-retention policies beyond patient report exports.

### 5.4 Anthropometric Data & Weight Analysis
**Status:** Implemented (Supabase-backed anthropometric history; adjacent patient analytics still mixed persistence).
- **BMI amputation correction** — adjust BMI formula using clinical correction factors (e.g., lower leg = 6.0%).
- **Target weight projection** — "what-if" calculator using current weight trends.
- **Percentile curves** — Overlay WHO/RKI P3-P97 curves for children (Requires age-in-months calculation).
- **Bedside Mode:** UI optimized for iPad/Tablet use in clinical wards with high-contrast, touch-friendly charts.

### 5.5 Medical Calculations
**Status:** Implemented (screenings/lab values persisted; calculators integrated directly with patient record).
- **Creatinine clearance calculation** — Cockcroft-Gault formula with unit conversion, weight-basis handling, and structured persistence in lab values.
- **MNA (Mini Nutritional Assessment)** — guided 18-item questionnaire for elderly patients with stored answer detail.
- **SGA (Subjective Global Assessment)** — structured assessment based on history and physical signs with persisted answer detail.

### 5.6 Clinical Record Detail
**Status:** Implemented (Supabase-backed clinical workspace with offline fallback and login-time migration).
- **Diagnoses** — patient diagnoses with ICD codes now persist in Supabase with offline fallback and login-time migration.
- **Medications** — patient medication lists now persist in Supabase with offline fallback and login-time migration.
- **Screenings** — MUST, NRS-2002, MNA, and SGA results now persist in Supabase with offline fallback and login-time migration.
- **Lab values** — patient laboratory measurements now persist in Supabase with offline fallback and login-time migration.
- **Activities** — activity and energy entries now persist in Supabase with offline fallback and login-time migration.
- **Therapy settings/integrations** — module states, target payloads, and device sync metadata now persist in Supabase with offline fallback and login-time migration.
- **PROCAM** — cardiovascular risk assessments now persist in Supabase with offline fallback and login-time migration.
- **Digital protocol links** — generated protocol links and status updates now persist in Supabase with offline fallback and login-time migration.

---

## 6. Institutional / Clinical Features

### 6.1 Hospital Management Features
**Status:** Partially implemented with real operational analytics. Inpatient meal workflow, tray cards, production batch execution, and institution dashboards now run on persisted menu plans, stays, meal orders, kitchen production batches/events, and allergen constraints; HIS integration remains roadmap.
- **Patient self-service menu selection** — tablet/bedside terminal selection for patients, filtered by diet form and allergens.
- **Table cards / tray cards** — auto-generate cards for meal trays showing room/bed, diet form, and selection.
- **Institution analytics** — compliance and institution statistics should derive from active menu cycles, meal orders, inpatient stays, and restriction snapshots rather than mock KPI datasets.
- **HIS Integration (HL7/FHIR):** Bidirectional sync with Hospital Information Systems to handle patient census data and diet orders.

---

## 7. User Management & Security

### 7.1 Authentication & Authorization
- **Implementation note:** Local development may bypass auth temporarily in `middleware.ts`. Do not treat that as the intended production model.
- **SSO foundation:** Organization admins can persist OIDC/SAML provider metadata, email domains, and verified claim-to-role mappings. The login page resolves active SSO configs by email domain, starts Supabase Auth SSO, and `/auth/sso/callback` applies verified IdP claims to organization memberships while preserving owners and rejecting ambiguous/no-match mappings.
- **LDAP/Active Directory mapping:** Group/claim-to-role mapping is implemented for verified OIDC/SAML claims. Direct LDAP bind/sync is deferred.

---

## 8. Technical Requirements

### 8.1 Integrations
- **HL7 message import** — MVP API implemented for ADT/ORU messages using `MSH`, `PID`, and numeric `OBX` segments mapped to `patients` and `patient_lab_values` with persisted import/review/audit jobs; `/admin/integrationen` now exposes filtered jobs, job details, open review-result closure, and lab mapping maintenance. Richer resolution workflows for mapping suggestions and patient-match decisions remain follow-up work.
- **FHIR sync** — first boundary defined for inbound `Patient` and lab `Observation` sync after the HL7 admin surface is stable; write-back and broader resources are deferred.
- **Web Serial/WebUSB** — for medical device and eGK card reader communication.

---

## 9. Prioritization (Market-Leader Roadmap)

Roadmap notes:
- **Top guideline override:** `docs/user-priority-feedback.md` is the current #1 prioritization lens. Where it pulls toward practitioner/counseling usability (intuitive UX, PAL-adjustable references, nutrient sort/filter, custom foods/recipes, sensible portions, Word/Excel export) and these clinic-first phases pull the other way, the user-priority feedback wins for sequencing until the user says otherwise. The clinic-IT phases below remain valid scope, not the default next-up order.
- These phases describe intended sequencing, not a strict delivery history.
- Individual items may already be partially or fully implemented ahead of their listed phase.

### MVP (Phase 1) - Core Platform & Scientific Precision
1. Food database with phonetic/fuzzy search (BLS + SFK). BLS fully imported; SFK ETL pipeline implemented (expanded nutrient definitions — aminosaeuren, fettsaeuren groups); SFK data import requires paid license.
2. **Mathematical Validation:** Verify calculation logic against DGE/Hohenheim standards.
3. Recipe creation with structured rows and water loss factors.

### Phase 2 - Professional Features & Automation
1. Patient management (eGK reader, ICD codes, birthday list).
2. **AI Protocol Matching:** Implement NLP mapping for free-text diaries.
3. Digital client protocol (Remote Entry).
4. Weight analysis with percentile curves and amputation correction.

### Phase 3 - Expert & Institutional Features
1. Lab values, Diabetes module, and Medication management.
2. **SSO Integration:** OIDC/SAML configuration, login-domain routing, verified callback role application, and LDAP/Active Directory group mapping requirements implemented.
3. **Bedside Optimized UI:** Tablet-first ward assistant with QR scanning.
4. PROCAM score and medical calculations (Creatinine clearance, MNA, SGA).

### Phase 4 - Full Clinical Integration
1. **HL7/FHIR Sync:** HL7 import MVP API and admin review surface implemented, with first FHIR Patient/Observation boundary defined; richer HL7 resolution workflows, FHIR sync, and bidirectional HIS integration remain later.
2. Kitchen production and tray card generation.
3. Quality report generation (Qualitätsbericht).

### Phase 5 - Ecosystem & Scaling
1. **Manufacturer Live API:** Integrate Open Food Facts and clinical manufacturer feeds.
2. Professional Recipe Exchange.
3. Multilingual UI (German + English first, then French + Italian).
4. Meal-Master recipe import.
