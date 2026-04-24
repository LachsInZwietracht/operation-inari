# Documentation Index

Use this file to decide which documentation to read before editing. Do not load every long document by default.

## Source Of Truth

1. Code, migrations, tests, and package files are authoritative.
2. `documentation.md` maps implemented routes, components, hooks, and workflows.
3. `docs/database-guide.md` explains Supabase, ETL, food data, search, and schema architecture.
4. `docs/product-requirements.md` captures product direction and roadmap intent.
5. `docs/competitive-audit.md` captures market and competitor strategy.

When docs conflict with code, inspect the implementation and update the stale doc if the task changes documented behavior.

## Read This Before Editing

| Task area | Read first | Notes |
|---|---|---|
| App routes, workflows, components, hooks | `documentation.md` | Use as a map, then verify code. |
| Supabase schema, RLS, migrations, ETL, food data | `docs/database-guide.md` | Migrations remain the schema source of truth. |
| Product scope, roadmap, prioritization | `docs/product-requirements.md` | Product intent, not implementation proof. |
| Competitor positioning or clinic strategy | `docs/competitive-audit.md` | Strategy input only. |
| Supabase local/deploy workflow | `.agent/docs/supabase.md` | Agent playbook; verify against package scripts. |
| Billing/subscription work | `.agent/docs/billing.md` | Billing is preview-only unless code proves otherwise. |
| Claude phase commands | `.claude/commands/*` | Workflow prompts for Claude Code sessions. |

## Documentation Roles

- `README.md` - setup, high-level capabilities, and key operational notes.
- `AGENTS.md` - canonical AI-agent instructions for all coding tools.
- `CLAUDE.md` - Claude wrapper that imports `AGENTS.md`.
- `GEMINI.md` - Gemini wrapper that imports `AGENTS.md`.
- `AGENT.md` - compatibility pointer only.
- `documentation.md` - feature implementation guide.
- `docs/database-guide.md` - database, ETL, nutrition data, search, and performance guide.
- `docs/product-requirements.md` - roadmap and requirements direction.
- `docs/competitive-audit.md` - April 2026 competitor and gap audit.
- `docs/debinet-import.md` - planning notes for a future DEBInet import workflow.

## Maintenance Rules

- Keep agent memory files short and operational; move deep details into scoped docs.
- Add or update docs in the same change when behavior, schema, commands, environment variables, or product truth changes.
- Mark planned or preview features clearly. Do not describe mock/demo behavior as production.
- Avoid duplicating long technical sections across files; link to the authoritative doc instead.
