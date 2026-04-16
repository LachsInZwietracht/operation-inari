# CLAUDE.md

## Operation Prodi

**Prodi** is a modern German nutrition counseling web application replacing the outdated desktop-only PRODI software. It provides food database browsing, recipe management, daily meal planning, and nutrient analysis with DGE reference value comparisons.

**Current state:** MVP with BLS 4.0 food data served from a hosted Supabase project (7,140 foods, 265k nutrient values, 2,268 DGE reference values). Supabase-first persistence with local fallback for custom foods, recipes, meal plans, and nutrition protocols. Advanced food search (phonetic + synonym + Postgres trigram). See `docs/database-guide.md` for schema, ETL, and migration status.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run test` - Run Playwright end-to-end tests
- `npm run etl:bls` - Import BLS 4.0 data into Supabase (requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
- `npm run etl:verify:bls` - Verify BLS import row counts
- `npm run etl:reference-values` - Import DGE reference values
- `npm run etl:recipes` - Import shared recipes and meal plan templates

## Framework and Library Recommendations

For this web application project, use the following technologies:

- Next.js - React framework with App Router
- Tailwind CSS - Utility-first styling framework
- shadcn/ui - Component library (using shadcn@latest CLI)
- Supabase - Backend and authentication
- Zod - Input validation
- React Hook Form - Form handling
- React Query - Data fetching and caching
- polar.sh - Payment processing (see https://docs.polar.sh/integrate/sdk/adapters/nextjs for setup)
- Playwright - End-to-end testing

**ALWAYS** use TypeScript with strict type checking over JavaScript.
**NEVER** create projects from scratch - always use framework CLIs to scaffold projects.

## Architecture

This is a Next.js 15 application using the App Router with:

- Framework: Next.js 15 with React 19
- Styling: Tailwind CSS 4 with custom CSS variables
- UI Components: shadcn/ui components in "new-york" style with Radix primitives
- Testing: Playwright for end-to-end testing
- Fonts: Geist Sans and Geist Mono from Google Fonts
- Charts: Recharts for data visualization
- Theme: next-themes for dark/light mode support
- Notifications: Sonner for toast notifications
- Backend: Supabase integration configured
- Forms: React Hook Form with Zod validation
- Additional Libraries: Embla Carousel, Command Menu (cmdk), Date handling (date-fns)

### Project Structure

- `app/` - Next.js App Router pages and layouts
- `components/ui/` - Complete shadcn/ui component library including accordion, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, carousel, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, tooltip, and more
- `hooks/` - Custom React hooks (e.g., `use-mobile.ts` for responsive design)
- `lib/utils.ts` - Utility functions including Tailwind class merging
- `supabase/` - Supabase configuration, migrations, and seed data
- `supabase/migrations/` - Database schema migrations (run in order)
- `scripts/etl/` - ETL scripts for importing external nutrition databases
- `data/` - Raw data files (BLS, OFF, etc.) — gitignored, not committed
- `docs/` - Project documentation including `database-guide.md`
- `tests/` - Playwright test files
- `public/` - Static assets

### shadcn/ui Configuration

Components are configured with:
- Style: "new-york"
- Base color: neutral
- CSS variables enabled
- Icon library: lucide-react
- Path aliases: `@/components`, `@/lib/utils`, etc.

### Playwright Configuration
- Tests run against all major browsers (Chrome, Firefox, Safari)
- Base URL: http://localhost:3000
- Auto-starts dev server if not running, reuses existing server if available
- 2-minute timeout for server startup

## Environment Variables

When working with environment variables in Next.js:

- **Server-side only**: Use standard naming (e.g., `DATABASE_URL`, `API_SECRET`)
- **Client-side access**: **MUST** prefix with `NEXT_PUBLIC_` (e.g., `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`)
- Environment variables without the `NEXT_PUBLIC_` prefix are **NOT** available in the browser
- **NEVER** expose sensitive data (API keys, secrets) with `NEXT_PUBLIC_` prefix
- Store environment variables in `.env.local` for local development
- Use `.env.example` to document required environment variables

## Validation Strategy

**ALWAYS** work iteratively and validate your work after finishing each task by following these steps in order:

### Quick Validation Steps (run for each task)
1. **Linting**: `npm run lint` - Check for syntax and style issues
2. **Type checking**: `npm run typecheck` - Ensure TypeScript correctness    
3. **Specific tests**: Run only relevant Playwright tests for changed functionality. If you implemented new functionality, write tests for it and run them.

### Complete Validation (run only after all tasks are complete)
4. **Build**: `npm run build` - Full production build verification
5. **Complete test suite**: `npm run test` - All Playwright end-to-end tests

### Testing Guidelines
- **ALWAYS** write tests for new functionality - this is required for validation
- Write realistic e2e tests from a user perspective focusing on actual interactions
- **NEVER** write trivial tests that only assert component visibility
- Focus on meaningful user workflows and business logic
- If existing tests fail that are not part of the current task, **STOP** and ask for guidance
- Do NOT auto-fix unrelated test failures
- If tests fail without a clear reason, use playwright mcp to debug the test in a real browser

## Feature Documentation

For a comprehensive feature-by-feature guide covering routes, components, hooks, data flows, and extension notes, see [`documentation.md`](./documentation.md). Consult it when working on unfamiliar areas or tracing data through the app.

## Database & Nutrition Data

For everything related to the nutrition database layer — schema design, available datasets, ETL pipelines, nutrient ID mappings, migration strategy, and search architecture — see [`docs/database-guide.md`](./docs/database-guide.md). Consult it when working on Supabase tables, food data imports, or the mock-to-real-data migration.

# General
- Don't add any components that are not part of the shadcn library to components/ui
- If you add images from the internet, make sure that the domain is allowed in remotePatterns in next.config.ts
