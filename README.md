# Operation Prodi

Operation Prodi is a modern, high-performance German nutrition counseling and therapy management platform. It is designed to replace outdated desktop software with a secure, cloud-native solution for clinics, practices, and pharmacies.

## 🚀 Key Features

- **Enterprise-Grade Performance:** Next.js 15 Server-Side Streaming with edge caching (Vercel Data Cache) for instant-feel navigation.
- **Scientific Integrity:** Full BLS 4.0 (Bundeslebensmittelschlüssel) integration with calculations mathematically validated against official DGE/Hohenheim standards.
- **Full SaaS Persistence:** Secure Supabase backend for patients, recipes, protocols, meal plans, and the core patient clinical record with automatic cloud sync and local fallback.
- **Smart Food Search:** Hybrid search engine combining local fuzzy matching with server-side trigram search across 7,000+ items.
- **AI-Assisted Entry:** NLP-assisted food entry ("Smart-Eingabe") for rapid dietary assessment and protocol management.
- **Professional Tools:** Pediatric percentile charts, PROCAM screening, plan PDF/CSV exports, and patient document mail-merge PDFs.

## 🛠 Tech Stack

- **Framework:** Next.js 15 (App Router, Streaming, Server Actions)
- **Styling:** Tailwind CSS 4, shadcn/ui
- **Database:** Supabase (PostgreSQL with Trigram Search & RLS)
- **State Management:** React Context + Type-safe CRUD Hooks
- **Testing:** Playwright (E2E), Custom Mathematical Validation Suite
- **Data Source:** BLS 4.0 (Bundeslebensmittelschlüssel)
- **Document Rendering:** `@react-pdf/renderer` for server-side PDF generation

## 📖 Documentation

For detailed technical implementation guides, architectural overview, and feature references, see:
- [Documentation Index](./docs/README.md)
- [Feature Implementation Guide](./documentation.md)
- [Database & ETL Guide](./docs/database-guide.md)
- [Competitive Audit](./docs/competitive-audit.md)

Current product surfaces include:
- Patient workflow hub for intake, assessment, meal planning, counseling, statistics, and follow-up.
- BLS-backed food browsing with source visibility, nutrient sort/filter, custom foods, Open Food Facts promotion, and SFK import support.
- Recipes, meal plans, templates, shopping lists, nutrient analysis, and approval/version workflows.
- Digital protocol intake with practitioner review and conversion into internal nutrition protocols.
- Institution menu planning, inpatient meal orders, kitchen production, compliance analytics, and tray cards.
- Admin/RBAC, SSO foundations, API keys, webhooks, export jobs, and billing-preview surfaces.

## 🛠 Development

### Setup
1. Clone the repository.
2. Install dependencies: `npm install`
3. Connect Supabase: `npx supabase link --project-ref your-id`
4. Apply migrations: `npx supabase db push`
5. Run the app: `npm run dev`

### Auth & RBAC
Route protection is enabled by default whenever Supabase is configured. For temporary local UI work only, set `NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING=true`.

Production and staging must leave that flag unset. Admin routes require an `owner` or `admin` membership, institution routes require `owner`, `admin`, or `institution_admin`, and patient data remains scoped by the existing per-user Supabase RLS policies.

### Data Import
To populate the food database (7,140 items):
```bash
npm run etl:bls
```

To stage and promote Open Food Facts products:
```bash
npm run etl:off
```

`scripts/etl/import-off.ts` supports three input modes via env vars:
- `OFF_SOURCE_FILE` for a local JSON file
- `OFF_SOURCE_URL` for a remote JSON payload
- no OFF source env vars to fetch a live sample from Open Food Facts

Apply the latest migrations before using the paginated foods browser or OFF search:
```bash
npx supabase db push
```

Reference standards and custom profile persistence also require the latest migrations plus:
```bash
npm run etl:reference-values
```

### Validation
To verify mathematical integrity:
```bash
npm run validate:nutrients
```

### Export System
- Apply the latest migrations before testing exports: `npx supabase db push`
- `export_jobs` remains the generic export audit log.
- `/api/exports/report` generates plan PDF/CSV files and logs export metadata; patient-bound report persistence was removed with the standalone Berichte feature.

### Hospital Meal Workflow
- Apply the latest migrations before using the inpatient stay and meal-order workflow: `npx supabase db push`
- The hospital module persists inpatient stays in `inpatient_stays` and service selections in `meal_orders`.
- Tray cards are rendered via the in-app print route at `/institution/krankenhaus/tablettenkarten`.
