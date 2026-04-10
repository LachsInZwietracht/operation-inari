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
- Ability to add and manage custom food entries with:
  - Nutrient values
  - Portion sizes
  - Allergens
  - Additives

### 1.3 Reference Values
**Status:** Partially implemented (DGE references available; other regional standards and custom profiles still missing).
- DGE (Deutsche Gesellschaft fuer Ernaehrung) reference values
- OeGE (Austrian) reference values
- SGE (Swiss) reference values
- RDA values
- Custom/user-defined intake recommendations
- Reference values adjustable by age, gender, pregnancy, lactation

### 1.4 Database Management
**Status:** Partially implemented (mock version history, source filter, comparison tool live; no real update pipeline yet).
- Database versioning and update mechanism
- Data origin filter (show/hide food sources)
- Search and filter across all databases
- Food comparison tool (side-by-side, adjustable portions)

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

---

## 3. Meal Planning

### 3.1 Daily Meal Plans
**Status:** Implemented with mock data (day view now features drag & drop from recipe library, diet-line presets, exchange-list substitutions, and compliance indicators against reference targets).
- Create daily meal plans (Tagesplaene)
- Assign meals to time slots (breakfast, snack, lunch, snack, dinner)
- Automatic nutritional calculation for entire day
- Comparison with reference values

### 3.2 Menu Plans
**Status:** Partially implemented (week and 4-week cycle planners with teaching-kitchen preview and multi-day nutrient summaries in place; institutional production/shopping flows still pending).
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
**Status:** Implemented with mock data (demographics plus diagnoses, medications, insurance, and wizard-driven history tools are accessible in patient tabs).
- Create and manage patient profiles
- Demographic data (name, DOB, gender, contact)
- Medical history
- Diagnosis documentation
- Insurance information
- Search, filter, and sort patient database

### 5.2 Anthropometric Data & Weight Analysis
**Status:** Implemented with mock data (charts, PAL/BMR calculator, and activity log complete; predictive analytics still future work).
- BMI calculation and tracking
- Weight progression charts
- PAL (Physical Activity Level) calculation
- Energy requirement calculations (WHO basal metabolic rate formula)
- Activity tracking with sport types
- Anthropometric measurements over time

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
**Status:** Implemented with mock data (MUST/NRS-2002 widgets and PROCAM calculator/storefront wired up; additional calculators can extend this foundation).
- PROCAM cardiovascular risk score
- Lipid ratio calculations
- BMI classification
- Energy requirement formulas
- Malnutrition screening/assessment tools

---

## 6. Nutrition Therapy & Specialized Diets

### 6.1 Diabetes Management
**Status:** Partially implemented (therapy cards with BE targets, glucose ranges, and status toggles now editable; glucose-specific charts still pending).
- Blood glucose value tracking and management
- Action assignments for glucose values
- BE (Broteinheiten) and KE (Kohlenhydrateinheiten) calculations
- Tabular and graphical diabetes analysis
- Diabetes-specific meal planning

### 6.2 Ketogenic Diet
**Status:** Partially implemented (ketogenic module surfaced with ratio/target controls; dedicated meal plans forthcoming).
- Ketogenic ratio calculations
- Specialized parameter settings
- Ketogenic meal plan creation

### 6.3 Allergen & Intolerance Management
**Status:** Partially implemented (patient therapy tab now shows allergen/intolerance targets; automated warnings still future work).
- Pre-configured allergen database (EU allergens)
- Customizable allergen tracking per patient
- Additive management
- LMIV-compliant allergen declarations
- Allergen warnings in recipe/meal plan creation

### 6.4 Therapeutic Diets
**Status:** Partially implemented (diet-line presets power meal plan compliance plus therapy toggles; broader catalog and automation pending).
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
- Counseling text templates library
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

### 11.2 Architecture
**Status:** Partially implemented (Next.js foundation in place; Supabase/backend pieces not connected).
- Next.js App Router
- Supabase backend (PostgreSQL, Auth, Storage, Realtime)
- Server-side rendering for performance
- API-first design for future integrations

### 11.3 Integrations
**Status:** Implemented with mock data (full /api-export page with four tabs: CSV/JSON/PDF export & import, REST API key management with reveal/copy/revoke plus endpoint explorer with sample responses, integration toggles for EHR/FHIR/pharmacy/DEBInet with webhook configuration, and filterable export/import history log; real backend connectivity still outstanding).
- Data import/export (CSV, JSON, PDF)
- API for third-party integrations
- Potential future: electronic health record (EHR) integration
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
1. Food & nutrient database with search
2. Recipe creation and nutritional analysis
3. Daily meal planning
4. User authentication and basic profiles
5. Basic reporting (nutrient tables, charts)
6. Responsive web UI

### Phase 2 - Professional Features
1. Patient/client management
2. Dietary protocols and assessment
3. Digital client protocol (remote entry)
4. Counseling session documentation
5. Weight analysis and BMI tracking
6. Reference value comparisons
7. Exchange tables

### Phase 3 - Expert Features
1. Lab value tracking
2. Diabetes management module
3. Medication management
4. Allergen/intolerance management
5. Therapeutic diet configurations
6. Advanced statistics
7. PROCAM score and medical calculations

### Phase 4 - Institutional Features
1. Multi-week meal planning
2. Kitchen production management
3. Shopping list generation
4. Cost management
5. Hospital/clinic workflow features
6. Institutional statistics

### Phase 5 - Ecosystem
1. SaaS billing and tier management
2. API for third-party integrations
3. Mobile PWA optimization
4. Knowledge base and lexicons
5. Community recipe sharing
6. Sustainability/CO2 features
