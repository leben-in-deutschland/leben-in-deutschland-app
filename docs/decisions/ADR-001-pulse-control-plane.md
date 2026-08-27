---
id: ADR-001
title: Use an Adapted PULSE Docs Control Plane
status: Accepted
date: 2026-08-27
areas: [documentation, workflow]
tags: [adr, pulse, control-plane]
---

# ADR-001: Use an Adapted PULSE Docs Control Plane

## Context

The repository contains an established web and Android product, CI,
deployment, and project-specific Android signing guidance. Engineering context
was otherwise spread across source, workflows, and chat history. The
repository owner requested PULSE while requiring all product code and existing
instructions to remain intact.

## Options Considered

### Keep only source and ad hoc notes

- Avoids new documentation structure.
- Leaves decisions, plans, recovery, and durable lessons disconnected.

### Copy the PULSE source repository wholesale

- Brings every framework artifact.
- Imports unrelated framework history, publishing state, usage rows, and
  generic product assumptions.

### Adapt PULSE under `docs/`

- Preserves the established product and its instructions.
- Adds repository-specific context, templates, workflows, rollback, and the
  complete portable skill pack.
- Requires maintainers to keep the control plane current.

## Decision

Adopt an adapted PULSE control plane under `docs/`. Keep `AGENTS.md`,
`.github/copilot-instructions.md`, and the root README as small entry points.
Do not import PULSE framework history, usage rows, public-site state, or
unrelated plans.

Canonical skills stay in `docs/skills/`. Runner-specific installed copies are
local generated output and are never committed.

## Consequences

### Positive

- Developers and agents share repository-specific context and recovery rules.
- Existing Android signing guidance remains durable and discoverable.
- PULSE adds no product runtime dependency.

### Negative

- Documentation can become stale unless changes update relevant context.
- The sandbox and rollback preflight add deliberate setup before tool-backed
  work.

## Follow-Up

- Keep context and architecture aligned with implemented behavior.
- Create feature specs or plans only for real future work.
- Record durable lessons without copying temporary session history.
