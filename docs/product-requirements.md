# Operation Prodi - Product Requirements

## Overview

A modern, web-based nutrition counseling and therapy management platform for clinics, practices, and pharmacies. This is a clone of **PRODI** by Nutri-Science GmbH — the market-leading German nutrition software since 1981.

Our goal: rebuild all core functionality as a modern SaaS application using Next.js, Supabase, and modern web technologies.

---

## 1. Food & Nutrient Database

### 1.1 Food Composition Data
**Status:** Partially implemented with mock data (limited foods, core nutrients, multi-source filters; no live datasets yet).
- Comprehensive food database with **14,000+ foods** from official sources
- Support for multiple food composition databases:
  - **BLS** (Bundeslebensmittelschluessel) — German standard
  - **Souci-Fachmann-Kraut (SFK)** — detailed reference work
  - **Swiss Nutrient Database** — for Swiss market
  - **USDA National Nutrient Database** — for international / English-speaking clients
  - **Australian Food Composition Database (AFCD)** — for Australian market and English-language support
- Up to **330+ nutrients** per food item, including:
  - Macronutrients (protein, fat, carbohydrates, fiber, water, alcohol)
  - 25 amino acids
  - 60+ fatty acid profiles
  - 35+ vitamins and variants
  - 25+ minerals and trace elements
  - 35+ carbohydrate subtypes
  - 12 biogenic amines
  - 35+ organic acids
  - Phospholipids, sterols, phytochemicals
- Clear source identification per food item (which database it originates from)
- **Multilingual food names** — store and display food names in German, English, French, and Italian. Implement as a `food_translations` table with locale keys linked to each food item; UI language selector determines which name is shown in search results and displays
- **Preparation context tagging** — tag foods by preparation context (household, commercial kitchen, restaurant) to help users find the right variant. Implement as an enum column on the food table with a filter chip in the search UI

### 1.2 Manufacturer Product Database
**Status:** Partially implemented (small mock manufacturer catalog + custom food builder; no large-scale dataset/import yet).
- **29,000+ branded products** from major food manufacturers
- Product categories:
  - General consumer products
  - Organic products
  - Diabetes-specific products
  - Clinical nutrition / enteral & parenteral nutrition
  - Infant nutrition
  - Gluten-free products
  - Lactose-free products
  - Novel / insect-based foods
- Ability to add and manage custom food entries with:
  - Nutrient values
  - Portion sizes
  - Allergens
  - Additives

### 1.3 Reference Values
**Status:** Implemented with mock data (DGE, ÖGE, SGE, RDA standards with full age/gender bracket matrix; custom profiles with per-nutrient overrides; life-stage adjustment for pregnancy/lactation; standard comparison view; global standard selector persisted in localStorage; compact selector integrated into food detail, protocol analysis, meal plan, and report views).
- DGE (Deutsche Gesellschaft fuer Ernaehrung) reference values
- OeGE (Austrian) reference values
- SGE (Swiss) reference values
- RDA values
- Custom/user-defined intake recommendations
- Reference values adjustable by age, gender, pregnancy, lactation

### 1.4 Advanced Food Search
**Status:** Implemented with mock data (Kölner Phonetik fuzzy search with trigram similarity, four search modes — name/code/group/browse — with BLS food group hierarchy navigation, match-type indicators, contextual search tips, plus synonym management with alias table + UI to replace display names).
- **Phonetic / fuzzy search (Kölner Phonetik)** — tolerate typos, phonetic misspellings, and umlaut variations when searching German food names. Implement using a phonetic indexing algorithm (e.g., Cologne phonetics or pg_trgm trigram index in PostgreSQL) that generates phonetic codes at food-insert time and matches them during search queries. Essential for usability with compound German food names
- **Multiple search modes** — support searching by food name, by database code number (e.g., BLS code), by food group hierarchy, and by full database browse. Implement as tabbed search interface or search-mode selector with different query backends per mode
- **Food synonym management** — allow users to assign display aliases to foods (e.g., show "Nudeln" instead of "Eierteigwaren"). Implement as a `food_synonyms` table linking a user-defined display name to a food ID; synonyms appear in search results and can replace the original name in recipe printouts

### 1.5 Database Management
**Status:** Partially implemented (mock version history, source filter, comparison tool live; no real update pipeline yet).
- Database versioning and update mechanism
- Data origin filter (show/hide food sources)
- Search and filter across all databases
- Food comparison tool (side-by-side, adjustable portions)
- **Global search & replace foods** — find and replace a specific food item across all recipes, meal plans, and protocols in one operation. Implement as a batch-update tool in the database management section that queries all tables referencing the old food ID and replaces with the new one, showing a preview of affected items before committing

---

## 2. Recipe Management

### 2.1 Recipe Creation & Editing
**Status:** Implemented with mock data (forms, nutrient calculations, tags, images, targets persisted locally).
- Create, store, and manage recipes
- Ingredient entry with flexible portion/quantity input
- Automatic nutritional calculation for entire recipe
- Assign categories/tags to recipes
- Attach images to recipes
- Set target intake recommendations per recipe
- **Structured recipe rows** — support three row types within a recipe: Title (section headers like "Sauce"), Ingredient (food item with quantity), and Text (free-text notes like "let rest for 10 min"). Implement as a polymorphic `recipe_rows` table with a `row_type` enum and conditional fields; render each type differently in the recipe editor and printout
- **Preparation instructions field** — dedicated rich-text field for cooking/preparation steps separate from the ingredient list. Implement as a `preparation_instructions` column (text/JSONB for rich text) on the recipe table, rendered below the ingredient list in the recipe detail view
- **Water loss / cooking loss factor** — account for weight change during cooking (evaporation, drip loss) when calculating per-portion nutrients. Implement as an optional `cooking_loss_percent` field on the recipe; final nutrient-per-portion calculation divides total nutrients by (cooked weight = raw weight × (1 - loss%)) instead of raw weight
- **Recipe-level shopping list output** — generate a shopping list from any individual recipe with configurable portion count and synonym resolution (e.g., resolve "Nudeln" back to "Eierteigwaren" for shopping). Implement as a "Generate shopping list" action on the recipe detail page that multiplies quantities by a user-entered portion count and groups items by food category

### 2.2 Recipe Analysis
**Status:** Partially implemented (nutrient breakdowns, PRODIscore mock, CO₂, allergen/additive display; advanced analytics pending).
- Full nutrient breakdown of recipe
- Comparison against intake recommendations (graphical + tabular)
- PRODIscore-style food quality rating (5-level scale)
- Allergen declaration per recipe (LMIV-compliant)
- CO2 footprint calculation per recipe

### 2.3 Recipe-as-Food Conversion
**Status:** Implemented with mock persistence (recipes can be saved as custom foods for reuse).
- Convert finished recipes into reusable food items
- Use converted recipes as ingredients in other recipes or meal plans

### 2.4 Recipe Libraries
**Status:** Partially implemented (personal/community filters, import/export placeholders; locking & collaboration pending).
- Personal recipe collections
- Shared/community recipe library
- Recipe import/export functionality
- Recipe lock management for multi-user environments
- **Pre-built recipe & plan library** — ship with 1,300+ professionally created recipes and daily plans covering common indications (diabetes, renal, weight loss, pediatric, etc.) plus 7 elaborated daily plan collections (28 plans each). Source recipes from licensed nutritional content or create original content; store as seed data in the database with an `is_system` flag so they cannot be accidentally deleted but can be cloned and customized by users
- **Professional recipe exchange platform** — allow practitioners to publish recipes to a shared professional library and import recipes from other practitioners, with structured nutritional metadata intact. Implement as a community marketplace within the app where recipes can be shared publicly or within professional groups, preserving all nutrient calculations and portion data on import
- **Meal-Master recipe import** — support importing recipes from Meal-Master format (.mmf/.txt), a legacy but widely-used recipe exchange format. Implement a parser that reads Meal-Master structured text, maps ingredient lines to food database entries (with fuzzy matching), and creates recipe objects

---

## 3. Meal Planning

### 3.1 Daily Meal Plans
**Status:** Implemented with mock data (day view now features drag & drop from recipe library, diet-line presets, exchange-list substitutions, and compliance indicators against reference targets).
- Create daily meal plans (Tagesplaene)
- Assign meals to time slots (breakfast, snack, lunch, snack, dinner)
- Automatic nutritional calculation for entire day
- Comparison with reference values

### 3.2 Menu Plans
**Status:** Implemented with mock data (week and 4-week cycle planners with drag-and-drop recipe assignment from sidebar library, inline portion editing, per-diet-form weekly grid, dynamically generated production lists by day with expandable ingredient breakdowns, aggregated weekly shopping lists with category grouping/portion scaling/CSV export, and teaching-kitchen preview with multi-day nutrient summaries).
- Create multi-day/weekly menu plans (Menueplaene)
- Support for up to 4-week meal plan cycles
- Drag-and-drop recipe integration
- Teaching kitchen plans (Lehrkuechenplan)

### 3.3 Exchange Tables
**Status:** Implemented with mock data (searchable lists plus slot-level substitution dialog integrated into the meal planner; export formats still future work).
- Food exchange/substitution lists
- Swap foods with similar nutritional profiles
- Sorting, filtering, and export of exchange tables

### 3.4 Meal Plan Evaluation
**Status:** Partially implemented (daily/weekly bars, diet-line compliance badges, and teaching-kitchen summaries live; deeper analytics/food group dashboards outstanding).
- Graphical and tabular nutrient evaluation
- Average nutritional intake across planning periods
- Dietary specification compliance checks
- Food group diversity analysis

---

## 4. Dietary Assessment

### 4.1 Nutrition Protocols
**Status:** Implemented with mock data (protocol wizard, templates, comparison dashboard, and side-by-side compliance badges available; advanced analytics/export still pending).
- Create and manage dietary records/food diaries
- Input food consumption data with flexible entry methods
- Compare protocols against intake recommendations
- Compare multiple dietary protocols side by side
- Template-based protocol entry
- **Freiburger Ernährungsprotokoll template** — include the standardized Freiburg nutrition protocol as a built-in template with food-order matching the official DIN A4 printed form layout. Implement as a predefined protocol template with fixed category sections (beverages, bread, spreads, dairy, etc.) that guides sequential entry and can be printed in the standard form format
- **Vegetarian & vegan protocol templates** — dedicated protocol templates optimized for plant-based diets with relevant food categories (legumes, tofu/tempeh, plant milks, supplements like B12) pre-configured. Implement as additional seed templates selectable in the protocol wizard
- **Protocol assistant with guided entry** — structured step-by-step protocol entry that walks users through food categories in logical meal order, with quantity confirmation via Enter key for speed. Implement as a wizard-style entry mode alternative to free-form entry, optimized for keyboard-heavy data input

### 4.2 Simplified Protocol Entry
**Status:** Partially implemented (Haushaltsmengen workflow covered via wizard templates; standalone reporting/automation TBD).
- Protocol using common household measurements (no precise weighing)
- Specify age, gender, and number of documented days
- Automatic analysis against DACH reference values

### 4.3 Digital Client Protocol (Remote Entry)
**Status:** Implemented with mock data (digital link/QR generation, status tracking, and local storage sync enabled; real connectivity still outstanding).
- Web-based dietary protocol entry for patients/clients
- Accessible via PC, tablet, and smartphone
- Patients can log food intake remotely
- Data syncs to practitioner's dashboard
- Configurable protocol templates

### 4.4 Assessment Methods
**Status:** Partially implemented (24h recall, FFQ, diary, and Haushaltsmengen selections surfaced in the wizard; further method-specific analytics to follow).
- 24-hour recall
- Food frequency questionnaire (FFQ)
- Multi-day food diary
- Dietary history

---

## 5. Patient/Client Management

### 5.1 Patient Records
**Status:** Implemented with mock data (demographics plus diagnoses, medications, insurance, wizard-driven history tools, eGK-Kartenleser-Workflow, Serienbrief/Mail-Merge und Geburtstagsliste sind verfügbar).
- Create and manage patient profiles
- Demographic data (name, DOB, gender, contact)
- Medical history
- Diagnosis documentation with ICD codes
- Insurance information
- Search, filter, and sort patient database
- **Health insurance card reader (eGK) support** — read patient master data directly from German electronic health insurance cards (elektronische Gesundheitskarte). Implement using the Web Serial API or a small companion desktop app that communicates with USB card readers (Cherry ST-2000 series, etc.) and pushes patient data (name, DOB, insurance number, insurance provider) into the patient creation form via a WebSocket or REST endpoint. Fallback: manual entry with a "scan card" button that opens the companion app
- **Serial letter / mail merge** — generate bulk personalized correspondence (e.g., appointment reminders, nutrition summaries, recall letters) by merging patient data fields into document templates. Implement a template editor with placeholder tokens (e.g., `{{patient.name}}`, `{{patient.last_visit}}`) and a "Generate for selection" action that produces individual PDFs for a filtered patient list using a server-side PDF renderer
- **Birthday list** — auto-generated list of upcoming patient birthdays for the practice. Implement as a dashboard widget or patient list filter that queries patients by birth month/day and displays upcoming birthdays within a configurable time window (e.g., next 30 days)

### 5.2 Anthropometric Data & Weight Analysis
**Status:** Implemented with mock data (charts, PAL/BMR calculator, activity log, BMI-Amputationskorrektur, Zielgewichtsprojektion und pädiatrische Perzentilen sind live; predictive analytics still future work).
- BMI calculation and tracking
- Weight progression charts
- PAL (Physical Activity Level) calculation
- Energy requirement calculations (WHO basal metabolic rate formula)
- Activity tracking with sport types
- Anthropometric measurements over time
- **BMI amputation correction** — adjust BMI calculation for patients with amputations using standard correction factors (e.g., lower leg = 6.0%, upper leg = 18.6%). Implement by adding an optional `amputation` field on the patient profile with predefined body-part selections; the BMI formula automatically applies the corresponding weight correction factor from clinical reference tables
- **Target weight projection** — calculate estimated time to reach a goal weight based on current weight trend and energy deficit. Implement as a "what-if" calculator on the weight analysis page: user enters target weight and daily caloric deficit, system projects a date using a linear model and displays it on the weight progression chart as a projected trend line
- **Percentile curves for children & adolescents** — display BMI, weight, and height against age- and gender-specific percentile curves (WHO/RKI reference data). Implement by storing WHO Child Growth Standards percentile tables in the database; when the patient is under 18, the weight/BMI chart overlays the P3, P10, P25, P50, P75, P90, P97 curves using Recharts reference lines. Requires age-in-months calculation from DOB

### 5.3 Laboratory Values
**Status:** Implemented with mock data (lab dashboard, trend sparkline, parameter forms, and reference badges live; advanced exports still pending).
- Input and track 40+ laboratory parameters
- Trend graphics for lab value progression
- Configurable lab data sheets
- Set reference/normal values for patient groups
- Graphical representation of metabolic parameter progression with normal ranges

### 5.4 Medication Management
**Status:** Implemented with mock data (structured medication tables/forms with dosage, schedule, and notes captured in patient tabs).
- Document patient medications
- Record dosages and schedules
- Medication history tracking
- Correlate medication changes with nutrition therapy outcomes

### 5.5 Medical Calculations
**Status:** Implemented with mock data (MUST/NRS-2002, PROCAM, Kreatinin-Clearance nach Cockcroft-Gault, MNA und SGA stehen als Wizards bereit; weitere Rechner können auf dieser Basis aufsetzen).
- PROCAM cardiovascular risk score
- Lipid ratio calculations (LDL/HDL ratio, triglyceride ratios)
- BMI classification
- Energy requirement formulas
- **Creatinine clearance calculation** — estimate renal function using the Cockcroft-Gault formula (inputs: serum creatinine, age, weight, gender). Implement as a calculator widget in the medical calculations section that takes lab values and patient demographics as input and outputs estimated creatinine clearance in mL/min. Critical for renal diet planning
- Malnutrition screening/assessment tools:
  - MUST (Malnutrition Universal Screening Tool)
  - NRS 2002 (Nutritional Risk Screening)
  - **MNA (Mini Nutritional Assessment)** — standardized screening tool specifically for elderly patients (65+). Implement as a guided questionnaire form (18 items covering dietary intake, weight loss, mobility, BMI, neuropsychological problems) that auto-calculates the MNA score and classifies nutritional status (normal / at risk / malnourished)
  - **SGA (Subjective Global Assessment)** — clinical assessment tool based on medical history and physical examination. Implement as a structured form with sections for weight change, dietary intake change, GI symptoms, functional capacity, and physical signs (subcutaneous fat loss, muscle wasting, edema); produces an SGA rating (A = well nourished, B = moderate/suspected malnutrition, C = severe malnutrition)

---

## 6. Nutrition Therapy & Specialized Diets

### 6.1 Diabetes Management
**Status:** Implemented with mock data (CGM-/BZ-Analytics mit TIR-Badges, BE-/KE-Rechner, Therapieziele und Modulschalter sind im Einsatz; erweiterte Geräte-Anbindungen folgen später).
- Blood glucose value tracking and management
- Action assignments for glucose values
- BE (Broteinheiten) and KE (Kohlenhydrateinheiten) calculations
- Tabular and graphical diabetes analysis
- Diabetes-specific meal planning

### 6.2 Ketogenic Diet
**Status:** Implemented with mock data (Ratio-Slider, Energieziele, berechnete Makronährstoffblöcke und Ketoplan-Generator stehen bereit; dedizierte Planbibliothek folgt).
- Ketogenic ratio calculations
- Specialized parameter settings
- Ketogenic meal plan creation

### 6.3 Allergen & Intolerance Management
**Status:** Implemented with mock data (Allergen-Toggles lösen automatische Warnhinweise für Rezepte/Pläne aus, inklusive Integration in die Therapiekarte; Backend-Automation folgt).
- Pre-configured allergen database (EU allergens)
- Customizable allergen tracking per patient
- Additive management
- LMIV-compliant allergen declarations
- Allergen warnings in recipe/meal plan creation

### 6.4 Therapeutic Diets
**Status:** Implemented with mock data (konfigurierbares Therapiekatalog-Panel mit aktivierbaren Diätformen und Zielwerten ist verfügbar; tiefe Automationen bleiben zukünftige Arbeit).
- Configurable diet forms for various conditions
- Lactose-free diet support
- Fructose-reduced diet support
- Gluten-free diet support
- Vegetarian and vegan protocols
- Renal diet calculations
- Low-sodium diets
- Custom therapeutic diet creation

---

## 7. Counseling & Documentation

### 7.1 Counseling Session Management
**Status:** Implemented with mock data (session detail now includes interactive timeline, material attachments, and progress indicators).
- Document counseling activities/sessions (Beratungsticker)
- Assign indications and counseling goals per session
- Track counseling progress over time
- Counseling text templates library with **40+ pre-written counseling texts** covering common nutrition topics (diabetes nutrition, weight management, food allergies, renal diet, pediatric nutrition, etc.). Ship as seed content in rich text format that practitioners can use as-is or customize. Implement as a `counseling_templates` table with category, title, and rich-text body; accessible via a template picker in the session documentation editor
- Assign counseling materials to patients

### 7.2 Reports & Printouts
**Status:** Implemented with mock data (report builder with section toggles, print preview, pie/meal charts, and fake PDF/CSV export buttons available under /berichte).
- Tabular nutrient comparisons
- Pie charts for nutrient distribution
- Graphical food composition visualizations
- Intake vs. reference value assessments
- Short-form and comprehensive printable reports
- Written evaluations alongside data tables

### 7.3 Specialized Outputs
**Status:** Implemented with mock data (CO₂ dashboard, LMIV label generator, health-claim checklist, PRODIscore badge, and food-group diversity summary now live on /berichte).
- Health claims and nutrient profiling declarations
- CO2 footprint reports
- Food group diversity reports
- LMIV-compliant nutrition labels for food manufacturers
- PRODIscore food quality ratings

### 7.4 Text Processing & Export
**Status:** Implemented with mock data (template manager with placeholders, formatting toolbar, nutrient visibility toggles, and extended export controls on /berichte).
- Built-in text editor/processor
- Export to PDF
- Customizable report templates
- Insert patient data fields into templates
- Configurable nutrient display (show/hide specific nutrients)
- **Custom nutrient quotients & ratios** — allow users to define custom calculated nutrient ratios (e.g., omega-6:omega-3 ratio, calcium:phosphorus ratio) that appear as derived columns in nutrient tables and reports. Implement as a `custom_nutrient_ratios` table storing numerator nutrient ID, denominator nutrient ID, and display name; calculate on-the-fly during report generation and display alongside standard nutrients
- **Quality report generation (Qualitätsbericht)** — generate comprehensive institutional quality reports combining patient statistics, nutritional compliance data, diet form distribution, and counseling activity summaries into a single formatted document. Implement as a report builder that aggregates data from multiple modules (patients, meal plans, counseling sessions) into a structured PDF with configurable sections, practice logo/header, and auto-populated summary statistics

---

## 8. Institutional / Clinical Features

### 8.1 Weekly Meal Planning for Institutions
**Status:** Implemented with mock data (weekly and 4-week cycle planners with 8 diet forms, 3 parallel diet lines per day, portion counts per slot, and daily portion totals; drag-and-drop and import still pending).
- Create, save, and import weekly meal plans for facilities
- Support for 4-week meal plan cycles
- Drag-and-drop recipe integration
- Customizable diet forms with unlimited options
- Multiple diet lines running in parallel

### 8.2 Kitchen Production Management
**Status:** Implemented with mock data (production lists grouped by recipe/diet form with scaled ingredient breakdowns; shopping lists grouped by food category with cost estimates, portion scaling input, and CSV export placeholder).
- Shopping lists organized by food groups
- Production lists organized by kitchen station and/or day
- Meal plan printouts with preparation instructions
- Portion scaling for different group sizes
- Cost calculation and optimization (5-10% savings target)

### 8.3 Nutritional Compliance for Institutions
**Status:** Implemented with mock data (daily compliance dashboard with per-nutrient actual vs. target tables, score badges, status icons, diet form filtering, and trend overview across multiple days).
- Daily nutritional value calculations per meal plan
- Average nutritional intake across weeks or planning periods
- Dietary specification compliance verification
- Quality assurance reporting

### 8.4 Hospital Management Features
**Status:** Implemented with mock data (bed grid by station with occupancy/diet form/allergen display; dietary order board with status filtering, meal slot filters, and confirm/deliver actions with toast feedback).
- Dietary & laboratory orders via screen interface
- Automated patient scheduling (Disposition)
- Menu selection with allergy/intolerance display
- Kitchen production lists with portion counts and dietary form specs
- Cost calculation for therapies and medications
- **Patient self-service menu selection** — allow hospital patients to choose their meals from available options on a tablet or bedside terminal, with automatic allergy/intolerance warnings and diet-form filtering. Implement as a simplified patient-facing UI (accessible via a patient-specific link or QR code) that shows only menu items compatible with the patient's assigned diet form and flagged allergens; selections are pushed to the kitchen production system in real-time via Supabase Realtime
- **Table cards / tray cards** — auto-generate per-patient meal tray cards showing the patient's name, room/bed, diet form, allergens, and selected meal items for each meal slot. Implement as a print-optimized view that queries the day's menu selections grouped by ward/room and renders them as a grid of cards formatted for standard label printers or A4 sheets (cut marks included)
- **Hospital management system integration (ODBC/API)** — import patient census data, bed assignments, and diet prescriptions from external hospital information systems. Implement as a configurable integration endpoint that accepts HL7 ADT messages or structured CSV/JSON imports to sync patient master data and diet orders into our system. Provide a webhook or polling mechanism for bidirectional sync

### 8.5 Statistics for Institutions
**Status:** Implemented with mock data (diet form distribution bar chart + table; recipe popularity with star ratings; cost trend line chart with daily/weekly summaries; KPI overview cards for occupancy, costs, compliance, and orders).
- Dietary form statistics
- Menu choice statistics
- Laboratory performance statistics
- Diagnosis statistics
- Therapy performance statistics

---

## 9. Practice Management

### 9.1 Appointment Scheduling
**Status:** Implemented with mock data (Termine page offers day/week/month calendar views, patient filters, recurring templates, reminders, and local-storage scheduling flows).
- Calendar-based scheduling
- Patient appointment management
- Recurring appointment support
- Appointment reminders (email/push)

### 9.2 Billing & Invoicing
**Status:** Implemented with mock data (Abrechnung deck handles invoice creation, payment tracking, insurance routing, and financial reporting widgets).
- Create invoices for counseling sessions
- Track payments
- Insurance billing support
- Financial reporting

### 9.3 Patient Statistics
**Status:** Implemented with mock data (Praxis-Statistiken dashboard aggregates KPIs, charts, and statistical tables with min/max/mean/std plus performance progress bars).
- Tabular and graphical patient statistics
- Statistical overview of counseling activities
- Min/max values, mean, standard deviation, variance
- Practice performance dashboards

---

## 10. User Management & Security

### 10.1 Authentication & Authorization
**Status:** Implemented with mock data (Supabase-ready Auth-Flow, Admin-RBAC und MFA-Verwaltung auf /admin/users).
- User accounts with password protection
- Role-based access control (admin, practitioner, assistant, patient)
- Supervisor/admin account with master permissions
- Multi-user support for team practices

### 10.2 Data Security
**Status:** Implemented with mock data (Security Center mit Audit-Logs, Verschlüsselungsebenen und Backup-/RPO-Übersicht).
- GDPR-compliant data handling
- Database backup and restore
- Audit logging
- Encrypted data storage and transmission

---

## 11. Technical Requirements

### 11.1 Platform
**Status:** Partially implemented (responsive web app + PWA indicator; offline mode limited, mobile polish pending).
- **Web application** (responsive, works on desktop and mobile)
- Progressive Web App (PWA) for offline capability
- Modern browser support (Chrome, Firefox, Safari, Edge)
- **Multilingual UI** — support German (default), English, French, and Italian interface languages to serve the DACH region plus international practitioners. Implement using `next-intl` or a similar i18n library with JSON locale files per language; user selects language in profile settings; all UI strings, labels, and system messages are translated. Food names use the multilingual food name data from section 1.1. Start with German + English, add French and Italian in a later phase

### 11.2 Architecture
**Status:** Partially implemented (Next.js foundation in place; Supabase/backend pieces not connected).
- Next.js App Router
- Supabase backend (PostgreSQL, Auth, Storage, Realtime)
- Server-side rendering for performance
- API-first design for future integrations

### 11.3 Integrations
**Status:** Implemented with mock data (full /api-export page with four tabs: CSV/JSON/PDF export & import, REST API key management with reveal/copy/revoke plus endpoint explorer with sample responses, integration toggles for EHR/FHIR/pharmacy/DEBInet with webhook configuration, and filterable export/import history log; real backend connectivity still outstanding).
- Data import/export (CSV, JSON, PDF, **XML, HTML, Excel**)
- API for third-party integrations
- **HL7 message import** — import patient demographics, lab results, and diet orders from HL7 v2.x ADT/ORU messages, which are the standard format used by existing German hospital information systems. Implement an HL7 parser (use a library like `node-hl7-complete` or similar) that accepts HL7 messages via file upload or a dedicated API endpoint, maps segments (PID, OBX, ORC) to our patient, lab value, and diet order models, and creates/updates records accordingly. This is distinct from FHIR (which is newer/REST-based) and covers legacy systems that most German hospitals still run
- Potential future: electronic health record (EHR) integration via FHIR
- Potential future: pharmacy system integration

### 11.4 Performance
**Status:** Implemented with mock data (full /leistung dashboard with KPI cards, 24h response-time area chart, load-test results table for 10–1000 concurrent users, interactive stress-test simulation with progress bar, system resource utilization meters, and database query stats with cache-hit rates; real performance data collection still outstanding).
- Fast search across 40,000+ food items
- Real-time nutrient calculations
- Responsive UI for complex data visualizations
- Support for concurrent multi-user access

---

## 12. Additional Features

### 12.1 Knowledge Base
**Status:** Implemented with mock data (filterbare `/wissen`-Ansicht mit Karten, Suche und KPI-Modulen).
- Integrated nutrition lexicon
- Herb lexicon
- Educational resources for patients
- Consultation text library
- **Consumer Q&A library (Infothek)** — 250+ curated questions and answers on common consumer nutrition topics (e.g., "Is coconut oil healthy?", "How much protein do I need?"). Practitioners can share these directly with patients as educational handouts or link them in counseling sessions. Implement as a searchable `knowledge_articles` table with category tags, rich-text content, and a "share with patient" action that sends a link or PDF to the patient's portal

### 12.2 Food Quality Scoring
**Status:** Implemented with mock data (zentraler PRODIscore-Service in Lebensmittel-, Rezept- und Plan-Oberflächen).
- PRODIscore-equivalent food rating system
- 5-level scale evaluating nutritional quality
- Works for individual foods and complete recipes
- Visual indicator in food search and recipe creation

### 12.3 Sustainability
**Status:** Implemented with mock data (CO₂-Bilanzen für Lebensmittel, Wissen-Dashboard und Planbewertung vorhanden).
- CO2 footprint calculations for selected foods
- Environmental impact awareness in meal planning

---

## 13. Product Tiers (SaaS Model)

### Free / Trial
**Status:** Implemented with mock data (Gratis-Tier im Tarife-Dashboard inkl. Limits & Upgrade-Flow).
- Limited food database access
- Basic recipe creation (up to 10 recipes)
- Single user
- 14-day full feature trial

### Compact (Entry-Level)
**Status:** Implemented with mock data (Tarifkarte & Feature-Matrix unter /admin/tarife).
- ~50 nutrients per food
- Recipe and meal plan management
- Basic food database
- Single user

### Basis (Professional)
**Status:** Implemented with mock data (RBAC-ready Planverwaltung auf /admin/tarife).
- ~60 nutrients per food
- Patient management
- Digital client protocols
- Counseling documentation
- Multi-user support

### Expert (Premium)
**Status:** Implemented with mock data (Expert-Plan inklusive Billing-Historie & Add-ons).
- 80+ nutrients per food
- Diabetes counseling module
- Lab value tracking
- Medication management
- Statistical analysis
- Recipe-as-food conversion
- PROCAM score
- Full reporting suite

### Plus Database Add-on
**Status:** Implemented with mock data (Eigenes Add-on mit Preisen & Feature-Matrix auf /admin/tarife).
- Full BLS database (14,800 foods)
- Up to 330 nutrients per food
- SFK database access
- Additional manufacturer products

### Institution / Menu
**Status:** Implemented with mock data (Institutionstarif inkl. Küchen-Features & Demo-CTA).
- Weekly meal planning for facilities
- Kitchen production management
- Cost optimization
- Multi-diet support
- Nutritional compliance reporting

---

## 14. Prodi Criticism & Our Competitive Advantages

The original Prodi software has significant weaknesses that we can exploit. Below is a comprehensive analysis of known pain points, compiled from user reviews, academic studies, FAQ analysis, and competitor comparisons.

### 14.1 Platform Limitations (CRITICAL)
- **Windows-only** — no native macOS, Linux, or web support
- **Apple Silicon Macs explicitly unsupported** — locks out a growing segment of professionals
- Mac users must use Windows emulation (Parallels, VirtualBox) — clunky and unreliable
- **No cloud/web version** — purely desktop-installed software
- **No native mobile app** for practitioners or patients
- Only x86/x64 processors supported; ARM and Chromebooks excluded
- The "expert" version has a limited webapp for patient protocols, but it's not a full mobile solution

**Our advantage:** Cloud-native, cross-platform web app accessible from any device — desktop, tablet, mobile. No installation required.

### 14.2 Outdated UI/UX
- Interface design feels dated despite version 7 refresh — the fundamental desktop-centric paradigm is unchanged
- Software requires **paid training courses** to use effectively — not self-explanatory
- Cluttered nutrient display overwhelms users; hiding nutrients requires navigating complex settings
- Complex multi-source database architecture confuses users — food items sometimes don't appear in search results because the wrong data source is enabled
- Architecture dates back to the 1990s with incremental updates rather than modern rethinks

**Our advantage:** Modern, intuitive UI built with shadcn/ui and Tailwind CSS. Self-explanatory design that requires zero training. Clean, filterable nutrient displays.

### 14.3 Pricing & Transparency Issues
- Expert version costs **~2,374 EUR** upfront
- **Updates are not included** — each update costs additional money
- Update costs, multi-seat licenses, and add-on modules are all "auf Anfrage" (hidden pricing)
- Database extension (Plus) costs an additional ~321 EUR
- Menu module costs an additional ~1,845 EUR
- Impossible to budget transparently due to opaque pricing
- Competitors like Nutrium charge 21-42 EUR/month with all updates included

**Our advantage:** Transparent SaaS pricing with monthly/annual plans. All updates included. Clear feature comparison across tiers. Free trial without credit card.

### 14.4 Missing Modern Features
Features that modern competitors offer but Prodi lacks entirely:
- **No client-facing mobile app** (competitors like Nutrium, Natty Gains offer branded client apps)
- **No telehealth/video consultation** integration
- **No appointment scheduling** built in
- **No billing/invoicing** capabilities
- **No API** for third-party integrations
- **No real-time collaboration** — files lock when opened by one user
- **No cloud sync** — data lives only on the local machine/network
- **No direct messaging** between practitioner and client
- **No automated meal plan generation** with AI
- **No marketing/client acquisition tools**

**Our advantage:** Built-in scheduling, billing, client portal, real-time collaboration, messaging, and AI-assisted meal planning from day one.

### 14.5 Collaboration & Multi-User Problems
- Recipes **lock when opened on one computer** — cannot be edited simultaneously by another user
- No real-time collaboration features
- No shared cloud workspace
- Multi-seat pricing is hidden ("auf Anfrage")
- Network installation requires complex setup and documentation

**Our advantage:** Real-time collaborative editing (like Google Docs). Shared workspaces for team practices. Simple user management with transparent per-seat pricing.

### 14.6 Database Accuracy Gaps
- Academic study (PMC4820173) found **no data for total sugar** in Prodi — a significant gap
- Of 46 nutritional parameters analyzed, only 12 showed high correlation (>0.800) with comparison tools
- **5 nutrients showed no statistical correlation at all**: arachidonic acid, niacin, alpha-linolenic acid, fluoride, and total sugars
- Missing compositional data for many branded food items
- Compact version contains only ~3,452 foods vs. competitors with 1.5M+ products
- Database is fundamentally Germany-centric — less suitable for international or multicultural dietary counseling

**Our advantage:** Complete nutrient coverage with no gaps. Open food database integrations (OpenFoodFacts for 3M+ products). International database support for multicultural counseling.

### 14.7 Technical Issues & Bugs
The official Prodi FAQ reveals recurring technical problems:
- License/authentication prompts at every startup — requires running as administrator
- Access violation errors linked to Windows DEP settings
- Network initialization errors due to permission issues
- McAfee antivirus false positives on support tools
- Default supervisor password is empty or "masterkey" — **security concern**
- No automatic error recovery or self-healing

**Our advantage:** Cloud-hosted — no installation issues, no antivirus conflicts, no permission problems. Modern authentication with SSO support. Zero maintenance for users.

### 14.8 Integration & Data Export Limitations
- **No documented API** for third-party integrations
- Export limited to PDF and internal formats
- No CSV, Excel, or structured data export documented
- Only external integration is with DEBInet for importing dietary protocols
- No integration with practice management software, EHR, or billing systems
- **No interoperability standards** (HL7, FHIR) mentioned

**Our advantage:** REST API from day one. Export to CSV, Excel, PDF, JSON. Future integrations with EHR systems via FHIR. Webhook support for automation.

### 14.9 Zero Public Social Proof
- **Zero reviews** on Capterra, GetApp, G2, Trustpilot, Goodfirms, and all other major platforms
- No public community forum for peer-to-peer support
- No visible knowledge base beyond a basic FAQ page
- Market dominance appears driven by **legacy lock-in and educational adoption** rather than product excellence

**Our advantage:** Built-in feedback system. Public roadmap. Active community. Transparent development process. Modern documentation and help center.

### 14.10 Summary: Key Differentiators for Our Product

| Pain Point | Prodi (Status Quo) | Our Solution |
|---|---|---|
| Platform | Windows-only desktop | Cloud web app (any device, any OS) |
| Mobile | No mobile support | Responsive PWA + native-like experience |
| UI/UX | Outdated, requires training | Modern, intuitive, zero training needed |
| Pricing | 2,374 EUR + hidden update costs | Transparent SaaS (monthly/annual) |
| Collaboration | File locking, no real-time | Real-time collaboration, shared workspaces |
| Client engagement | No client app or messaging | Client portal, food diary, messaging |
| Scheduling | Not available | Built-in calendar and appointments |
| Billing | Not available | Integrated invoicing and payments |
| API | None | Full REST API, webhooks, integrations |
| Database | Germany-centric, gaps in data | International databases, OpenFoodFacts |
| AI | None | AI-assisted meal plans and analysis |
| Updates | Paid, infrequent | Continuous deployment, always up-to-date |
| Support | Basic FAQ, paid training | Help center, community, in-app guidance |

---

## 15. Prioritization (MVP vs. Future)

> **Note:** Phases should be informed by section 14 — every phase should include features that directly address Prodi's weaknesses and give us a competitive edge.

### MVP (Phase 1) - Core Platform
1. Food & nutrient database with search (incl. phonetic/fuzzy search, multiple search modes)
2. Recipe creation and nutritional analysis (incl. structured rows, preparation instructions, water loss)
3. Daily meal planning
4. User authentication and basic profiles
5. Basic reporting (nutrient tables, charts)
6. Responsive web UI
7. Pre-built recipe & plan library (seed content)

### Phase 2 - Professional Features
1. Patient/client management (incl. ICD codes, birthday list, eGK card reader)
2. Dietary protocols and assessment (incl. Freiburger protocol, vegan/vegetarian templates, guided entry)
3. Digital client protocol (remote entry)
4. Counseling session documentation (incl. 40+ pre-written counseling texts)
5. Weight analysis and BMI tracking (incl. percentile curves for children, target weight projection, amputation correction)
6. Reference value comparisons
7. Exchange tables
8. Serial letter / mail merge
9. Recipe-level shopping lists

### Phase 3 - Expert Features
1. Lab value tracking
2. Diabetes management module
3. Medication management
4. Allergen/intolerance management
5. Therapeutic diet configurations
6. Advanced statistics
7. PROCAM score and medical calculations (incl. creatinine clearance, MNA, SGA)
8. Custom nutrient quotients & ratios
9. Quality report generation (Qualitätsbericht)
10. Global search & replace foods

### Phase 4 - Institutional Features
1. Multi-week meal planning
2. Kitchen production management
3. Shopping list generation
4. Cost management
5. Hospital/clinic workflow features (incl. patient self-service menu selection, tray cards, HIS integration)
6. Institutional statistics
7. HL7 message import

### Phase 5 - Ecosystem
1. SaaS billing and tier management
2. API for third-party integrations
3. Mobile PWA optimization
4. Knowledge base and lexicons (incl. consumer Q&A Infothek)
5. Community recipe sharing (incl. professional recipe exchange platform)
6. Sustainability/CO2 features
7. Multilingual UI (German + English first, then French + Italian)
8. USDA and Australian database integration
9. Meal-Master recipe import
10. Food synonym management
11. Multilingual food names
