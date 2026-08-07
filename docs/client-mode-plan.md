# Client Mode Plan

Status: M1 shipped (`/klient` with the diary and plan modules, migrations `20260806000072` and `20260807000073`); barcode and training still open. The surface is organized as modules — see `lib/client-modules.ts`. Owner decision record for the second product surface.

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
| `foods` has **no** barcode column; barcodes live only in `off_staging` | Barcode scanning needs its own lookup path plus an Open Food Facts API fallback. The local catalog is intentionally pruned. |

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

### 7. Barcode scanning (milestone 2)

Three parts, none of which exist yet:

- **Scanner**: `BarcodeDetector` where available, `zxing-wasm` fallback. Requires HTTPS and camera permission → client mode ships as an installable PWA.
- **Lookup**: new `food_barcodes (barcode pk, food_id → foods)` mapping table, seeded from `off_staging` for the products that survived pruning.
- **Fallback**: Open Food Facts API for unknown codes, normalized into a `custom` log entry and queued for review before anything enters `foods`. The local catalog stays curated — scans must never write to it directly.

Unknown-barcode capture (client photographs the label) is a later addition, not part of this milestone.

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

**M3 — Training**: exercise catalog, session logging, weekly progression views, counselor read.

**Later candidates**: photo meal logging, weight/measurement self-entry feeding `patient_anthropometrics`, counselor→client messages and nudges, missed-log reminders, client-visible goals.

## Risks

- **RLS is the whole security model here.** A wrong predicate exposes health data across accounts. Every new table needs a Playwright test that asserts a second account cannot read the first's rows, and that a revoked link stops reads.
- **Positioning**: `docs/user-priority-feedback.md` is the current #1 guideline and is clinic-first B2B. Client mode is an intentional second direction, not a subordinate item of that priority. Track it as its own line.
- **DSGVO**: client data is health data with a different legal basis than counselor-entered records — consent, revocation, export and deletion must actually work, not just exist in the UI.
- **Barcode coverage** will disappoint against MyFitnessPal-style expectations because the catalog is pruned on purpose. The OFF API fallback is what makes M2 acceptable; without it, do not ship the scanner.
- **Two shells, one codebase**: resist reusing counselor components in client mode. They assume RBAC, sidebar context and desktop density.
