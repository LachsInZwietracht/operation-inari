# Operation Prodi

Operation Prodi is a modern, high-performance German nutrition counseling and therapy management platform. It is designed to replace outdated desktop software with a secure, cloud-native solution for clinics, practices, and pharmacies.

## 🚀 Key Features

- **Enterprise-Grade Performance:** Next.js 15 Server-Side Streaming with edge caching (Vercel Data Cache) for instant-feel navigation.
- **Scientific Integrity:** Full BLS 4.0 (Bundeslebensmittelschlüssel) integration with calculations mathematically validated against official DGE/Hohenheim standards.
- **Full SaaS Persistence:** Secure Supabase backend for patients, recipes, protocols, and meal plans with automatic cloud sync and local fallback.
- **Smart Food Search:** Hybrid search engine combining local fuzzy matching with server-side trigram search across 7,000+ items.
- **AI-Assisted Entry:** NLP-assisted food entry ("Smart-Eingabe") for rapid dietary assessment and protocol management.
- **Professional Tools:** Pediatric percentile charts, PROCAM screening, mail merge, and eGK insurance card reader integration.

## 🛠 Tech Stack

- **Framework:** Next.js 15 (App Router, Streaming, Server Actions)
- **Styling:** Tailwind CSS 4, shadcn/ui
- **Database:** Supabase (PostgreSQL with Trigram Search & RLS)
- **State Management:** React Context + Type-safe CRUD Hooks
- **Testing:** Playwright (E2E), Custom Mathematical Validation Suite
- **Data Source:** BLS 4.0 (Bundeslebensmittelschlüssel)

## 📖 Documentation

For detailed technical implementation guides, architectural overview, and feature references, see:
- [Feature Implementation Guide](./documentation.md)
- [Database & ETL Guide](./docs/database-guide.md)
- [Product Requirements](./docs/product-requirements.md)

## 🛠 Development

### Setup
1. Clone the repository.
2. Install dependencies: `npm install`
3. Connect Supabase: `npx supabase link --project-ref your-id`
4. Apply migrations: `npx supabase db push`
5. Run the app: `npm run dev`

### Data Import
To populate the food database (7,140 items):
```bash
npm run etl:bls
```

### Validation
To verify mathematical integrity:
```bash
npm run validate:nutrients
```
