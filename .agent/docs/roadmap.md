# Inari — Roadmap & Possible Tasks

Last updated: 2026-04-24

## Feature Completion & Polish

1. **eGK Health Card Integration** — Scanner is partially mocked/demo mode. Build out real serial/companion app connectivity for production use.
2. **Food Database ETL** — Import pipeline for BLS 4.0, OpenFoodFacts, USDA etc. is scaffolded but needs actual data loading and validation runs.
3. **Institution Analytics & Compliance** — Pages are structural templates. Flesh out real charts, KPIs, and compliance rule engines.
4. **Therapy Integration Expansion** — PROCAM risk assessment exists, but other therapy tools (diabetes management, renal nutrition, etc.) could be added.
5. **Offline/PWA Support** — PWA status component exists with localStorage fallback, but full offline sync (service worker, background sync) could be hardened.

## User Experience

6. **Onboarding Flow** — Guided setup for new users (practice info, first patient, food DB selection).
7. **Notifications & Reminders** — Push notifications, email reminders for appointments, protocol follow-ups.
8. **Patient Portal / Self-Service** — Full patient-facing portal for submitting protocols, viewing meal plans, and messaging.
9. **Multi-language Support (i18n)** — Currently German-only. Adding English/other languages would expand reach.

## Technical & Infrastructure

10. **Authentication & Role-Based Access** — Flesh out admin panel, roles (dietitian vs. assistant vs. institution admin), team/practice sharing.
11. **Deployment & CI/CD** — Production deployment pipeline, staging environment, automated test runs on PR.
12. **Performance Optimization** — Run existing benchmarks, optimize large food DB queries, add server-side caching.
13. **API Documentation** — OpenAPI docs for the `/api-export` routes and third-party integrations.

## Business & Growth

14. **Billing / Subscription (Polar.sh)** — Polar.sh is a dependency but payment flows may not be fully wired up.
15. **PDF Report Templates** — Expand templates for insurance submissions, hospital discharge summaries.
16. **Data Export Compliance** — GDPR data export/deletion workflows for patient data.
