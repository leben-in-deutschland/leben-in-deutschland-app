---
id: S-000
title: Shared Feature Prompt Template
status: Template
date: 2026-04-09
target: shared
tags: [template]
---

# Implement: [Feature Name]

## Model And Execution

This prompt is model-agnostic and execution-environment agnostic.

- Do not address a specific model by name.
- Do not rely on vendor-specific tool-call syntax, hidden capabilities, or reasoning markers.
- Do not embed shell automation for batching prompt execution.
- Normal project verification commands are allowed.

## Context

You are working in `[repo-name]`.

[Paste relevant base prompt]

## Feature Description

[Describe target behavior]

## Requirements

[List concrete requirements]

## Technical Approach

[Files, patterns, and constraints]

## API Contract

[If applicable]

## Data Changes

[If applicable]

## Existing Code to Reference

[Point to existing patterns]

## Acceptance Criteria

- [ ]
- [ ]
- [ ]

## Rollback Plan

- **Baseline:** [Starting Git/system state]
- **Trigger:** [Exact condition that requires rollback]
- **Reversal:** [Narrow steps that undo only this feature]
- **State safety:** [Dependencies, migrations, generated files, deployments, data]
- **Recovery verification:** [Checks that prove the baseline is restored]

## Verification

[List test, lint, build, or manual verification steps.]

## Do NOT

- Remove or overwrite unrelated user work.
- Use broad destructive reset, cleanup, history-rewrite, force-push, or
  unplanned data-deletion commands as rollback shortcuts.
-
