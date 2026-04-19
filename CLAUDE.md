# CLAUDE.md

## Operation Prodi

This repository contains Operation Prodi, a modern German nutrition counseling web application that replaces legacy desktop PRODI workflows. It covers food database browsing, recipes, meal planning, nutrition analysis, patient workflows, exports, and reference value comparisons.

Current state:
- MVP / active product build with BLS 4.0 food data served from Supabase
- Supabase-first persistence with local fallback for some client-managed entities
- Advanced food search with phonetic matching, synonyms, and PostgreSQL trigram search
- Additional implementation details live in `documentation.md` and `docs/database-guide.md`

This file provides guidance to Claude Code when working in this repository.

## Stack Snapshot

Use the stack already present in the repository unless the task explicitly requires a change.

- Next.js 15 App Router with React 19
- TypeScript with strict checking
- Tailwind CSS 4
- shadcn/ui with Radix primitives
- Supabase for backend data and auth flows
- React Hook Form with Zod
- Recharts for charts
- Playwright for end-to-end testing
- `@react-pdf/renderer` for PDF generation

Notable repo details:
- React Compiler is enabled in `next.config.ts`
- Playwright currently runs the `setup` project plus Chromium by default
- External image `remotePatterns` are not currently configured in `next.config.ts`

## Development Commands

- `npm run dev` - start the development server on `http://localhost:3000`
- `npm run build` - build the production application
- `npm run start` - start the production server
- `npm run lint` - run ESLint
- `npm run typecheck` - run TypeScript type checking
- `npm run test` - run Playwright tests
- `npm run validate:nutrients` - run nutrient math validation
- `npm run etl:bls` - import BLS data into Supabase
- `npm run etl:verify:bls` - verify imported BLS row counts
- `npm run etl:reference-values` - import DGE reference values
- `npm run etl:recipes` - import shared recipes and meal plan templates
- `npm run etl:off` - import Open Food Facts data

## Hard Rules

- Use TypeScript, not plain JavaScript, for new application code.
- Prefer existing repo patterns and utilities over introducing new libraries.
- Do not add non-shadcn primitives into `components/ui/`.
- Keep changes narrow and task-focused; do not refactor unrelated areas unless explicitly requested.
- Preserve existing user changes. Do not overwrite or revert work you did not make.
- Do not expose secrets through `NEXT_PUBLIC_` variables.
- If a task requires schema, migration, auth, or shared contract changes, inspect the relevant implementation and docs first.

## Change Discipline

Before editing:
- Read the surrounding file and nearby patterns first.
- Check whether the same problem is already solved elsewhere in the codebase.
- Prefer extending an existing abstraction over creating a parallel pattern.

While editing:
- Make the smallest change that fully solves the task.
- Avoid broad renames, formatting churn, and opportunistic cleanups.
- Keep naming, file layout, and component structure consistent with adjacent code.
- Call out tradeoffs if the requirement is ambiguous or would force a larger architectural choice.

## Validation

Validate in proportion to the size and risk of the change.

For small copy or local UI changes:
- Run the cheapest relevant check, usually `npm run lint` or a targeted manual inspection

For logic, data flow, or TypeScript changes:
- Run `npm run typecheck`
- Run targeted tests when they cover the changed behavior

For routing, auth, exports, data persistence, shared hooks, or cross-cutting UI changes:
- Run `npm run lint`
- Run `npm run typecheck`
- Run relevant Playwright tests
- Run `npm run build` when the change is broad enough to justify it

Use the smallest reliable test layer:
- prefer direct logic validation for pure transformations
- prefer integration-style verification for data and state flow
- use Playwright for real user workflows and regressions

If a check is too expensive, blocked by environment, or unavailable, say so explicitly in the final handoff.

If unrelated tests fail, stop and report the failure instead of “fixing” unrelated breakage unless asked.

## Project Map

- `app/` - App Router routes, layouts, and server/client entry points
- `components/` - feature components
- `components/ui/` - shadcn/ui primitives and wrappers
- `hooks/` - reusable React hooks
- `lib/data/` - data access and client-side repository helpers
- `lib/supabase/` - Supabase client, server, and middleware utilities
- `lib/types/` - shared domain types
- `lib/mock-data/` - mock and seed-like local data sources
- `lib/exports/` - PDF, CSV, and export job logic
- `lib/search/` - search implementation details
- `supabase/` - config, seed data, and migrations
- `scripts/etl/` - ETL and import scripts
- `tests/` - Playwright tests
- `docs/` - product and database documentation

## Environment Variables

- Server-only variables should not use the `NEXT_PUBLIC_` prefix.
- Client-visible variables must use `NEXT_PUBLIC_`.
- Store local development variables in `.env.local`.
- Document required variables in `.env.example` when applicable.

## Reference Docs

- Read `documentation.md` for route, feature, and data-flow context.
- Read `docs/database-guide.md` before changing Supabase schema, nutrition data flows, ETL logic, or reference value handling.
- Read `README.md` for current product capabilities and setup notes.
