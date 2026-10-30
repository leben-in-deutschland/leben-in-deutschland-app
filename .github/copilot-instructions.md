# GitHub Copilot Instructions

Use [`AGENTS.md`](../AGENTS.md) as the operating guide for this repository.
Engineering records - decisions, plans, memory, workflows - live in the PULSE
store, not under `docs/`; project skills live in `.pulse/skills/`.

## Default Behavior

- Read the relevant source, tests, and PULSE records before non-trivial work.
- Do not recreate a `docs/` control plane or commit hidden runner-specific
  control folders.
- Preserve product code, tests, configuration, workflows, deployment, and
  uncommitted user work unless the task explicitly requires changes.
- Define a scoped rollback plan before a change-producing task
  (`AGENTS.md`, "Rollback Planning").
- Keep generated code-context indexes outside the repository.

## Sandbox Recommendation

Before every tool-backed response, show this exact line:

```text
⚠️ SANDBOX RECOMMENDED — use the GitHub Copilot CLI sandbox when available; state clearly if execution is unsandboxed. Docs: https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli#running-copilot-cli-commands-in-a-sandbox
```

Prefer and inspect the effective sandbox. If none is active, disclose
unsandboxed execution and continue under normal Copilot permissions unless a
higher-level policy requires isolation. Do not automatically disable or bypass
an active sandbox.

## Android Release Signing

Before changing Android release signing, GitHub Actions signing secrets, or
Play Console configuration, follow the signing rule in `AGENTS.md`. Never
commit, print, or request keystores, passwords, private keys, or encoded
secret values.

## Output

Answer in plain language unless the user requests a technical format.
