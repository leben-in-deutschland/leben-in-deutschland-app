---
name: pulse-decision
description: Create a PULSE architecture decision record with context, realistic options, tradeoffs, a chosen decision, consequences, and follow-up. Use for durable product, architecture, workflow, safety, or framework choices.
---

# PULSE Decision

Record why a durable choice was made, not only what was chosen.

## Procedure

1. Read existing decisions, architecture, context, memory, and affected feature specs.
2. Write the decision question and the pressure that makes it necessary.
3. Compare realistic options, including doing nothing when relevant.
4. Explain meaningful benefits, risks, reversibility, and operational impact.
5. Choose one option and state why it best fits current evidence.
6. Define consequences and follow-up work.
7. Define the inverse documentation edit before changing control-plane files.
8. Create the ADR from `docs/decisions/_template.md`.
9. Update architecture, context, features, or memory only when the decision changes them.
10. Validate links and consistency. Roll back only this decision's edits if needed.

Canonical workflow:
<https://github.com/manishtiwari25/pulse/blob/main/docs/workflows/decision.md>

## Do Not

- Invent facts to make one option look stronger.
- Create an ADR for a trivial implementation detail.
- Delete an older accepted decision; supersede it visibly.
