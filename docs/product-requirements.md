# Operation Prodi - Product Requirements

## Overview

A modern, web-based nutrition counseling and therapy management platform for clinics, practices, and pharmacies. This is a clone of **PRODI** by Nutri-Science GmbH — the market-leading German nutrition software since 1981.

**Strategic Goal:** To become the market leader by combining the scientific and clinical rigor of legacy German tools (PRODI, EBISpro) with the user experience and accessibility of modern SaaS (Nutrium).

---

## 1. Food & Nutrient Database

### 1.1 Food Composition Data
**Status:** Partially implemented (mock data; BLS 4.0 imported to Supabase, see database-guide.md).
- Comprehensive food database with **14,000+ foods** from official sources
- Support for multiple food composition databases:
  - **BLS** (Bundeslebensmittelschluessel) — German standard
  - **Souci-Fachmann-Kraut (SFK)** — detailed reference work (**Critical for scientific parity with EBISpro**)
  - **Swiss Nutrient Database** — for Swiss market
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
**Status:** Implemented (mock data, localStorage persistence).
- DGE (German), OeGE (Austrian), SGE (Swiss), and RDA values.
- Reference values adjustable by age, gender, pregnancy, lactation.

### 1.4 Advanced Food Search
**Status:** Implemented (Kölner Phonetik, trigram search, synonym management, and paginated server-backed `/lebensmittel` browsing).
- **Phonetic / fuzzy search (Kölner Phonetik)** — tolerate typos and umlaut variations. Implement using phonetic indexing (e.g., pg_trgm trigram index in PostgreSQL) to generate codes at food-insert time. This is a primary competitive advantage over international SaaS.
- **Multiple search modes** — food name, database code (BLS code), food group hierarchy, and full browse.
- **Food synonym management** — `food_synonyms` table linking user-defined names to food IDs; synonyms replace original names in search and printouts.

### 1.5 Database Management
**Status:** Partially implemented (mock version history, comparison tool).
- **Global search & replace foods** — find and replace a specific food ID across all recipes, meal plans, and protocols in one operation. Essential for handling database version updates.

---

## 2. Recipe Management

### 2.1 Recipe Creation & Editing
**Status:** Implemented (mock data, localStorage).
- **Structured recipe rows** — support three types: Title (section headers), Ingredient (food ID + quantity), and Text (notes). Implement as a polymorphic `recipe_rows` table with a `row_type` enum.
- **Preparation instructions field** — dedicated rich-text field (JSONB) rendered below the ingredient list.
- **Water loss / cooking loss factor** — Optional `cooking_loss_percent` field on the recipe; final nutrient calculation: total nutrients / (raw weight × (1 - loss%)).
- **Recipe-level shopping list output** — generate list with configurable portion count and synonym resolution.

### 2.2 Recipe Analysis
**Status:** Partially implemented (basic breakdowns).
- Full nutrient breakdown and comparison against intake recommendations.
- **PRODIscore-style food quality rating** (5-level scale).
- Allergen declaration (LMIV-compliant) and CO2 footprint calculation.

### 2.4 Recipe Libraries
**Status:** Partially implemented.
- **Pre-built recipe & plan library** — ship with 1,300+ professionally created recipes (seed data with `is_system` flag).
- **Professional recipe exchange platform** — allow practitioners to publish recipes to a shared library within the app.
- **Meal-Master recipe import** — parser for `.mmf/.txt` legacy formats to migrate users from PRODI/EBISpro.

---

## 3. Meal Planning

### 3.1 Daily Meal Plans
**Status:** Implemented (Supabase-backed persistence with offline fallback, drag & drop).
- Automatic nutritional calculation for entire day across breakfast, snack, lunch, etc.

### 3.2 Menu Plans
**Status:** Implemented (Supabase-backed persistence with offline fallback, week/4-week cycle planners).
- Full CRUD: create menu plans (name, cycle length 1/2/4 weeks, start date, diet forms), delete with confirmation, status toggle (Aktiv/Entwurf/Archiviert).
- Drag-and-drop recipe assignment with portion count dialog.
- Auto-generated production lists (per day) and shopping lists (per week) with category-based cost estimates and CSV export.
- Support for multi-day cycles and Teaching kitchen plans (Lehrkuechenplan).

### 3.3 Exchange Tables
**Status:** Implemented (mock data).
- Food substitution lists based on similar nutritional profiles.

---

## 4. Dietary Assessment

### 4.1 Nutrition Protocols
**Status:** Implemented (guided assistant, templates, analytics).
- **AI-Assisted Food Matching (Market Leader Feature):** Implement NLP (Natural Language Processing) to map free-text patient entries ("1 Brötchen") to correct database IDs.
- **Freiburger Ernährungsprotokoll template** — standardized Freiburg protocol matching official DIN A4 layout.

### 4.3 Digital Client Protocol (Remote Entry)
**Status:** Implemented (public entry, practitioner review inbox, and draft conversion workflow).
- Web-based entry for patients via smartphone; submissions sync into the practitioner's dashboard.
- Practitioners can review incoming submissions and convert them into prefilled internal nutrition protocols for final clinical cleanup and save.

---

## 5. Patient/Client Management

### 5.1 Patient Records
**Status:** Implemented (Supabase-backed patient records, eGK workflow, PDF mail merge).
- **eGK Card Reader Support:** Read German insurance cards directly via Web Serial API or WebSocket companion app.
- **Serial letter / mail merge** — Generate personalized PDFs using tokens (e.g., `{{patient.name}}`).
- **Birthday list** — dashboard widget for upcoming patient birthdays.

### 5.3 Reports & Exports
**Status:** Partially implemented (real PDF/CSV generation for reports, patient documents, and export jobs; broader document/storage workflows still open).
- **Clinical report export** — `/berichte` generates real server-side PDF and CSV files from the selected meal plan analysis.
- **Patient document export** — `/patienten` mail merge creates branded PDF bundles with placeholder substitution.
- **Export journal** — `/api-export` persists real export history in Supabase via `export_jobs`.
- **Deferred scope:** binary file retention, scheduled exports, and advanced backend print pipelines are still future work.

### 5.2 Anthropometric Data & Weight Analysis
**Status:** Implemented (Supabase-backed anthropometric history; adjacent patient analytics still mixed persistence).
- **BMI amputation correction** — adjust BMI formula using clinical correction factors (e.g., lower leg = 6.0%).
- **Target weight projection** — "what-if" calculator using current weight trends.
- **Percentile curves** — Overlay WHO/RKI P3-P97 curves for children (Requires age-in-months calculation).
- **Bedside Mode:** UI optimized for iPad/Tablet use in clinical wards with high-contrast, touch-friendly charts.

### 5.5 Medical Calculations
**Status:** Implemented (screenings and lab values persisted; calculators integrated directly with patient record).
- **Creatinine clearance calculation** — Cockcroft-Gault formula prefilled from recent lab values; critical for renal diet planning.
- **MNA (Mini Nutritional Assessment)** — guided 18-item questionnaire for elderly patients.
- **SGA (Subjective Global Assessment)** — structured assessment based on physical signs and history.

### 5.4 Clinical Record Detail
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

## 8. Institutional / Clinical Features

### 8.4 Hospital Management Features
**Status:** Implemented (mock data, bed grid, dietary order board).
- **Patient self-service menu selection** — tablet/bedside terminal selection for patients, filtered by diet form and allergens.
- **Table cards / tray cards** — auto-generate cards for meal trays showing room/bed, diet form, and selection.
- **HIS Integration (HL7/FHIR):** Bidirectional sync with Hospital Information Systems to handle patient census data and diet orders.

---

## 10. User Management & Security

### 10.1 Authentication & Authorization
- **SSO (Active Directory/LDAP):** Mandatory for clinical sales to allow hospital IT to manage user access centrally.

---

## 11. Technical Requirements

### 11.3 Integrations
- **HL7 message import** — HL7 v2.x parser to map segments (PID, OBX, ORC) to patient and lab models. This covers legacy systems where FHIR is not yet available.
- **Web Serial/WebUSB** — for medical device and eGK card reader communication.

---

## 14. Prioritization (Market-Leader Roadmap)

### MVP (Phase 1) - Core Platform & Scientific Precision
1. Food database with phonetic/fuzzy search (BLS + SFK).
2. **Mathematical Validation:** Verify calculation logic against DGE/Hohenheim standards.
3. Recipe creation with structured rows and water loss factors.

### Phase 2 - Professional Features & Automation
1. Patient management (eGK reader, ICD codes, birthday list).
2. **AI Protocol Matching:** Implement NLP mapping for free-text diaries.
3. Digital client protocol (Remote Entry).
4. Weight analysis with percentile curves and amputation correction.

### Phase 3 - Expert & Institutional Features
1. Lab values, Diabetes module, and Medication management.
2. **SSO Integration:** Support for LDAP/Active Directory.
3. **Bedside Optimized UI:** Tablet-first ward assistant with QR scanning.
4. PROCAM score and medical calculations (Creatinine clearance, MNA, SGA).

### Phase 4 - Full Clinical Integration
1. **HL7/FHIR Sync:** Bidirectional HIS integration.
2. Kitchen production and tray card generation.
3. Quality report generation (Qualitätsbericht).

### Phase 5 - Ecosystem & Scaling
1. **Manufacturer Live API:** Integrate Open Food Facts and clinical manufacturer feeds.
2. Professional Recipe Exchange.
3. Multilingual UI (German + English first, then French + Italian).
4. Meal-Master recipe import.
