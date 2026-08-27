# Workflow - Agent-Driven Rollback

Use this procedure when a change made by the current task fails verification,
creates a regression, or reaches another trigger named in its rollback plan.

## 1. Confirm the Trigger

- Reproduce the failed check or unsafe condition.
- Confirm the failure is caused by the current task rather than pre-existing work.
- Record the evidence that activated the rollback.

Do not roll back a valid change merely to hide an unrelated failure.

## 2. Re-read the Baseline and Scope

- Read the task's rollback plan.
- Inspect the current Git status and diff.
- Identify pre-existing user changes and exclude them.
- Identify dependencies, generated files, deployments, migrations, and
  external state affected by the task.

If the task cannot be isolated, stop and request guidance.

## 3. Choose the Safe Recovery Path

| Surface | Preferred recovery |
| --- | --- |
| Uncommitted files | Apply a precise inverse patch for the current task. |
| Dependencies | Restore the prior manifest and lockfile, then use the existing package manager. |
| Generated files | Regenerate from the restored source using the repository's existing command. |
| Published commit | Create an authorized `git revert` commit. |
| Deployment | Use the tested release rollback mechanism in the existing runbook. |
| Migration or data | Use the tested down/restore procedure with required approval. |
| External integration | Use the provider's documented reversible action or stop. |

Never use broad reset, cleanup, history rewriting, force-push, or unplanned
data deletion.

## 4. Execute Narrowly

1. Reverse only artifacts introduced or changed by the current task.
2. Preserve unrelated and pre-existing user work.
3. Stop after the first unexpected result.
4. Keep evidence of commands, patches, deployment versions, or runbook steps used.

## 5. Verify Recovery

- Run the recovery checks from the rollback plan.
- Confirm the original failed behavior is gone.
- Confirm the baseline behavior is restored.
- Inspect Git status and diff for unrelated changes.
- For deployed or persisted state, confirm the known-good version or health signal.

A rollback is not successful merely because the new change disappeared.

## 6. Record and Learn

Record:

- Trigger and root cause.
- Reversal steps executed.
- Recovery checks and results.
- Any remaining risk or manual follow-up.
- A durable lesson in `docs/memory/` when it should change future work.

If recovery fails, stop and report the exact current state. Do not loop through
additional speculative rollback attempts.
