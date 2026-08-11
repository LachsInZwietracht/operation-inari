# Client Mode Plan

Status: M1 shipped (`/klient` with the diary, plan and training modules, migrations `20260806000072`–`20260807000074`); barcode shipped without a migration (lookup + camera). The surface is organized as modules — see `lib/client-modules.ts`. Owner decision record for the second product surface.

## Vision

Operation Prodi today is a single-audience product: the dietitian/clinic builds plans and manages patient records. Client Mode adds a **second surface on the same platform** where the person being counseled tracks their own nutrition and training, and where counselor and client are deliberately interlocked.

Two roles, one account model:

- **Counselor mode** — everything the app does today (patients, plans, analysis, reports).
- **Client mode** — the client's own space: food log, training log, the plan their counselor shared.

Every user account can be both. A user is a *client of* another user through an explicit link. This is not a testing shortcut — it is the model, because it makes "my dietitian is also someone else's client" work without a parallel identity system.

### Scope decisions (agreed)

| Decision | Choice |
|---|---|
| Linking | Counselor generates an invite code for an existing patient record; client redeems it in client mode. |
| Visibility | One-time consent at link time makes food log and training visible to that counselor. Revocable. |
| First milestone | Foundation + nutrition tracking. Barcode and training follow as separate milestones. |
| Plan sharing | Client sees the shared plan for the day and can check meals off as eaten. |

### Non-goals for now

- Native mobile apps. Client mode is mobile-web/PWA.
- Client-to-client features, social, messaging.
- Any client access to clinical data (diagnoses, lab values, screenings, counselor notes).
- Billing or plan-tier gating of client mode.

## What already exists and what it means

Verified against migrations and `app/` on 2026-08-06.

| Existing | Relevance |
|---|---|
| `patients` (`user_id → auth.users`) | A record *owned by the counselor*. No link to a client's own account. This is where the link column goes. |
| `nutrition_protocols` + `nutrition_protocol_entries` | Already a food diary, but counselor-owned, `patient_id` is `TEXT`, entries require a `food_id`. Reuse as an **import target**, not as the client's log. |
| `daily_meal_plans` (has `patient_id`, `status`, `approved_at`) | Plan sharing needs no new plan table — a plan is shareable when it is bound to a patient and `status IN ('active','approved')`. |
| `organizations` / `organization_memberships` (roles `owner`, `admin`, `dietitian`, `assistant`, `institution_admin`) | Client is **not** an org role. A client has no org membership; the link table carries the relationship. |
| `app/protokoll/[linkId]` | Existing precedent for a token-addressed flow outside the app shell. The invite redemption reuses this pattern. |
| `app/(app)/layout.tsx` (sidebar shell, RBAC-aware) | Client mode gets its own route group and shell, not this one. |
| OFF imports store the barcode as `foods.source_food_id` (`import-off.ts`), covered by `UNIQUE(data_source_id, source_food_id)` | Barcode lookup needs **no** mapping table — the index answers it directly. An earlier version of this document claimed the opposite and proposed seeding a `food_barcodes` table from `off_staging`; that table is empty since the quota cleanup, so the plan was also unbuildable. |

## Architecture

### 1. Mode switching

One auth user, one session, two surfaces.

- Active mode lives in a **cookie** (`prodi_mode=counselor|client`), not just client state, so server components and `middleware.ts` resolve the correct surface on first render.
- New route group `app/(client)/` with its own layout: mobile-first, bottom navigation, no sidebar, no command palette.
- A switcher in both headers flips the cookie and redirects to that surface's home.
- `middleware.ts` enforces the boundary: counselor routes reject a client-mode session and vice versa, so the mode cannot be bypassed by typing a URL.

The mode is a **view preference, not a permission**. Authorization always comes from RLS and the link table — never from the cookie.

### 2. Data ownership

The rule that everything else follows: **tracking data belongs to the client account, never to the patient record.**

A client may change counselors or have two at once. If logs hang off the patient record, the client's history fragments on every change and the client loses access to their own data when a counselor deletes a record. So:

- Client-generated rows carry `client_user_id → auth.users`.
- The counselor *reads* them through the link, with consent. They are not the counselor's rows.
- Clinical data stays counselor-owned and stays invisible to the client.

### 3. The link

```
client_links
  id                uuid pk
  patient_id        uuid  → patients(id) on delete cascade
  client_user_id    uuid  → auth.users(id) on delete cascade   -- null until redeemed
  counselor_user_id uuid  → auth.users(id) on delete cascade   -- denormalized for RLS speed
  invite_code       text unique                                 -- high-entropy, single use
  invite_expires_at timestamptz
  status            text check (status in ('invited','active','revoked'))
  consent_nutrition boolean not null default false
  consent_training  boolean not null default false
  consented_at      timestamptz
  revoked_at        timestamptz
  created_at / updated_at
  unique (patient_id) where status <> 'revoked'
```

`patients` gets no new column beyond a convenience view; the link table is the single source of truth for the relationship, which keeps revocation and re-invitation clean.

Flow:

1. Counselor opens a patient, clicks *Klienten-Zugang einladen* → row with `invite_code`, `status='invited'`.
2. Client (any account, existing or new) opens `/klient/einladung/[code]`, sees who is inviting and what will be shared, consents → `status='active'`, `client_user_id` set, consent flags set.
3. Either side can revoke. Revocation stops all counselor reads immediately; the client keeps every row they created.

### 4. Row level security

The highest-risk part of this work. Two access paths per table, expressed as one predicate:

```sql
-- read
client_user_id = auth.uid()                       -- the client's own data
or exists (                                        -- their consenting counselor
  select 1 from client_links l
  where l.client_user_id = <table>.client_user_id
    and l.counselor_user_id = auth.uid()
    and l.status = 'active'
    and l.consent_nutrition           -- or consent_training
)

-- insert / update / delete
client_user_id = auth.uid()                       -- counselors never write client rows
```

Counselors get **read-only** access to client-owned rows, always. Every table added below follows this shape; a helper SQL function keeps the predicate in one place.

### 5. Nutrition tracking (milestone 1)

New client-owned tables rather than an extension of `nutrition_protocols`, because the client's log needs free-text entries, recipes, barcode products absent from the catalog, and quick re-entry — none of which the protocol schema permits.

```
client_food_log_days
  id, client_user_id, log_date, notes, created_at, updated_at
  unique (client_user_id, log_date)

client_food_log_entries
  id, day_id → client_food_log_days on delete cascade
  slot_type      -- same five slots as meal_entries, so analysis lines up
  source_type    -- 'food' | 'recipe' | 'custom'
  food_id        -- nullable, → foods(id)
  recipe_id      -- nullable, → recipes(id)
  custom_name    -- for source_type='custom'
  custom_nutrients jsonb  -- barcode/manual products not in the catalog
  amount, unit, household_measurement jsonb
  logged_at, sort_order, created_at
```

Slot names deliberately match `meal_entries` and `nutrition_protocol_entries` so nutrient math and reports need no new mapping layer.

**Counselor import:** an action that materializes a date range of a client's log into a `nutrition_protocol` for that patient. This is what makes the existing analysis, reports and PDF stack usable on client data without rebuilding any of it. Custom entries carry their `custom_nutrients` into the protocol as a custom food.

### 6. Plan visibility and adherence

- Client sees `daily_meal_plans` where `patient_id` belongs to their active link and `status IN ('active','approved')`.
- New `client_meal_completions (id, client_user_id, meal_plan_id, meal_entry_id, completed_at, skipped boolean, note)`.
- Adherence for the counselor = completions against plan entries, per day and per week. This is the single most valuable signal in the whole feature for the counselor, and it is nearly free once the plan is visible.
- Checking a meal off may optionally copy it into the food log, so plan-followers get a filled diary without double entry.

### 7. Barcode (milestone 2)

**Stage 1 — lookup: shipped.** No migration was needed; nothing about the schema changed.

`GET /api/foods/barcode/[code]` resolves a code in three tiers, and the three outcomes stay distinct because the client has to treat them differently:

| Tier | Source | Becomes |
|---|---|---|
| 1 | `foods` where `data_source_id='off'` and `source_food_id` matches | a normal `food` entry the counselor can trace |
| 2 | Open Food Facts API, by code | a `custom` entry with its own per-100 g nutrients |
| 3 | nothing | a short manual form (name + kcal, macros optional) producing the same `custom` entry |

Tier 2 runs server-side (identifying User-Agent, no CORS, OFF outages degrade to tier 3 rather than throwing on someone's phone) and is gated on nutrition quality: energy plus all three macros, and the ETL's plausibility checks. That bar is deliberately **lower** than the catalog's `OFF_MIN_QUALITY_SCORE` of 90 — someone holding the product has better evidence it exists than any import heuristic — but strict enough that a nutrient-less OFF record cannot enter a diary as 0 kcal. Scans still never write to `foods`; the catalog stays curated.

The OFF parsing is shared with `scripts/etl/import-off.ts` via `lib/off-product.ts` rather than duplicated. `isJunkName` is applied by the ETL only: an odd name should block silent catalog promotion, but not a product a person is looking at.

**Stage 2 — camera: shipped.** Native `BarcodeDetector` where available, `zxing-wasm` otherwise; since Safari has none, the wasm path is the primary one on iPhone rather than a fallback. Dynamic import keeps the ~1 MB decoder out of the diary bundle, and the wasm is self-hosted under `/zxing/` — the library's default is a CDN fetch on every scan, which would leak scan activity to a third party and break whenever that CDN does.

The PWA groundwork the earlier plan called for was already in place (`public/site.webmanifest`, `display: standalone`, wired in `app/layout.tsx`); camera access needs HTTPS, not a service worker. Offline support still does not exist — no service worker anywhere — which is the more useful next step for a diary than anything scanner-related.

Verified without a device: `tests/client-barcode-camera.spec.ts` drives the real flow against Chromium's fake camera and asserts the streams end on close *and* on dialog dismissal, plus that the wasm is fetched from our own origin. Headless Chromium has no `BarcodeDetector`, so that run exercises the same branch an iPhone takes. Decoding itself is pinned by generating an EAN-13 from the symbology tables and reading it back. What no test can answer is whether it decodes a crumpled label in a badly lit aisle — that needs a real phone.

Unknown-barcode capture (client photographs the label) remains a later addition.

### 8. Training tracking (milestone 3)

New domain, no existing code to reuse. Deliberately small first:

```
exercises                 -- seeded catalog + client-created, client_user_id nullable for system rows
client_workout_sessions   -- client_user_id, date, title, duration, perceived_exertion, notes
client_workout_sets       -- session_id, exercise_id, set_index, reps, weight, distance, duration, notes
```

Weekly progression (the "habe ich mich gesteigert" view) is a query over sets per exercise per week — best set, total volume, estimated 1RM — not a stored table. Counselor sees the same views read-only under `consent_training`.

## Milestones

**M1 — Foundation + nutrition tracking** (the agreed first step)

1. ✅ `client_links` table, RLS, invite generation + redemption, revocation.
2. ✅ Mode cookie, `app/(client)/` route group and mobile shell, middleware boundary.
3. ✅ Counselor UI: invite and link status in the patient tab **Klienten-App**.
4. ✅ `client_food_log_*` tables with the RLS shape above.
5. ✅ Client UI: day view, food search, add/delete entries, daily macro totals.
6. ✅ Plan-of-the-day view with check-off + `client_meal_completions`.
7. ◐ Counselor UI: the client's last 7 logged days are visible; adherence and the
   import into `nutrition_protocols` are still open.

Deliberately deferred from the first build so the surface stays small: entry
editing (delete + re-add covers it), manual/custom entries (they arrive with the
barcode milestone that needs them), and per-area consent UI (the schema carries
both flags, redemption sets both).

**M2 — Barcode**: PWA setup, scanner component, `food_barcodes`, OFF API fallback, review queue.

**M3 — Training**: ✅ shipped without the exercise catalog — session logging, sets, derived weekly progression, counselor read under `consent_training`. A catalog remains optional and additive.

**M3.1 — Training, second pass**: ✅ shipped in three steps, in this order because
the first decides whether the module is used at all and the third is the only one
that needs a migration.

1. *Logging speed* — prefill from the previous set, "Speichern & weiter", per-exercise
   `+ Satz`, exercise chips read back out of the last session with the same title,
   rest timer. No schema.
2. *Progress* — estimated 1RM (Epley) and volume alongside the heaviest set,
   personal records, a per-exercise detail view with a measure toggle. No schema.
3. *Energy* — `duration_minutes`, `activity_kind`, `intensity`, `body_weight_kg`
   (migration `20260810000077`) plus the shared MET table in
   `lib/energy-expenditure.ts`, which also replaced the counselor's flat activity
   factor. The kcal figure is derived, net of resting metabolism, carries a range,
   and is never subtracted from the food total.

Still deliberately absent: an exercise catalog with muscle groups, wearable import,
supersets/RPE/tempo, and training plans as a stored entity — the exercise chips
cover the repeat case without them.

**M4 — Nutrition, second pass**: ✅ shipped in four steps.

1. *Connection* — the plan's meals appear inside the diary and count once ticked
   off; `client_meal_completions.amount` plus a recipe-ingredient read policy
   (migration `20260811000078`). Read-side join, never a copy.
2. *Reference* — a day target from plan > `daily_calorie_goal` > basal × PAL,
   delivered through `client_patient_history()` (migration `20260811000079`).
   No target at all stays a valid outcome; the bars have no red state.
3. *Speed* — `food_portions` chips, per-slot frequent entries, "wie gestern",
   editable amounts. No schema.
4. *Context* — the day note (the column had existed unused since the start) and
   water in `water_ml` (migration `20260811000080`), plus per-meal adherence for
   the counselor.

**M5 — Finding things, and a training section**: ✅

1. *Training in the Verlauf* — sessions and volume per week, personal records,
   and section headings splitting the page into Ernährung and Training.
2. *Hits identify themselves* — manufacturer and kcal per 100 g in the result
   list, full macros on the picked item.
3. *One search instead of tabs* — foods, recipes and saved meals in one list
   with type badges and filter chips.
4. *Custom products as real client-owned foods* (migration `…81`), *saved
   meals* (`…82`) and *recipes logged as recipes* (`…83`).

Still deliberately absent: photo recognition, micronutrient traffic lights in the
client view (that is the counselor's work), client-authored recipes with
ingredients and instructions — saved meals cover the case people actually have —
and streaks.

**Later candidates**: photo meal logging, weight/measurement self-entry feeding `patient_anthropometrics`, counselor→client messages and nudges, missed-log reminders, client-visible goals.

## Risks

- **RLS is the whole security model here.** A wrong predicate exposes health data across accounts. Every new table needs a Playwright test that asserts a second account cannot read the first's rows, and that a revoked link stops reads.
- **Positioning**: `docs/user-priority-feedback.md` is the current #1 guideline and is clinic-first B2B. Client mode is an intentional second direction, not a subordinate item of that priority. Track it as its own line.
- **DSGVO**: client data is health data with a different legal basis than counselor-entered records — consent, revocation, export and deletion must actually work, not just exist in the UI.
- **Barcode coverage** will disappoint against MyFitnessPal-style expectations because the catalog is pruned on purpose. The OFF API fallback is what makes M2 acceptable; without it, do not ship the scanner.
- **Two shells, one codebase**: resist reusing counselor components in client mode. They assume RBAC, sidebar context and desktop density.
