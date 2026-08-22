# Clinic Demo Runbook

Last updated: 2026-08-22

Purpose:
- Provide one repeatable clinic-first demo path for German hospital buyers.
- Keep the story grounded in implemented routes, persistence, exports, audit logs, and tests.
- Make demo gaps explicit so the next sprint improves credibility instead of adding disconnected surface area.

Source-of-truth rule:
- Code, migrations, and tests win over this runbook.
- Use `documentation.md` for route/component details and `docs/database-guide.md` for schema, ETL, search, export, and audit details.
- Use `docs/clinic-it-integration-plan.md` for the remaining FHIR contract.

## Demo Goal

Show Operation Prodi as a cloud-native German clinical nutrition workflow:

1. A patient completes the public intake and is linked to a clinical record.
2. The linked client documents food, activity, and daily context in client mode.
3. The dietitian reviews the shared information and turns it into counseling and meal-plan outputs.
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
- `/patienten/aufnahmen`
- `/patienten/[id]`
- `/onboarding/[linkId]`

Demo actions:
- Create an intake invitation and open its public URL in a separate browser context or mobile viewport.
- Submit the questionnaire, review it under `Aufnahmen`, and apply it to the patient record.
- Open the patient overview and show the intake event, clinical facts, and next actions.

Implementation references:
- `app/(app)/patienten/aufnahmen/aufnahmen-client.tsx`
- `components/patient-intake-review.tsx`
- `app/onboarding/[linkId]/page.tsx`
- `app/api/onboarding/submit/route.ts`

Validation reference:
- `tests/patient-intake.spec.ts` covers the public intake and practitioner review/apply path.
- Shared Supabase setup for the buyer story lives in `tests/fixtures/clinic-demo.ts`.

### 3. Assessment And Counseling

Use:
- `/patienten/[id]`
- `/patienten/[id]/beratungen/neu`
- `/patienten/[id]/beratungen/[beratungId]`

Demo actions:
- Show the patient-bound reference profile, energy needs, measurements, diagnoses, medication, lab values, and client-link status as appropriate for the demo case.
- Create or open a counseling session with measures, material, and follow-up steps.

Implementation references:
- `components/patient-overview-tab.tsx`
- `components/patient-tabs.tsx`
- `components/patient-tabs/klienten-app-tab.tsx`
- `components/counseling-session-form.tsx`
- `hooks/use-counseling.ts`

Optional client-mode extension:
- With a second authenticated account, redeem the patient invitation at `/klient/einladung/[code]`, add a diary entry under `/klient`, then show the consent-gated read-only view in the patient's **Klienten-App** tab.

### 4. Patient Analytics (Statistiken)

The standalone Berichte route and per-patient report archive were removed. Per-patient
analytics now live in the **Statistiken** patient tab.

Use:
- Open a patient and scroll the overview to `Verlauf und Statistik`.

Demo actions:
- Show the weight chart with its calorie projection, then the BMI, body-composition and activity-energy charts below it.
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
- Run a food ETL first, such as `npm run etl:bls`, so demo recipes, plans, and client diary entries can reference real `foods` rows.
- Seed the full buyer-story workspace with `DEMO_USER_EMAIL=<account-email> SUPABASE_SERVICE_ROLE_KEY=<service-role-key> npm run seed:clinic-demo`.
- Add `DEMO_USER_PASSWORD=<password>` only when the demo auth user does not exist yet and the script should create a confirmed user.
- Use `npm run seed:clinic-demo -- --dry-run` to verify credentials, user lookup, and food availability without writing rows.
- The seed command creates or refreshes only `clinic-demo-*` records for the target user. Inspect the current seed script for the exact included patient, counseling, menu, inpatient, meal-order, and audit/export records.
- Use `NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING=true` only for local testing, never as a production or sales-deployment claim.

Recommended checks before a demo:
- `npm run typecheck`
- `npm run lint`
- `npm run validate:nutrients`
- `npm run test -- tests/institution.spec.ts`
- `npm run test -- tests/patient-intake.spec.ts --workers=1`
- Manually export one plan PDF from `/ernaehrungsplan` and verify the download works.

## Open Demo Hardening Work

P0 demo hardening:
- Keep `npm run seed:clinic-demo` and `tests/fixtures/clinic-demo.ts` aligned with the deployed patient-to-kitchen buyer story.
- Add a stable two-account fixture before client-mode diary sharing becomes a mandatory sales-demo step.

P1 clinic readiness:
- Build FHIR Patient/Observation dry-run job/review surfaces.

P2 product depth:
- Extend patient portal/PWA beyond diary entry to report delivery, reminders, meal-plan feedback, and secure messages.
- Persist user-created food synonyms fully in Supabase instead of keeping a local overlay.
- Add direct clinical manufacturer feeds after OFF promotion and source trust workflows are stable.
