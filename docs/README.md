# Leben in Deutschland Engineering Control Plane

This directory is the PULSE control plane for the Leben in Deutschland
application. It keeps durable engineering context beside the source without
replacing product code, GitHub issues, or release tooling.

```text
architecture/   System shape, boundaries, and data flow
context/        Product, stack, integrations, and open questions
decisions/      Project-specific architecture decision records
features/       Specifications for new user or system behavior
memory/         Durable rules, lessons, and mistakes
plans/          Verifiable plans for non-trivial work
prompts/        Reusable, model-agnostic execution prompts
scripts/        Token-usage collectors for supported runners
skills/         Complete canonical PULSE Agent Skills pack
usage/          Token-only session accounting
workflows/      Repeatable engineering and recovery procedures
```

## Lifecycle

```text
Context -> Options -> Decision -> Plan -> Feature -> Code -> Verification -> Learning
```

1. Read [`context/`](context/), [`architecture/`](architecture/),
   [`decisions/`](decisions/), and [`memory/`](memory/).
2. Record a decision only when a durable choice exists.
3. Plan non-trivial work with verification and rollback.
4. Specify new behavior before implementation.
5. Implement only when requested, run the repository's real checks, and use
   the prepared rollback path when recovery is needed.
6. Save only durable lessons in memory.

## Entry Points

- [`../AGENTS.md`](../AGENTS.md) - primary agent operating guide.
- [`context/product.md`](context/product.md) - product purpose and boundaries.
- [`context/stack.md`](context/stack.md) - stack and real commands.
- [`architecture/overview.md`](architecture/overview.md) - current system shape.
- [`memory/android-release-signing.md`](memory/android-release-signing.md) -
  release-signing safety rule.
- [`skills/README.md`](skills/README.md) - all eleven portable PULSE skills.
- [`skills/pulse-template-sync/SKILL.md`](skills/pulse-template-sync/SKILL.md) -
  checks and applies approved upstream PULSE updates.
- [`workflows/sandboxed-agent-execution.md`](workflows/sandboxed-agent-execution.md) -
  sandbox recommendation and execution-boundary reporting.
- [`workflows/rollback.md`](workflows/rollback.md) - scoped recovery.

PULSE source usage rows, framework plans, publishing state, and framework ADRs
are intentionally not part of this repository.
