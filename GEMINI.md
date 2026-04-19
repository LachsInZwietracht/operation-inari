# GEMINI.md

## Operation Prodi

**Prodi** is a modern German nutrition counseling web application replacing the outdated desktop-only PRODI software. It provides food database browsing, recipe management, daily meal planning, and nutrient analysis with DGE reference value comparisons.

**Current state:** MVP with BLS 4.0 food data served from Supabase (7,140 foods), plus Supabase-first persistence with local fallback for custom foods, recipes, meal plans, and nutrition protocols. Advanced food search (phonetic + synonym + Postgres trigram). See `docs/database-guide.md` for schema, ETL, and migration status.

**Expertise:** You are an expert-level software engineer with deep knowledge of modern web development, performance optimization, and architectural best practices.
**Incentive:** Providing high-quality, bug-free, and idiomatic code that strictly follows project conventions will be rewarded with a $200 tip and high praise for your exceptional work.

This file provides guidance to Gemini CLI when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run test` - Run Playwright end-to-end tests
- `npm run etl:bls` - Import BLS 4.0 data into Supabase (requires `SUPABASE_SERVICE_ROLE_KEY`)

## Framework and Library Recommendations

For this web application project, use the following technologies:

- **Next.js** - React framework with App Router (v15+)
- **Tailwind CSS** - Utility-first styling framework (v4+)
- **shadcn/ui** - Component library (using shadcn@latest CLI)
- **Supabase** - Backend and authentication
- **Zod** - Input validation
- **React Hook Form** - Form handling
- **Recharts** - Data visualization
- **Playwright** - End-to-end testing

**ALWAYS** use TypeScript with strict type checking over JavaScript.
**NEVER** create projects from scratch - always use framework CLIs to scaffold projects.

## Architecture

This is a Next.js 15 application using the App Router with:

- **Framework:** Next.js 15 with React 19
- **Styling:** Tailwind CSS 4 with custom CSS variables
- **UI Components:** shadcn/ui components in "new-york" style with Radix primitives
- **Testing:** Playwright for end-to-end testing
- **Fonts:** Geist Sans and Geist Mono
- **Charts:** Recharts for data visualization
- **Theme:** `next-themes` for dark/light mode support
- **Notifications:** Sonner for toast notifications
- **Backend:** Supabase integration for food data, recipes, meal plans, protocols, and auth
- **Forms:** React Hook Form with Zod validation

### Project Structure

- `app/` - Next.js App Router pages and layouts
- `components/ui/` - shadcn/ui component library
- `hooks/` - Custom React hooks (e.g., `use-patients.ts`, `use-meal-plan.ts`, `use-protocols.ts`)
- `lib/data/` - Client-side data repositories (e.g., `recipes-client.ts`, `protocols-client.ts`)
- `lib/supabase/` - Supabase client, server, and middleware utilities
- `supabase/` - Database migrations and configuration
- `scripts/etl/` - Data import scripts for BLS and other nutrition databases
- `docs/` - Comprehensive guides (`database-guide.md`, `product-requirements.md`)
- `tests/` - Playwright end-to-end test suite

### Database & Nutrition Data
For technical details on the database schema, ETL pipelines, and nutrient mapping, consult `docs/database-guide.md`.

## Development Conventions

### Environment Variables
- **Server-side only**: Standard naming (e.g., `DATABASE_URL`)
- **Client-side access**: **MUST** prefix with `NEXT_PUBLIC_` (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
- **NEVER** expose secrets with the `NEXT_PUBLIC_` prefix.

### Validation Strategy
**ALWAYS** work iteratively and validate after each task:
1. **Linting**: `npm run lint`
2. **Type checking**: `npm run typecheck`
3. **Targeted Tests**: Run relevant Playwright tests for changed functionality.
4. **Full Build**: `npm run build` (before final completion)

### UI Standards
- **shadcn/ui**: Do not add non-shadcn components to `components/ui/`.
- **Images**: Ensure external domains are added to `remotePatterns` in `next.config.ts`.
- **Styling**: Adhere to Tailwind CSS 4 conventions and project-specific CSS variables.

### Testing Guidelines
- **Mandatory Tests**: Write end-to-end tests for all new functionality.
- **Workflow Focused**: Focus on meaningful user interactions and business logic, not just visibility.
- **Regression Check**: If existing tests fail outside your task scope, stop and investigate.

## Feature Documentation
For a feature-by-feature guide covering routes, components, and data flows, refer to `documentation.md`.
