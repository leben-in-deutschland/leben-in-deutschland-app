# Workflow - Prompt Generation

1. Read the relevant feature spec, ADRs, context, and memory.
2. Decide whether one prompt or multiple ordered prompts are needed.
3. Define the narrow inverse edit before creating or changing prompt files.
4. Use `docs/prompts/shared/_feature-prompt-template.md` as the base.
5. Include likely files, requirements, approach, acceptance criteria,
   verification, and rollback plan.
6. Keep prompts model-agnostic and execution-environment agnostic.
7. Verify links and consistency; use [`rollback.md`](rollback.md) if needed.
8. Do not create shell scripts to batch-run prompts.
