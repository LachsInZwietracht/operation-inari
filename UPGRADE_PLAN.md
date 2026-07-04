# UPGRADE_PLAN.md — Inari Codebase Upgrade

Surveyed 2026-07-04 on `main` (31d8257) in `~/Developer/Inari` (the canonical working copy — the Dropbox copy is deprecated).

## Phase 0 findings — state of the repo

**The stack is already modern.** Next.js 16.2, React 19.2 with React Compiler, TypeScript 6 (strict, 0 errors), Tailwind 4, Zod 4, Supabase SSR. No deprecated majors except ESLint 9→10. This is not a "rescue an old codebase" job — it's targeted fixes.

**Baseline health:**
- `typecheck`: passes, 0 errors.
- `lint`: 0 errors, 84 warnings — and 47 of them are React Compiler diagnostics pointing at real runtime problems (41× "setState synchronously within an effect → cascading renders", 6× "impure function during render").
- Tests: 25 Playwright specs, but two suites have known pre-existing failures on main: `patients.spec.ts` (11 — stale tab expectations after the workflow-tab simplification) and `meal-plan.spec.ts` (7 — slots only render with a selected patient).
- Prod speed baselines (measured 2026-07-03): most routes 0.6–1.5s; `/ernaehrungsplan` 4.6s cold; `/rezepte` transfers ~1 MB (Unsplash images via CSS `background-image`, no optimization); middleware does a network `auth.getUser()` on every navigation.
- Big-file hot spots: `components/patient-tabs.tsx` (2,215 lines), 23 hooks duplicating the same localStorage→Supabase sync/migrate pattern (~7,700 lines across `hooks/`).

## Ranked plan

Phase 1 = correctness, Phase 2 = performance. Every perf item ships with a before/after number.

### Phase 1 — Correctness

| # | Change | Tag | Risk | Notes |
|---|--------|-----|------|-------|
| 1 | Repair the two stale test suites (`patients.spec.ts`, `meal-plan.spec.ts`) so the suite is green and can gate everything after | [correctness] | low | Test-only; restores the safety net first |
| 2 | Dependency bumps: all patch/minor (Radix, Supabase, Next 16.2.10, Playwright, recharts…) + ESLint 10 major | [correctness] | low | One commit for minors, one for ESLint 10 config migration |
| 3 | Fix the 6 "impure function during render" warnings (nondeterministic renders — `Date.now`/`Math.random` in render paths) | [correctness] | low–med | Real bugs; each fix verified against the owning component's spec |
| 4 | Fix the 41 "setState synchronously in effect" warnings | [both] | med | Cascading re-renders: correctness smell + measurable render cost. Do file-by-file, not a blanket sweep |
| 5 | Lint hygiene: 14 `no-explicit-any`, unused vars, 2 exhaustive-deps | [correctness] | low | Proper types, no suppressions |

### Phase 2 — Performance

| # | Change | Tag | Risk | Measurement |
|---|--------|-----|------|-------------|
| 6 | `/rezepte` images: replace CSS `background-image` with `next/image` + Unsplash remotePattern (auto-resize/WebP) | [performance] | low | Transfer size before/after (~1 MB baseline) |
| 7 | `/ernaehrungsplan` cold load: scope the foods RPC to the **active** plan, lazy-load the rest | [performance] | med | 4.6s cold baseline. **Needs your explicit OK — you deferred this option on 2026-07-03** |
| 8 | Middleware: replace per-navigation network `auth.getUser()` with local JWT verification (`getClaims`) | [performance] | med | Per-navigation TTFB; auth-touching, so extra review + full test run |
| 9 | Extract one generic synced-collection hook; migrate the 23 copy-paste localStorage→Supabase hooks onto it | [both] | high | Biggest dedupe (~7,700 lines shrink); migrate 2–3 hooks per PR with tests, not all at once |
| 10 | Split `components/patient-tabs.tsx` (2,215 lines) the way the Ernährungsplan split worked (PR #21) | [both] | med | Hydration cost + the 14 "memoization not preserved" compiler skips |

### Deferred / not worth it now

- The 7 remaining `use client` pages are mostly forms (patient create/edit, counseling) — little data to server-load; skip unless one shows up slow.
- `lib/mock-data` trim: only 3 app imports left, ETL/tests still depend on it; low value, nonzero risk.

## Working rules for this job

- All work in `~/Developer/Inari`, branch-then-PR, never push to main (Vercel deploys from PRs on LachsInZwietracht's account).
- Small commits, one logical change each; build + tests after every phase.
- Fable model only, per your standing instruction.
- Items 7 and 8 stop for your approval before implementation regardless.
