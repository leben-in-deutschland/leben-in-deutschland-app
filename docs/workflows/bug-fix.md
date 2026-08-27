# Workflow - Bug Fix

1. Reproduce or understand the bug from available evidence.
2. Read relevant context, decisions, features, and memory.
3. Decide whether the bug reveals a documentation, architecture, or product-rule gap.
4. Create a plan when the fix is non-trivial.
5. Define the rollback baseline, trigger, reversal steps, state-safety notes,
   and recovery checks before editing.
6. Implement only the requested fix.
7. Verify with focused tests or manual checks.
8. If the fix cannot be made safe within scope, follow
   [`rollback.md`](rollback.md) and verify recovery.
9. Update the most specific file under `docs/memory/` if the lesson is durable.
