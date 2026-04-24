# Inari — Roadmap & Possible Tasks

Last updated: 2026-04-24

## Active Task Status

1. **Production Auth Gate + RBAC Foundation** — In progress / implementation added.
   - Auth bypass moved to `NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING=true`; production/staging default is protected when Supabase is configured.
   - Persisted RBAC foundation added with organizations, memberships, roles, and audit-log table.
   - `/admin/*`, `/institution/*`, protected app pages, and export APIs now have explicit auth/RBAC gates.
   - `/admin/users` now reads real membership data instead of only showing a read-only preview.
   - Deferred: full invitation flow, role mutation UI, and team-wide patient sharing.

## Feature Completion & Polish

1. **eGK Health Card Integration** — Scanner is partially mocked/demo mode. Build out real serial/companion app connectivity for production use.
2. **Food Database ETL** — Import pipeline for BLS 4.0, OpenFoodFacts, USDA etc. is scaffolded but needs actual data loading and validation runs.
3. **Institution Analytics & Compliance** — Pages are structural templates. Flesh out real charts, KPIs, and compliance rule engines.
4. **Therapy Integration Expansion** — PROCAM risk assessment exists, but other therapy tools (diabetes management, renal nutrition, etc.) could be added.
5. **Offline/PWA Support** — PWA status component exists with localStorage fallback, but full offline sync (service worker, background sync) could be hardened.

## User Experience

6. **Onboarding Flow** — ✅ Done. Dialog-based wizard on dashboard: practice info, optional first patient, quick tips. Hooks: `use-onboarding`, `use-practice-info`.
7. **Notifications & Reminders** — Push notifications, email reminders for appointments, protocol follow-ups.
8. **Patient Portal / Self-Service** — Full patient-facing portal for submitting protocols, viewing meal plans, and messaging.
9. **Multi-language Support (i18n)** — Currently German-only. Adding English/other languages would expand reach.

## Technical & Infrastructure

10. **Authentication & Role-Based Access** — Foundation implemented; next steps are invitations, role-change workflows, audit event coverage, and team/practice sharing.
11. **Deployment & CI/CD** — Production deployment pipeline, staging environment, automated test runs on PR.
12. **Performance Optimization** — Run existing benchmarks, optimize large food DB queries, add server-side caching.
13. **API Documentation** — OpenAPI docs for the `/api-export` routes and third-party integrations.

## Business & Growth

14. **Billing / Subscription (Polar.sh)** — Polar.sh is a dependency but payment flows may not be fully wired up.
15. **PDF Report Templates** — ✅ Done. Added 5 report templates (insurance, discharge, initial assessment, progress, pediatric) and 3 mail merge templates (welcome, protocol reminder, therapy completion).
16. **Data Export Compliance** — GDPR data export/deletion workflows for patient data.
