# Development Backlog

Last updated: 2026-05-05

Purpose:
- Track currently open development tasks for the next engineer or agent.
- Keep this list grounded in current code, migrations, tests, `documentation.md`, `docs/database-guide.md`, `docs/product-requirements.md`, `docs/competitive-audit.md`, and `docs/design-audit-2026-04-27.md`.
- Treat this as an execution backlog, not as proof that a feature is missing. Before starting work, verify the current implementation and update this file when the task is completed, split, or superseded.

Priority guide:
- P0: Demo and clinical workflow reliability.
- P1: Clinic sales readiness and core differentiation.
- P2: Workflow depth, usability, and operational maturity.
- P3: Ecosystem expansion.

## Recommended Next Sprint

Start here unless product priorities have changed:

1. Add SSO group/claim-to-role mapping on top of the existing organization SSO configuration foundation.
2. Decide whether institution production batch states should persist as a kitchen execution ledger before positioning them as production operations history.
3. Add an HL7 import review/admin surface for `hl7_import_jobs`, `hl7_import_results`, and lab parameter mappings.

Recently completed sprint work:
- Mobile/tablet overflow fixes across `/dashboard`, `/lebensmittel`, `/patienten`, `/berichte`, and `/institution/*`.
- Responsive `PageHeader`, app header, global search, and `PwaStatus`.
- Visual regression checks for 390 px, 768 px, and desktop widths.
- `/patienten` eGK hydration mismatch fix.
- Inline recovery states for `/api-export` and `/datenbank`.
- Server-side Cologne phonetics, paginated/on-demand food loading, RBAC invitations/role edits, access-event audit logs, institution workflow hierarchy, and production batch states.
- Digital protocol public submission now has persisted happy-path coverage through authenticated conversion and audit rows.
- Patient report export/archive coverage already verifies immutable versions, storage download, missing-file warnings, export journal behavior, and audit rows.
- `npm run seed:clinic-demo` now creates a refreshable Supabase demo workspace for the full patient intake -> protocol -> counseling/report -> inpatient stay -> safe order -> tray card path.
- `tests/fixtures/clinic-demo.ts` now centralizes Supabase admin setup, demo patient creation, digital protocol links, report plan/archive cleanup, institution menus/stays/orders, and audit lookup for digital, report, and institution specs.
- Digital protocol coverage now drives the practitioner Smart-Match review sheet into the protocol form, saves the internal nutrition protocol, verifies converted submission state, and checks the conversion audit row.
- HL7 v2 import MVP now has persisted job/result tables, PID patient matching, numeric OBX lab import, review states, idempotency by `MSH-10`, API-key scope `integrations:hl7:write`, audit events, and Playwright coverage.

## P0: Stabilize Clinic Demo Quality

- [x] Fix mobile/tablet document overflow across core routes: `/dashboard`, `/lebensmittel`, `/patienten`, `/berichte`, `/institution/*`.
- [x] Make `components/page-header.tsx` responsive: stack actions on mobile, allow wrapping, and prevent action rows from widening the page.
- [x] Make the app shell header responsive in `app/(app)/layout.tsx`: ensure global search can shrink and `PwaStatus` does not force overflow.
- [x] Collapse or hide `PwaStatus` text on mobile; keep status accessible through icon, tooltip, menu, or sheet detail.
- [x] Contain wide tables and data grids inside local horizontal scroll regions that do not widen the whole document.
- [x] Add visual regression checks for 390 px, 768 px, and desktop widths to prevent layout regressions.
- [x] Fix the `/patienten` hydration mismatch around eGK event rendering by making the initial render stable between server and client.
- [x] Add explicit inline failure states for `/api-export` export history errors.
- [x] Add explicit inline failure states for `/datenbank` lifecycle/replacement schema or fetch errors.

## P1: Strengthen Food And Scientific Credibility

- [x] Port Cologne phonetics into Postgres search so German sound matching works server-side, not only through the client fallback.
- [x] Keep `search_foods_with_total()` rollout documented and ensure environments without the migration degrade clearly.
- [x] Continue replacing all-catalog hook patterns with paginated or server-backed reads where route behavior allows it.
- [x] Fetch full nutrient and portion payloads lazily only when the selected workflow needs full detail.
- [x] Add nutrient/source diff UI for database updates.
- [x] Expand database lifecycle events so ETL jobs write real release/import history to `data_source_events`.
- [x] Add broader database version migration tooling beyond the current v1 user-workspace food replacement flow.
- [x] Remove `lib/legacy-food-map.ts` after old `food_*` references have been fully migrated.
- [x] Prepare the SFK rollout path: license check, import verification, source/version display, and deterministic test fixtures.

## P1: Clinic IT Readiness

- [x] Implement real invitation flows in `/admin/users`.
- [x] Implement role-change flows in `/admin/users` with RBAC checks.
- [x] Add role-change audit logs.
- [x] Add access-event audit logs for sensitive patient, report, export, and institution actions.
- [x] Add SSO foundation: organization-level OIDC/SAML configuration, login routing, and provider metadata storage.
- [x] Define LDAP/Active Directory mapping requirements for clinic deployments.
- [x] Implement API key issuance for the currently preview-only API surfaces.
- [x] Persist webhook endpoints, delivery attempts, and failures for integration workflows.
- [x] Define HL7 v2 import MVP for `PID`, `OBX`, and basic patient/lab mapping into existing patient/lab tables.
- [x] Implement HL7 v2 import MVP with job/result persistence, review states, idempotency, patient/lab mutations, and audit events.
- [ ] Add an HL7 import review/admin surface for reviewed jobs, reviewed results, and lab mapping maintenance.
- [x] Define the first FHIR sync boundary after HL7 import is stable.
- [ ] Implement SSO group/claim-to-role mappings for verified SSO principals.

## P1: Patient-To-Kitchen Workflow

- [x] Improve institution workflow hierarchy with a compact sticky operations bar for service window, station, and status.
- [x] Promote unsafe orders, missing diet forms, allergen conflicts, and pending kitchen actions above general institution counts.
- [x] Add production batch states: planned, in preparation, ready, served, and held.
- [x] Expand tray-card generation with diet form, allergens, room/bed, notes, and kitchen status.
- [x] Add diet-order override logging for allergen and diet-form conflicts.
- [x] Derive institution analytics from persisted menu cycles, meal orders, inpatient stays, and restriction snapshots.
- [x] Add clearer kitchen readiness and tray-card readiness indicators.

## P2: Clinical Documentation

- [x] Build clinic document packs for Ernährungsbericht, Arztbrief, Übergabe Küche, Verlaufsbericht, and Qualitätsbericht.
- [x] Add patient handout templates tied to counseling sessions and meal plans.
- [x] Add LMIV/allergen declaration output to recipe and menu PDFs.
- [x] Add report retention policy fields and admin controls.
- [x] Improve archived report search and filtering inside patient records.
- [x] Add scheduled export requirements after the report-retention model is clear.
- [x] Add patient report export/archive Playwright coverage for immutable versions, storage download, export journal, and audit logs.

## P2: UX Rework For Core Workflows

- [x] Redesign `/lebensmittel` mobile results as cards with source, category, kcal, protein/fat/KH, and PRODIscore.
- [x] Move secondary food-list actions, such as alias management, into row menus or detail drawers on mobile.
- [x] Reorder `/patienten` so patient search/list and intake actions come before demo and mail-merge tooling.
- [x] Move the eGK demo into a dedicated intake panel, drawer, or route.
- [x] Move mail merge into a dedicated `Serienbriefe` route or a secondary workflow.
- [x] Add dashboard setup/onboarding actions when workspaces are empty.
- [x] Add clinical design tokens for nutrient gaps, source trust, allergen risk, order safety, and report status.
- [x] Create dense worklist patterns for institution and patient workflows.
- [x] Standardize German clinical terminology across labels, including `Eiweiß`, `Kohlenhydrate`/`KH`, and patient wording.
- [x] Add persisted digital-protocol happy-path coverage for public submission, conversion API, audit rows, and converted-state tracking.
- [x] Consolidate report, institution, and digital-protocol test setup around `tests/fixtures/clinic-demo.ts`.
- [x] Extend digital-protocol happy-path coverage through the practitioner Smart-Match review sheet and protocol form.
- [x] Add a seeded full clinic demo fixture or script for the patient-to-kitchen runbook via `scripts/seed-clinic-demo.ts` and `npm run seed:clinic-demo`.

## P2: Commercial Readiness

- [x] Replace `/admin/tarife` preview with a real clinic contract/subscription model, or keep the route explicitly read-only until implemented.
- [x] Add procurement-ready security documentation in-app or as exportable docs.
- [x] Build migration onboarding for PRODI/EBIS-style exports: recipes, patients, protocols, and meal plans.
- [x] Add guided demo workspace setup with realistic but clearly labeled demo data.
- [x] Create a clinic buyer readiness checklist covering data sources, audit logs, SSO, exports, retention, support contacts, and deployment assumptions.

## P3: Product Expansion

- [ ] Build professional recipe exchange: publish, review, clone, organization scopes, and shared-library scopes.
- [ ] Persist user food synonyms fully in Supabase instead of local overlay only.
- [ ] Add patient portal/PWA capabilities for report delivery, reminders, meal-plan feedback, and secure messages.
- [ ] Add clinical manufacturer feeds beyond Open Food Facts, such as Nutricia, Fresenius Kabi, and Abbott.
- [ ] Add multilingual food names through `food_translations` and UI language selection.
- [ ] Add direct support for additional official food databases after SFK rollout is stable.

## Completion Rules

When completing a task:
- Update this backlog in the same change.
- Link to the relevant route, component, hook, migration, or test where possible.
- If the task changes implemented behavior, update `documentation.md`.
- If the task changes schema, ETL, food data, or search behavior, update `docs/database-guide.md`.
- If the task changes product direction or roadmap truth, update `docs/product-requirements.md`.
