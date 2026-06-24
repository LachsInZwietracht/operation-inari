# AGENTS.md

## Project

Operation Prodi is a German clinical nutrition counseling and therapy platform. The product goal is to replace legacy desktop PRODI-style workflows with a secure cloud app for clinics, practices, and pharmacies, with a clinic-first strategy.

Primary buyer lens: German clinics and clinical nutrition departments.

## Current #1 Priority

Our current top guideline is to build a product that satisfies the PRODI-user feedback in `docs/user-priority-feedback.md`. This is the single most important reference for prioritization right now. Before starting new feature work, confirm it advances one of those requirements or supports them. Re-evaluate this priority only with explicit user direction.

Core product areas:
- Food and nutrient database workflows with BLS 4.0 data.
- Recipes, daily meal plans, menu cycles, nutrient analysis, and reports.
- Patient records, clinical workspace, counseling, protocols, lab values, screenings, and digital protocol intake.
- Institution workflows for menu planning, inpatient meal orders, allergen/diet-form checks, kitchen aggregation, and tray cards.
- Practice operations, appointments, invoices, exports, RBAC, and admin surfaces.

## Source Of Truth

Code and migrations win over docs.

Use this order when facts conflict:
0. `docs/user-priority-feedback.md` is the current #1 product guideline for prioritization (what to build/polish next), but it does not override code as a factual source of truth.
1. Current code, migrations, tests, and package files.
2. `documentation.md` for implemented feature map and workflows.
3. `docs/database-guide.md` for Supabase, ETL, food data, search, and schema context.
4. `docs/competitive-audit.md` for market/strategy context.
5. `.agent/docs/*` for agent playbooks and vendor-specific working notes.

Start with `docs/README.md` when you need to decide which documentation to read.

## Stack

- Next.js 15 App Router with React 19.
- TypeScript with strict checking.
- Tailwind CSS 4.
- shadcn/ui with Radix primitives and `lucide-react`.
- Supabase for persistence, auth, RLS, and storage.
- React Hook Form with Zod.
- Recharts for charts.
- Playwright for end-to-end testing.
- `@react-pdf/renderer` for server-side PDF generation.

Notable repo facts:
- React Compiler is enabled in `next.config.ts`.
- Auth is enforced when Supabase env vars are configured.
- `NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING=true` is a local-only bypass; do not add other bypasses.
- RBAC roles live in `organization_memberships`: `owner`, `admin`, `dietitian`, `assistant`, `institution_admin`.
- External image domains are not broadly configured in `next.config.ts`.

## Commands

- `npm run dev` - start development server.
- `npm run build` - production build.
- `npm run lint` - ESLint.
- `npm run typecheck` - TypeScript check.
- `npm run test` - Playwright tests.
- `npm run validate:nutrients` - nutrient math validation.
- `npm run etl:bls` - import BLS data.
- `npm run etl:verify:bls` - verify BLS import.
- `npm run etl:sfk` - import Souci-Fachmann-Kraut data.
- `npm run etl:verify:sfk` - verify SFK import.
- `npm run etl:reference-values` - import reference values.
- `npm run etl:recipes` - import shared recipes and meal plan templates.
- `npm run etl:off` - import Open Food Facts data.
- `npm run etl:synonyms` - generate German food synonyms.
- `npm run etl:portions` - import curated portion sizes.
- `npm run etl:all` - run full ETL pipeline (supports `--skip`, `--only`, `--dry-run`).

## Hard Rules

- Use TypeScript for application code.
- Prefer existing repo patterns over new libraries or parallel abstractions.
- Do not add non-shadcn primitives to `components/ui/`.
- Keep changes narrow and task-focused.
- Preserve user changes; never revert unrelated work.
- Do not expose secrets through `NEXT_PUBLIC_*`.
- Do not weaken route protection, RLS, RBAC, or export access checks.
- If a task touches schema, migrations, auth, RLS, exports, ETL, or shared domain contracts, inspect the relevant implementation and docs first.
- Treat `lib/mock-data` carefully: some modules are explicit static reference catalogs or migration/demo fallbacks, not production runtime seeds.
- For nutrient math or data-source changes, keep calculations traceable to deterministic source data.

## Work Discipline

Before editing:
- Read the target file and adjacent patterns.
- Search for the same behavior elsewhere with `rg`.
- Check `docs/README.md` for relevant deeper docs.

While editing:
- Make the smallest complete change.
- Avoid formatting churn, broad renames, and opportunistic cleanup.
- Keep naming, component structure, and data access style consistent with nearby code.
- Update docs when behavior, commands, public APIs, schema, or product truth changes.

When blocked:
- State the blocker clearly.
- Include the command or file that proved the blocker.
- Do not silently invent missing data, APIs, credentials, or schemas.

## Validation

Validate proportionally.

For docs-only changes:
- Inspect rendered Markdown structure by heading/search checks.
- No app test is required unless docs generation or code examples are executable.

For copy-only UI changes:
- Run `npm run lint` when feasible.

For TypeScript, logic, hooks, or data-flow changes:
- Run `npm run typecheck`.
- Run targeted tests that cover the changed behavior.

For routing, auth, exports, persistence, shared hooks, or institution/patient workflows:
- Run `npm run lint`.
- Run `npm run typecheck`.
- Run relevant Playwright tests.
- Run `npm run build` for broad or cross-cutting changes.

For nutrient calculation, food data, search, reference values, or ETL:
- Run `npm run validate:nutrients`.
- Run the most relevant food/search/reference tests if behavior changed.

If a check is too expensive or blocked by environment, report it explicitly.

## Documentation Routing

- Current #1 product priority and acceptance lens: `docs/user-priority-feedback.md`.
- Feature routes, components, hooks, and workflows: `documentation.md`.
- Database schema, migrations, ETL, food data, search, performance constraints: `docs/database-guide.md`.
- Competitors, clinic-first strategy, and market gaps: `docs/competitive-audit.md`.
- Supabase workflow notes: `.agent/docs/supabase.md`.
- Billing/subscription status: `.agent/docs/billing.md`.
- Agent phase commands: `.claude/commands/*`.

## Project Map

- `app/` - App Router routes, layouts, server/client entry points, API routes.
- `components/` - feature components.
- `components/ui/` - shadcn/ui primitives and wrappers.
- `hooks/` - reusable React hooks.
- `lib/data/` - data access and client repository helpers.
- `lib/supabase/` - Supabase client/server/middleware utilities.
- `lib/types/` - shared domain types.
- `lib/mock-data/` - static references, seeds, demo data, and migration fallbacks.
- `lib/exports/` - PDF, CSV, report, and export job logic.
- `lib/search/` - fuzzy and phonetic search.
- `supabase/` - config, seed data, and migrations.
- `scripts/etl/` - import and validation scripts.
- `tests/` - Playwright tests.
- `docs/` - product, database, strategy, and documentation index.
