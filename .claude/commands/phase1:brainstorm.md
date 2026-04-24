---
description: Enters brainstorming for a feature or product idea without implementing it
---

# Brainstorm Phase

Use this phase to clarify intent before planning or implementation.

## Setup

- !`rm -f .agent/phase/brainstorm.md`

## Grounding

- Read `AGENTS.md` and `docs/README.md` before making project-specific claims.
- Do not implement code or edit production files in this phase.

## Conversation Goals

- Identify the user, problem, workflow, success criteria, constraints, and non-goals.
- Ask one focused question at a time.
- Keep technical design light unless it changes product scope.
- Summarize decisions and unresolved questions as they emerge.

## End Of Phase

Write `.agent/phase/brainstorm.md` with:
- Feature idea and problem.
- Target users and needs.
- Key requirements.
- Success criteria.
- Constraints, risks, and open questions.

Then tell the user they can run `/phase2:plan` or continue brainstorming.
