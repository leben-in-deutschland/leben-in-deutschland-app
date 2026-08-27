# GitHub Copilot Instructions

Use [`AGENTS.md`](../AGENTS.md) as the primary operating guide. The canonical
PULSE engineering control plane lives under `docs/`.

## Default Behavior

- Read relevant context, architecture, decisions, and memory before
  non-trivial work.
- Keep control-plane content under `docs/`; do not create a parallel root tree
  or commit hidden runner-specific control folders.
- Preserve product code, tests, configuration, workflows, deployment, and
  uncommitted user work unless the task explicitly requires changes.
- Create ADRs, specs, plans, prompts, workflows, or memory only when useful.
- Define a scoped rollback plan before a change-producing task and follow
  [`docs/workflows/rollback.md`](../docs/workflows/rollback.md).
- Treat `docs/skills/` as canonical. Generated project skill copies are local
  output and must not be committed.
- Keep generated code-context indexes outside the repository.

## Sandbox Recommendation

Invoke `pulse-sandbox` first when available. Before every tool-backed response,
show this exact line:

```text
⚠️ SANDBOX RECOMMENDED — use the GitHub Copilot CLI sandbox when available; state clearly if execution is unsandboxed. Docs: https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli#running-copilot-cli-commands-in-a-sandbox
```

Prefer and inspect the effective sandbox. If none is active, disclose
unsandboxed execution and continue under normal Copilot permissions unless a
higher-level policy requires isolation. Do not automatically disable or bypass
an active sandbox. Follow
[`docs/workflows/sandboxed-agent-execution.md`](../docs/workflows/sandboxed-agent-execution.md).

## Android Release Signing

Before changing Android release signing, GitHub Actions signing secrets, or
Play Console configuration, read
[`docs/memory/android-release-signing.md`](../docs/memory/android-release-signing.md).

Never commit, print, or request keystores, passwords, private keys, or encoded
secret values.

## Output and Accounting

Use the plain-language format in
[`docs/prompts/shared/eli5.prompt.md`](../docs/prompts/shared/eli5.prompt.md)
unless the user requests a technical format. End completed work with the
actual model and token usage exposed by the runner, using
`n/a (not exposed)` instead of estimates, and update
[`docs/usage/usage-log.md`](../docs/usage/usage-log.md).
