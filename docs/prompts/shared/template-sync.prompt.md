---
id: S-TEMPLATE-SYNC
title: PULSE Sync Entry Prompt
status: Active
date: 2026-07-17
target: shared
tags: [prompt, template-sync, maintenance]
---

# PULSE Sync

Sync this repository with upstream PULSE so it operates under the latest rules
and scaffold. The full model-agnostic procedure lives in
`docs/workflows/template-sync.md`; read it first and follow it exactly.
The installed portable entry point is `/pulse-template-sync`.

## Modes

- **Default or `check`:** report-only. Fetch the template, list what changed
  since the last sync, classify it, and stop without modifying tracked files
  or `.template-sync`.
- **`apply`:** update sync-safe files, present review-first rule diffs for
  explicit approval, validate, and update `.template-sync` after success.

## Execution summary

1. Read `docs/workflows/template-sync.md` and `.template-sync` when it exists.
   Do not create sync state in check mode.
2. In apply mode, read `docs/workflows/rollback.md` and prepare a rollback plan
   for only the files this sync may change.
3. Resolve and fetch the template without adding or changing a persistent
   remote unless the user explicitly approves it. If this repository's
   normalized `origin` identity is the PULSE repository, report that this is
   the framework source and stop.
4. Diff the recorded `lastSyncedCommit` (or `HEAD` on first sync) against the
   fetched template head, restricted to the paths classified in the workflow.
5. In apply mode, update sync-safe files from the template:
   never overwrite review-first files (`AGENTS.md`, `CLAUDE.md`, `README.md`,
   `.github/copilot-instructions.md`, `docs/**/README.md`) - show their upstream
   diffs and ask the user before merging rule changes into the local versions
   by hand. Treat copied PULSE `SANDBOX REQUIRED`, fail-closed fallback, and
   ADR-008 instruction text as superseded upstream policy; replace it with
   ADR-009 unless an explicit local decision requires strict isolation.
6. Treat `docs/skills/` as sync-safe canonical source, but never modify
   generated runner-specific skill installation directories.
7. Never touch project-owned content: `docs/context/`, `docs/architecture/`, non-template files in `docs/decisions|features|memory|plans/`, `docs/usage/usage-log.md` rows, or any product code.
8. In apply mode, update `.template-sync` with the new commit and date after
   validation. Leave everything uncommitted for the user to review; do not
   commit or push unless asked.
9. If validation fails, execute the scoped rollback plan and verify the prior state.
10. Report: what was synced, what needs manual review, what was skipped, and whether the repo is now up to date with the template.

## Periodic use

Suggest (don't set up unasked) a cadence: run this prompt in `check` mode weekly or before major work; a scheduled agent or CI job can run check-only mode and flag drift.
