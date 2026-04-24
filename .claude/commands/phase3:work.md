---
description: Implements the planned feature with scoped validation
---

# Work Phase

This is the implementation phase.

## Setup

- !`rm -f .agent/phase/summary.md`

## Grounding

- Read `AGENTS.md` and `docs/README.md`.
- Read `.agent/phase/plan.md` if it exists.
- Inspect relevant code and docs before editing.
- Use TodoWrite for multi-step work.

## Implementation Rules

- Keep changes scoped to the plan and current user request.
- Follow existing patterns before adding abstractions or dependencies.
- Preserve user changes and do not fix unrelated failures unless asked.
- Update docs when behavior, schema, commands, public contracts, or product truth changes.

## Validation

Use proportional validation from `AGENTS.md`:
- Docs-only: Markdown/search inspection.
- TypeScript/logic: `npm run typecheck` and targeted checks.
- Routing/auth/exports/persistence/shared workflows: `npm run lint`, `npm run typecheck`, and relevant Playwright tests.
- Broad app changes: add `npm run build`.
- Nutrient math or food/reference data: add `npm run validate:nutrients`.

## End Of Phase

Write `.agent/phase/summary.md` with:
- What changed and why.
- Key files modified.
- Validation completed and any blocked checks.
- Known limitations or follow-up work.

Then provide a concise user-facing handoff.
