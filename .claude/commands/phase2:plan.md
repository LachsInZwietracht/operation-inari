---
description: Creates a structured implementation plan without changing code
---

# Planning Phase

Use this phase to turn a clarified idea into an implementation-ready plan.

## Setup

- !`rm -f .agent/phase/plan.md`

## Grounding

- Read `AGENTS.md` and `docs/README.md`.
- Read `.agent/phase/brainstorm.md` if it exists.
- Inspect relevant code and docs before asking questions that the repo can answer.
- Do not implement code in this phase.

## Planning Goals

- Define the user story, scope, non-goals, data flow, UI/API changes, edge cases, and acceptance criteria.
- Identify relevant existing patterns and docs.
- Recommend new dependencies only when existing stack cannot reasonably solve the problem.
- Use proportional validation from `AGENTS.md`; do not default every change to full E2E.

## Required Plan Content

- Summary and user outcome.
- Implementation changes grouped by subsystem.
- Public API, type, schema, environment, or migration changes.
- Edge cases and failure modes.
- Test and verification plan.
- Explicit assumptions and deferred work.

## End Of Phase

Write `.agent/phase/plan.md` with the complete plan. Then tell the user they can run `/phase3:work` to implement it.
