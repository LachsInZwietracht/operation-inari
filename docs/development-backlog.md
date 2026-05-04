# Development Backlog

Last updated: 2026-04-29

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

1. Done: Fix mobile/tablet overflow across `/dashboard`, `/lebensmittel`, `/patienten`, `/berichte`, and `/institution/*`.
2. Done: Make `PageHeader`, app header, global search, and `PwaStatus` responsive.
3. Done: Add visual regression checks for 390 px, 768 px, and desktop widths.
4. Done: Fix the `/patienten` hydration mismatch around eGK event rendering.
5. Done: Harden `/api-export` and `/datenbank` error states so missing schema/API failures show clear inline recovery messages.
6. Port Cologne phonetics into Postgres search so German fuzzy matching works server-side.
7. Continue paginated and on-demand food loading where full-catalog hooks remain.
8. Done: `/admin/users` now supports audited invitations plus role/status changes with Owner lockout checks.
9. Done: Add access-event audit logs for sensitive patient, report, export, and institution actions.
10. Improve institution workflow hierarchy with sticky service/station/status controls and clearer unsafe-order handling.
11. Add production batch states for institution kitchen workflows.

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
- [ ] Add SSO foundation: organization-level OIDC/SAML configuration, login routing, and provider metadata storage.
- [ ] Define LDAP/Active Directory mapping requirements for clinic deployments.
- [x] Implement API key issuance for the currently preview-only API surfaces.
- [ ] Persist webhook endpoints, delivery attempts, and failures for integration workflows.
- [ ] Define HL7 v2 import MVP: parse `PID`, `OBX`, and basic patient/lab mapping into existing patient/lab tables.
- [ ] Define the first FHIR sync boundary after HL7 import is stable.

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
