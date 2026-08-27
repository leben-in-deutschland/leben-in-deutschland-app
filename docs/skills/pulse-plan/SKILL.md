---
name: pulse-plan
description: Create or update a PULSE work plan with context, ordered steps, acceptance criteria, verification, and a safe rollback plan. Use before non-trivial implementation, migration, integration, or framework work.
---

# PULSE Plan

Create a plan that another developer or agent can execute without reconstructing
the task from chat history.

## Procedure

1. Read `AGENTS.md`, relevant context, architecture, decisions, features, and memory.
2. State the concrete outcome, boundaries, assumptions, and known unknowns.
3. Capture the baseline Git/system state.
4. Break work into ordered, testable steps.
5. Define measurable acceptance criteria.
6. List existing verification commands or manual checks. Do not invent checks.
7. Add a rollback plan with:
   - exact trigger
   - narrow reversal
   - dependency/data/deployment safety
   - recovery verification
8. Record dependencies between steps when order matters.
9. Store non-trivial plans under `docs/plans/` using `_template.md`.
10. Do not implement unless the user explicitly asks for implementation.

Canonical template:
<https://github.com/manishtiwari25/pulse/blob/main/docs/plans/_template.md>

## Quality Bar

The plan is ready only when the goal, next executable step, success evidence,
and safe recovery path are all clear.
