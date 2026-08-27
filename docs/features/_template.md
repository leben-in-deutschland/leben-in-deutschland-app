---
id: FEAT-000
title: Feature Title
status: Draft
date: YYYY-MM-DD
priority: Medium
areas: [all]
tags: [feature]
---

# Feature: [Feature Name]

## Summary

One-paragraph description of the feature and intended outcome.

## User Story

As a [type of user], I want [goal] so that [reason].

## Requirements

### Functional

- [ ] Requirement 1
- [ ] Requirement 2

### Non-Functional

- [ ] Performance
- [ ] Security
- [ ] Reliability

## Scope

### Area

- [ ]

## Interface Changes

List any user-facing, API, CLI, UI, or integration changes.

## Data Changes

List any persistence, schema, storage, or document changes.

## Decisions

Link ADRs or notable implementation decisions.

## Edge Cases

List likely failure scenarios and expected behavior.

## Rollback Strategy

- **Baseline:** What known-good state should be captured before implementation?
- **Trigger:** Which failed checks or regressions require rollback?
- **Reversal:** How can only this feature's changes be disabled or reversed?
- **State safety:** How are dependencies, migrations, deployments, and data protected?
- **Recovery verification:** Which checks prove the previous behavior is restored?

## Generated Prompts

- Shared: `docs/prompts/shared/S-XXX-example.md`

## Acceptance Criteria

- [ ]

## Verification Plan

List commands or manual checks needed to verify the feature.
