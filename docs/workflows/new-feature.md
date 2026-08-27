# Workflow - New Feature

1. Read relevant files in `docs/memory/`, `docs/decisions/`, `docs/architecture/`, and `docs/context/`.
2. Create or update a feature spec in `docs/features/` from `_template.md`.
3. Record non-obvious decisions in `docs/decisions/`.
4. Update context or architecture docs for impacted areas.
5. Generate prompts in `docs/prompts/` when implementation should be split into steps.
6. Define the rollback baseline, trigger, reversal steps, state-safety notes,
   and recovery checks before implementation.
7. Implement only when the user explicitly asks for code changes.
8. Verify with available project commands.
9. If the feature cannot be made safe within scope, follow
   [`rollback.md`](rollback.md) and verify recovery.
10. Record learnings and mistakes in `docs/memory/`.
