---
name: pulse-bootstrap
description: Safely add or merge the PULSE docs-first engineering control plane into a new or established repository. Use when initializing PULSE, adopting the framework, or repairing an incomplete PULSE setup.
---

# PULSE Bootstrap

Integrate PULSE without replacing the target repository's code, rules, or
uncommitted work.

## Procedure

1. Read all target instruction files, the root README, existing docs, Git
   status/diff, source boundaries, tests, CI, deployment, and real verification commands.
2. Classify the target as new/empty or established. Use established when uncertain.
3. Define a rollback plan before editing:
   - baseline target state
   - exact PULSE files to reverse
   - failure trigger
   - recovery checks
4. Invoke `pulse-sandbox` when supported, print its exact harness-specific
   warning with the matching sandbox documentation URL, and verify the active
   harness's real isolation boundary before any command or tool. Stop instead
   of retrying unsandboxed.
5. Read the canonical PULSE bootstrap sources:
   - `docs/workflows/bootstrap-control-plane.md`
   - `docs/prompts/shared/bootstrap-control-plane-in-new-repo.prompt.md`
6. Merge useful PULSE instructions and `docs/` surfaces. Always include the
   complete canonical `docs/skills/` pack and preserve target-specific rules.
7. When native project skills are supported, activate the complete pack from
   the target's local `docs/skills/` source for the current runner. Prefer an
   already available GitHub CLI or universal skills installer. Do not install
   for unrelated runners, add a package dependency, or commit generated skill
   directories.
8. Do not copy source usage rows, local paths, framework history, stale product
   context, secrets, or unrelated state.
9. Do not add product code, dependencies, CI, or invented commands.
10. Validate links, diff safety, all canonical bundles, preserved user work,
    existing targeted docs checks, the harness-specific warning and
    documentation mapping, and fail-closed sandbox guidance.
11. If validation cannot be repaired safely, execute the scoped rollback plan.
12. Leave changes uncommitted unless the user explicitly requests publication.

Canonical source:
<https://github.com/manishtiwari25/pulse/blob/main/docs/workflows/bootstrap-control-plane.md>

## Report

Return the target classification, files changed, files preserved, skill
activation state, facts inferred, open questions, validation, rollback
readiness, and blockers.
