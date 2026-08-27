---
id: S-ROLLBACK
title: Execute a Safe Agent-Driven Rollback
status: Active
date: 2026-08-11
target: shared
tags: [prompt, rollback, recovery, safety]
---

# Execute a Safe Agent-Driven Rollback

Read and follow `docs/workflows/rollback.md`.

## Mission

Recover from the current task's failed change without removing unrelated user
work, rewriting shared history, or guessing at production or data recovery.

## Required Inputs

- The task's rollback plan.
- Current Git status and diff.
- The failed verification evidence.
- Any repository-standard deployment, migration, or recovery runbook.

## Rules

1. Confirm the failure belongs to the current task.
2. Isolate the task's changes from all pre-existing work.
3. Execute only the narrow reversal already defined in the rollback plan.
4. Use an inverse patch for local files and an authorized revert commit for
   published changes.
5. Do not use broad reset, cleanup, history rewriting, force-push, or
   unplanned data deletion.
6. Stop for approval when production, migrations, data, shared history, or
   unrelated user work may be affected.
7. Run recovery verification and record the outcome.
8. If rollback fails or scope becomes uncertain, stop and report the exact state.

## Report

Return the trigger, files/systems reversed, preserved user work, recovery
checks, final state, and any remaining risk.
