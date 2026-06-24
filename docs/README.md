# Documentation Index

Use this file to decide which documentation to read before editing. Do not load every long document by default.

## Top Priority

`docs/user-priority-feedback.md` is the current **#1 product guideline** — direct PRODI-user feedback on what the software must do. Align prioritization with it before other roadmap inputs.

## Source Of Truth

1. Code, migrations, tests, and package files are authoritative.
2. `documentation.md` maps implemented routes, components, hooks, and workflows.
3. `docs/database-guide.md` explains Supabase, ETL, food data, search, and schema architecture.
4. `docs/competitive-audit.md` captures market and competitor strategy.

When docs conflict with code, inspect the implementation and update the stale doc if the task changes documented behavior.

## Read This Before Editing

| Task area | Read first | Notes |
|---|---|---|
| Current #1 product priority and acceptance lens | `docs/user-priority-feedback.md` | Direct PRODI-user requirements; align all prioritization here first. |
| App routes, workflows, components, hooks | `documentation.md` | Use as a map, then verify code. |
| Clinic demo path and hardening priorities | `docs/clinic-demo-runbook.md` | Repeatable buyer-demo path from intake to kitchen; includes open demo risks. |
| Supabase schema, RLS, migrations, ETL, food data | `docs/database-guide.md` | Migrations remain the schema source of truth. |
| Competitor positioning or clinic strategy | `docs/competitive-audit.md` | Strategy input only. |
| Clinic IT integrations: LDAP/AD, HL7, FHIR | `docs/clinic-it-integration-plan.md` | P1 integration contracts and implementation boundaries. |
| Supabase local/deploy workflow | `.agent/docs/supabase.md` | Agent playbook; verify against package scripts. |
| Public repository release | `docs/public-release.md` | Clean-snapshot release process, security settings, and history warning. |
| Billing/subscription work | `.agent/docs/billing.md` | Billing is preview-only unless code proves otherwise. |
| Claude phase commands | `.claude/commands/*` | Workflow prompts for Claude Code sessions. |

## Documentation Roles

- `README.md` - setup, high-level capabilities, and key operational notes.
- `AGENTS.md` - canonical AI-agent instructions for all coding tools.
- `CLAUDE.md` - Claude wrapper that imports `AGENTS.md`.
- `GEMINI.md` - Gemini wrapper that imports `AGENTS.md`.
- `AGENT.md` - compatibility pointer only.
- `docs/user-priority-feedback.md` - current #1 product guideline from a PRODI user; primary prioritization lens.
- `documentation.md` - feature implementation guide.
- `docs/clinic-demo-runbook.md` - repeatable clinic-first demo path and demo-hardening checklist.
- `docs/database-guide.md` - database, ETL, nutrition data, search, and performance guide.
- `docs/competitive-audit.md` - April 2026 competitor and gap audit.
- `docs/clinic-it-integration-plan.md` - LDAP/AD mapping, HL7 MVP, and first FHIR sync boundary.

## Maintenance Rules

- Keep `README.md` stable and short: setup, capability summary, and links only. Do not use it as a running changelog.
- Keep route/component behavior in `documentation.md`; keep schema, migrations, ETL, food data, search RPCs, and performance details in `docs/database-guide.md`.
- Keep product-priority status in `docs/user-priority-feedback.md`, but link implementation details to `documentation.md` or `docs/database-guide.md`.
- Keep clinic integration contracts in `docs/clinic-it-integration-plan.md`; other docs should summarize status and link there.
- Keep agent memory files short and operational; move deep details into scoped docs.
- Add or update docs in the same change when behavior, schema, commands, environment variables, or product truth changes.
- Mark planned or preview features clearly. Do not describe mock/demo behavior as production.
- Avoid duplicating long technical sections across files; link to the authoritative doc instead.
