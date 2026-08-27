---
name: pulse-template-sync
description: Check an adopted repository for upstream PULSE template changes and safely apply approved updates while preserving product-owned files and local rules. Use for periodic PULSE maintenance, template drift checks, or refreshing an existing PULSE installation.
---

# PULSE Template Sync

Check or update an adopted repository against the canonical PULSE template
without treating the two repositories as if they share Git history.

## Modes

- **Check:** fetch and report drift without changing tracked files,
  `.template-sync`, instructions, or installed skills.
- **Apply:** update sync-safe files, present review-first rule changes for
  explicit approval, update `.template-sync` after success, and leave all
  changes uncommitted.

Use **check** when the request says `check`, `status`, `preview`, `dry run`, or
does not clearly authorize applying changes. Use **apply** only when the user
explicitly requests apply mode or clearly asks for repository files to be
updated.

## Procedure

1. Read:
   - `AGENTS.md` and other active repository instructions
   - [`docs/workflows/template-sync.md`](../../workflows/template-sync.md)
   - [`docs/workflows/rollback.md`](../../workflows/rollback.md)
   - `.template-sync` when it exists
2. Inspect Git status and preserve all existing user work.
3. Resolve the template URL and branch from `.template-sync`, an existing
   `template` remote, or the canonical PULSE repository. Do not assume `main`.
4. If this repository is the PULSE source itself, report that no downstream
   template sync applies and stop.
5. Fetch the template and compare its head with `lastSyncedCommit`. On a first
   check, compare the classified template paths with the current repository
   without creating `.template-sync`.
6. Classify every upstream change:
   - **Sync-safe:** canonical workflows, scripts, skills, shared prompts,
     templates, and standard framework config.
   - **Review-first:** repository instructions and README files that may contain
     project-specific rules.
   - **Never-sync:** product code and project-owned context, architecture,
     decisions, features, memory, plans, prompts, and usage rows.
7. In **check** mode:
   - make no tracked-file or `.template-sync` changes
   - report the template baseline and head
   - list sync-safe changes, review-first changes, and skipped project-owned
     paths
   - flag copied `SANDBOX REQUIRED`, fail-closed fallback, or ADR-008
     instruction text that ADR-009 supersedes
   - stop after the report
8. In **apply** mode:
   - define a rollback plan before the apply-mode fetch or any state change
   - update an unchanged sync-safe file from the template
   - move locally modified sync-safe files to review instead of overwriting
   - show review-first diffs and obtain explicit approval before merging them
   - never change project-owned paths
   - replace copied ADR-008 sandbox rules with ADR-009 unless an explicit
     target-owned decision intentionally requires strict isolation
   - update `.template-sync` only after applied files validate
9. Validate links, repository-standard documentation checks, skill discovery
   when available, preserved user work, and `git diff --check`.
10. If validation fails and cannot be repaired safely, follow the prepared
    rollback plan and restore the previous `.template-sync` state.
11. Leave changes uncommitted and unpushed unless the user explicitly requests
    publication.

## Safety Boundaries

- Never use merge-base to compare unrelated template-created histories.
- Never overwrite review-first or locally modified files automatically.
- Never copy PULSE source usage rows, local paths, framework history, secrets,
  or generated runner-specific skill directories.
- Never use broad reset, cleanup, history rewriting, or force-push.
- Check mode may fetch remote data but must not change tracked files or sync
  state.

## Output

Report:

- mode: check or apply
- template URL, branch, previous baseline, and current upstream head
- sync-safe changes
- review-first changes and approval state
- project-owned paths skipped
- ADR-008 to ADR-009 migration findings
- files changed in apply mode
- validation and rollback readiness
- whether the repository is up to date

Canonical prompt:
[`docs/prompts/shared/template-sync.prompt.md`](../../prompts/shared/template-sync.prompt.md)
