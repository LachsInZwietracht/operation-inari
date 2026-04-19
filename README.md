# Operation Prodi

Operation Prodi is a modern, high-performance German nutrition counseling and therapy management platform. It is designed to replace outdated desktop software with a secure, cloud-native solution for clinics, practices, and pharmacies.

## 🚀 Key Features

- **Enterprise-Grade Performance:** Next.js 15 Server-Side Streaming with edge caching (Vercel Data Cache) for instant-feel navigation.
- **Scientific Integrity:** Full BLS 4.0 (Bundeslebensmittelschlüssel) integration with calculations mathematically validated against official DGE/Hohenheim standards.
- **Full SaaS Persistence:** Secure Supabase backend for patients, recipes, protocols, meal plans, and the core patient clinical record with automatic cloud sync and local fallback.
- **Smart Food Search:** Hybrid search engine combining local fuzzy matching with server-side trigram search across 7,000+ items.
- **AI-Assisted Entry:** NLP-assisted food entry ("Smart-Eingabe") for rapid dietary assessment and protocol management.
- **Professional Tools:** Pediatric percentile charts, PROCAM screening, real PDF/CSV exports for reports and patient documents, and eGK insurance card reader integration.

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
- [Feature Implementation Guide](./documentation.md)
- [Database & ETL Guide](./docs/database-guide.md)
- [Product Requirements](./docs/product-requirements.md)

Recent platform changes:
- Reports (`/berichte`) now generate real server-side PDF and CSV exports.
- Patient mail merge on `/patienten` now produces branded PDF bundles instead of placeholder text downloads.
- `API & Export` now creates real export jobs and reads persisted history from Supabase.
- The full patient workspace on `/patienten/[id]` now persists to Supabase, including anthropometrics, diagnoses, medications, screenings, lab values, activities, therapy settings/integrations, PROCAM results, and digital protocol links.
- `/lebensmittel` now uses a paginated server-backed browser API instead of hydrating the full catalog into the client.
- Open Food Facts is now a first-class food source with validated product promotion, attribution, and detail-page quality indicators.

## 🛠 Development

### Setup
1. Clone the repository.
2. Install dependencies: `npm install`
3. Connect Supabase: `npx supabase link --project-ref your-id`
4. Apply migrations: `npx supabase db push`
5. Run the app: `npm run dev`

### Temporary Auth Note
Route protection is currently disabled for local testing via `DISABLE_AUTH_FOR_TESTING = true` in `middleware.ts`.
Before staging or production work, set that flag back to `false` so login is enforced again.

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

### Validation
To verify mathematical integrity:
```bash
npm run validate:nutrients
```

### Export System
- Apply the latest migrations before testing exports: `npx supabase db push`
- Export metadata is persisted in `export_jobs`; binary files are generated on demand and are not stored in Supabase.
