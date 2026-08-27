---
name: pulse-rollback
description: Execute a safe, scoped, and verified rollback for the current task. Use when a change fails verification, creates a regression, or reaches a trigger in its rollback plan.
---

# PULSE Rollback

Restore a known-good state without removing unrelated work or guessing at
high-risk recovery.

## Procedure

1. Confirm the rollback trigger and prove the current task caused the failure.
2. Read the prepared rollback plan.
3. Inspect Git status/diff and identify all pre-existing user work.
4. Isolate only the current task's files, dependencies, generated output,
   commits, deployments, migrations, data, and external state.
5. Choose the safe recovery path:
   - precise inverse patch for local files
   - prior manifest/lockfile plus the existing package manager for dependencies
   - authorized revert commit for published history
   - tested runbook for deployments, migrations, data, or external state
6. Stop for approval when production, data, shared history, or unrelated user
   work could be affected.
7. Never use broad reset, cleanup, history rewriting, force-push, or unplanned deletion.
8. Execute the narrow reversal and stop after any unexpected result.
9. Run recovery checks and confirm the baseline behavior is restored.
10. Record trigger, reversal, verification, final state, and remaining risk.

Canonical workflow:
<https://github.com/manishtiwari25/pulse/blob/main/docs/workflows/rollback.md>

If scope is uncertain or recovery fails, stop and report the exact state.
