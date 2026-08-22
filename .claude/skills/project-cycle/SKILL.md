---
name: project-cycle
description: "Run one explicit Operation Prodi project phase: brainstorm, plan, work, load, end, or reset."
argument-hint: "[brainstorm|plan|work|load|end|reset]"
disable-model-invocation: true
---

# Project Cycle

Requested phase: `$ARGUMENTS`

This is an optional manual workflow. The user invokes it with, for example,
`/project-cycle brainstorm` or `/project-cycle work`. `AGENTS.md` remains the
canonical project contract.

## Rules For Every Phase

- Read `AGENTS.md` and `docs/README.md` before making project-specific claims.
- Preserve unrelated user changes.
- Inspect the relevant code and documentation before asking questions the
  repository can answer.
- Keep handoff files under `.agent/phase/`; they are local scratch files and are
  intentionally gitignored.
- Never delete or replace an existing handoff file merely because a new phase
  started. Read it first and preserve useful context. If it appears to belong to
  another active cycle, ask before replacing it.
- If the requested phase is missing or unknown, explain the available phases
  and stop without editing files.

## `brainstorm`

- Clarify the user, problem, workflow, success criteria, constraints, risks,
  and non-goals.
- Ask focused questions and keep technical design light unless it changes scope.
- Do not implement code or edit production files.
- When the phase is complete, write or update `.agent/phase/brainstorm.md` with
  the decisions and open questions.

## `plan`

- Read `.agent/phase/brainstorm.md` when it exists.
- Inspect the relevant implementation and turn the agreed idea into an
  implementation-ready plan.
- Cover scope, non-goals, data flow, UI/API/schema changes, edge cases,
  acceptance criteria, and proportional validation.
- Do not implement code.
- When complete, write or update `.agent/phase/plan.md`.

## `work`

- Read `.agent/phase/plan.md` when it exists.
- Implement the current user request using the narrowest complete change and
  the existing project patterns.
- Apply the proportional validation rules from `AGENTS.md` and report blocked
  checks rather than inventing results.
- Update project documentation when behavior, schema, commands, environment,
  or product truth changes.
- When complete, write or update `.agent/phase/summary.md` with the outcome,
  important files, validation, limitations, and follow-up work.

## `load`

- Read `.agent/phase/summary.md` when it exists.
- Summarize what was built, the important architecture decisions, validation,
  known limitations, and likely integration points.
- Do not implement code or change production files.

## `end`

- Determine the active phase from the conversation.
- Complete that phase's handoff file without discarding useful existing context.
- Report what was written, what remains open, and the sensible next phase.

## `reset`

- Treat this explicit invocation as authorization to remove only these scratch
  files when present: `.agent/phase/brainstorm.md`, `.agent/phase/plan.md`, and
  `.agent/phase/summary.md`.
- Do not remove implementation files or any other agent memory.
- Report exactly which scratch files were removed.
