---
name: pulse-review
description: Review a change against requested behavior, PULSE decisions and plans, verification evidence, and rollback readiness. Use for code, documentation, pull request, or implementation reviews.
---

# PULSE Review

Review for meaningful correctness and lifecycle gaps, not cosmetic preference.

## Procedure

1. Read the request, diff, relevant feature spec, plan, ADRs, architecture, and memory.
2. Check whether the change delivers the intended behavior.
3. Trace important implementation choices back to accepted decisions.
4. Look for high-confidence bugs, missing edge cases, unsafe state changes,
   weak error handling, or broken integration boundaries.
5. Check verification evidence and whether the selected checks cover the changed behavior.
6. Check rollback readiness:
   - plan existed before change
   - trigger is specific
   - reversal is scoped
   - user work, history, deployments, and data are protected
   - recovery verification exists
7. Report findings in severity order with file/line evidence and impact.
8. If no meaningful finding exists, say so directly and note any real residual risk.

Canonical checklist:
<https://github.com/manishtiwari25/pulse/blob/main/docs/prompts/shared/review.prompt.md>

## Do Not

- Report speculative issues without evidence.
- Rewrite the implementation merely to match personal style.
- Treat a successful test run as proof that untested behavior is correct.
