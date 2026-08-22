# Supabase Agent Playbook

Use this for Supabase-specific work in Operation Prodi. Migrations in `supabase/migrations/` are the schema source of truth.

## Current Model

- Hosted Supabase is the primary backend.
- Local Supabase is optional for UI development.
- Auth is enforced by middleware when Supabase env vars are configured.
- RLS is expected for user-owned and organization-owned data.
- ETL scripts use server-side credentials and must not rely on `NEXT_PUBLIC_*` keys.

## Commands

Use existing project commands first:

```bash
npm run etl:bls
npm run etl:verify:bls
npm run etl:reference-values
npm run etl:recipes
npm run etl:off
```

Use `npx supabase ...` for CLI actions unless a package script exists:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase db pull
npx supabase migration new <name>
npx supabase gen types typescript --project-id <project-ref>
```

Do not assume `npm run supabase:*` scripts exist; check `package.json` first.

## Environment Rules

- Server-only credentials: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or equivalent private variables.
- Browser-safe credentials: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Never expose service-role credentials through `NEXT_PUBLIC_*`.
- Document any newly required variables in `.env.example` when that file exists or is introduced.

## Migration Rules

- Add schema changes through migrations only.
- Keep RLS policies with the tables they protect or in a clearly related migration.
- For user-owned tables, include `user_id` ownership and RLS from the first migration.
- For organization features, inspect `organization_memberships`, `lib/auth/access.ts`, and `lib/auth/rbac.ts`.
- For storage-backed exports, handle both database metadata and storage access policy.

## Data Access Rules

- Prefer existing helpers in `lib/data/*`.
- Use server Supabase helpers for server routes/pages and client helpers for browser hooks.
- Preserve timeout/fallback behavior where hooks already support local fallback.
- Do not seed authenticated runtime state from mock constants.
- Merge local fallback records only as migration/offline candidates.

## Test Environment

The Playwright suite creates real users, patients, and links through the
service-role client. `playwright.config.ts` requires `.env.test` to target a
local stack and serializes the suite to one worker. It refuses `.env.local` and
non-local URLs unless `ALLOW_E2E_EXTERNAL_SUPABASE=true` explicitly approves a
throwaway external project.

```bash
npx supabase start      # needs Docker Desktop running
npx supabase db reset   # applies every migration from scratch, then seed.sql
```

`.env.test` (gitignored via `.env*`) holds the local URL and keys from
`npx supabase status -o env`.

Two traps worth knowing:

- **Use the `sb_publishable_` / `sb_secret_` keys, not the `ANON_KEY` /
  `SERVICE_ROLE_KEY` that `status -o env` also prints.** The local stack signs
  JWTs asymmetrically; GoTrue rejects the legacy HS256 keys with
  `invalid JWT: ... signing method HS256 is invalid`. PostgREST still accepts
  both, so the database half of a test can pass while `auth.admin.*` fails.
- **Keep the CLI current** (`npx supabase@latest`). A CLI older than its
  container images hands out keys the auth service no longer accepts, which
  produces exactly the error above.

If a run fails at `tests/auth.setup.ts` with a JWT error, check the local stack
before touching the specs.

## Verification

For schema/RLS changes:
- Inspect generated migration SQL.
- Run `npm run typecheck` after updating types or data contracts.
- Run targeted Playwright tests for affected routes.
- Run `npm run validate:nutrients` for food, nutrient, reference, or ETL changes.
