---
name: pulse-feature
description: Define and deliver a feature through the PULSE lifecycle, including specification, decisions, implementation planning, verification, rollback, and learning. Use for new user or system behavior.
---

# PULSE Feature

Carry a feature from desired behavior to verified delivery without losing its
reasoning or recovery path.

## Procedure

1. Read context, architecture, accepted decisions, related features, and memory.
2. Create or update a feature spec from `docs/features/_template.md`.
3. Define user story, functional/non-functional requirements, scope, interfaces,
   data changes, edge cases, acceptance criteria, and rollback strategy.
4. Create ADRs only for real choices.
5. Create a PULSE work plan for non-trivial implementation.
6. Generate an implementation prompt when handoff or sequencing benefits from it.
7. Implement only after explicit user authorization.
8. Reuse repository patterns and keep changes within the specified boundary.
9. Run the real targeted verification.
10. If the change cannot be made safe, invoke the `pulse-rollback` procedure.
11. Record durable lessons and update the feature status.

Canonical workflow:
<https://github.com/manishtiwari25/pulse/blob/main/docs/workflows/new-feature.md>

## Completion

The feature is complete only when behavior, evidence, control-plane records,
and rollback readiness agree.
