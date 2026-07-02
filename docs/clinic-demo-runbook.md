# Clinic Demo Runbook

Last updated: 2026-05-04

Purpose:
- Provide one repeatable clinic-first demo path for German hospital buyers.
- Keep the story grounded in implemented routes, persistence, exports, audit logs, and tests.
- Make demo gaps explicit so the next sprint improves credibility instead of adding disconnected surface area.

Source-of-truth rule:
- Code, migrations, and tests win over this runbook.
- Use `documentation.md` for route/component details and `docs/database-guide.md` for schema, ETL, search, export, and audit details.
- Use `docs/clinic-it-integration-plan.md` for LDAP/AD and FHIR contracts.

## Demo Goal

Show Operation Prodi as a cloud-native German clinical nutrition workflow:

1. A patient enters nutrition data remotely.
2. The dietitian reviews and converts it into an internal protocol.
3. The clinical workspace turns assessment data into counseling and meal-plan outputs.
4. A plan export is generated and audit-visible through export metadata.
5. The same patient can be assigned to an inpatient meal workflow.
6. Kitchen orders, allergen conflicts, overrides, production status, and tray cards are traceable.

This is intentionally not a generic tour. It should prove the buyer-facing promise: scientific nutrition counseling connected to hospital food operations without pretending to be a full kitchen ERP.

## Primary Demo Path

### 1. Buyer Setup And System Trust

Start with:
- `/datenbank` for the live data-source catalog (with per-organization activate/deactivate) and nutrient diffing.
- `/admin/users` for RBAC roles, invitations, SSO configuration, and report-retention policy.
- `/api-export` for API keys and export journal.

What to say:
- BLS/SFK/OFF/source visibility is separate from user-authored records.
- Sensitive exports and access events are written to `access_audit_logs` on a best-effort basis.
- `export_jobs` is an operational journal of export metadata. (Patient-bound report binaries/snapshots were removed with the Berichte feature.)

Important boundary:
- SSO configuration, claim-to-role mappings, Supabase Auth SSO callback membership application, API keys, and audit records are implemented.
- FHIR sync is still follow-up implementation work.

### 2. Patient Intake

Use:
- `/patienten`
- `/patienten/[id]`
- `/protokoll/[linkId]`

Demo actions:
- Open the patient overview and show the dense worklist before secondary demo/mail-merge tools.
- Open a patient and use the `Workflow` tab.
- Generate a digital protocol link from the patient workspace.
- Open the public protocol URL in a separate browser context or mobile viewport.
- Submit a simple food diary entry.
- Return to the patient workspace and show the incoming submission state.

Implementation references:
- `components/patient-workflow-tab.tsx`
- `components/patient-tabs.tsx`
- `app/protokoll/[linkId]/patient-protocol-form.tsx`
- `app/api/protokoll/submit/route.ts`
- `hooks/use-digital-protocols.ts`
- `hooks/use-digital-protocol-submissions.ts`

Validation reference:
- `tests/digital-protocol.spec.ts` covers public-route shell behavior, API validation, and the persisted happy path from public submission through link status update, submission audit row, authenticated conversion API, converted-state tracking, conversion audit row, and the practitioner Smart-Match review/protocol-form save flow.
- Shared Supabase setup for this path lives in `tests/fixtures/clinic-demo.ts` alongside the report and institution demo fixtures.

### 3. Assessment And Counseling

Use:
- `/patienten/[id]/protokolle/neu?digitalSubmission=<id>`
- `/patienten/[id]/protokolle/[protokollId]`
- `/patienten/[id]/beratungen/neu`
- `/patienten/[id]/beratungen/[beratungId]`

Demo actions:
- Convert the digital submission into an internal nutrition protocol.
- Show smart matching confidence and preserved free-text notes for unresolved entries.
- Open the protocol analysis and patient-bound reference profile context.
- Create or open a counseling session with measures, material, and follow-up steps.

Implementation references:
- `lib/digital-protocol-conversion.ts`
- `components/protocol-form.tsx`
- `components/smart-match-review-dialog.tsx`
- `components/protocol-analysis.tsx`
- `components/counseling-session-form.tsx`
- `hooks/use-protocols.ts`
- `hooks/use-counseling.ts`

Demo risk:
- The full digital-submission conversion path should get a persisted Playwright fixture before this is used as the main sales demo.

### 4. Patient Analytics (Statistiken)

The standalone Berichte route and per-patient report archive were removed. Per-patient
analytics now live in the **Statistiken** patient tab.

Use:
- Open a patient, switch to the `Statistiken` tab.

Demo actions:
- Show the weight/BMI development charts, KPI cards, and activity-energy chart.
- For plan PDF/CSV exports, use the `/ernaehrungsplan` day toolbar (still backed by `/api/exports/report`).

Implementation references:
- `components/patient-stats-tab.tsx`
- `app/api/exports/report/route.ts` (plan PDF/CSV generation only; no patient-report persistence)
- `lib/exports/pdf.tsx`
- `lib/exports/csv.ts`

### 5. Inpatient Assignment And Safe Meal Selection

Use:
- `/institution/menueplaene`
- `/institution/krankenhaus`
- `/institution/krankenhaus/tablettenkarten?date=<date>&mealSlot=<slot>&station=<station>`

Demo actions:
- Show an active menu cycle with diet forms and recipe assignments.
- Assign a patient to station, room, bed, and diet form.
- Select a safe meal and save the order.
- Select a blocked meal for an allergen patient, document the override reason, and show the audit trail.
- Confirm a pending kitchen order.
- Render tray cards with room/bed, diet form, allergens/restrictions, notes, and kitchen status.

Implementation references:
- `app/(app)/institution/menueplaene/menueplaene-client.tsx`
- `app/(app)/institution/krankenhaus/krankenhaus-client.tsx`
- `app/(app)/institution/krankenhaus/tablettenkarten/page.tsx`
- `hooks/use-inpatient-stays.ts`
- `hooks/use-meal-orders.ts`
- `lib/institution-analytics.ts`

Validation reference:
- `tests/institution.spec.ts` covers explicit institution fixtures, safe order save, blocked allergen override logging, production status, analytics, and tray-card rendering.
- It uses `tests/fixtures/clinic-demo.ts` for shared patient, menu, storage cleanup, and audit helpers.

### 6. Kitchen Production And Institution Analytics

Use:
- `/institution/produktion`
- `/institution/compliance`
- `/institution/statistiken`

Demo actions:
- Show production groups by meal slot and diet form.
- Move a batch from planned to in preparation, ready, served, or held.
- Show compliance and institution statistics derived from active menus, stays, meal orders, and allergen snapshots.

Implementation references:
- `app/(app)/institution/produktion/produktion-client.tsx`
- `lib/data/production-batches.ts`
- `lib/data/production-batches-client.ts`
- `app/(app)/institution/compliance/compliance-client.tsx`
- `app/(app)/institution/statistiken/statistiken-client.tsx`
- `lib/institution-analytics.ts`

Important boundary:
- Production batch states now persist in `kitchen_production_batches`, with state transitions appended to `kitchen_production_events` and mirrored in `access_audit_logs`.

## Demo Prerequisites

Environment:
- Supabase must be configured for persistence, auth, storage, and RLS-backed features.
- Apply migrations through the current head in `supabase/migrations/`.
- Run a food ETL first, such as `npm run etl:bls`, so demo recipes and protocol entries can reference real `foods` rows.
- Seed the full buyer-story workspace with `DEMO_USER_EMAIL=<account-email> SUPABASE_SERVICE_ROLE_KEY=<service-role-key> npm run seed:clinic-demo`.
- Add `DEMO_USER_PASSWORD=<password>` only when the demo auth user does not exist yet and the script should create a confirmed user.
- Use `npm run seed:clinic-demo -- --dry-run` to verify credentials, user lookup, and food availability without writing rows.
- The seed command creates or refreshes only `clinic-demo-*` records for the target user: patients, protocol intake, counseling, menu cycle, inpatient stays, meal orders, and audit/export rows.
- Use `NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING=true` only for local testing, never as a production or sales-deployment claim.

Recommended checks before a demo:
- `npm run typecheck`
- `npm run lint`
- `npm run validate:nutrients`
- `npm run test -- tests/institution.spec.ts`
- `npm run test -- tests/digital-protocol.spec.ts`
- Manually export one plan PDF from `/ernaehrungsplan` and verify the download works.

## Open Demo Hardening Work

P0 demo hardening:
- `npm run seed:clinic-demo` now seeds the full patient-to-kitchen buyer story for a selected Supabase Auth user.
- Digital protocol coverage now includes the practitioner Smart-Match review sheet and saved internal protocol path.
- Keep `tests/fixtures/clinic-demo.ts` aligned with the deployed seed story as report, institution, and digital-protocol coverage expands.

P1 clinic readiness:
- Build FHIR Patient/Observation dry-run job/review surfaces.

P2 product depth:
- Extend patient portal/PWA beyond diary entry to report delivery, reminders, meal-plan feedback, and secure messages.
- Persist user-created food synonyms fully in Supabase instead of keeping a local overlay.
- Add direct clinical manufacturer feeds after OFF promotion and source trust workflows are stable.
