---
description: Ends the current phase and writes the appropriate summary
---

# End Phase

Determine the active phase from the conversation and complete that phase's end instructions.

Write the appropriate file under `.agent/phase/`:
- Brainstorming: `brainstorm.md`
- Planning: `plan.md`
- Work: `summary.md`

Then report what was written, what remains open, and the recommended next phase.
