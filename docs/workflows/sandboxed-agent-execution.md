# Workflow - Sandboxed Agent Execution

Use this workflow before an agent runs any shell command, subprocess, build,
test, script, generated executable, local MCP server, or language server.

## 0. Warn and Load the Skill

Invoke `pulse-sandbox` first when the runner supports skills. Begin every
tool-backed work response with the exact line for the active harness:

```text
GitHub Copilot CLI:
⚠️ SANDBOX REQUIRED — verify the GitHub Copilot CLI sandbox before execution; do not bypass it. Docs: https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli#running-copilot-cli-commands-in-a-sandbox

Claude Code:
⚠️ SANDBOX REQUIRED — verify the Claude Code sandbox before execution; do not bypass it. Docs: https://code.claude.com/docs/en/sandboxing

OpenCode:
⚠️ SANDBOX REQUIRED — verify the OpenCode external sandbox before execution; do not bypass it. Docs: https://docs.docker.com/ai/sandboxes/agents/opencode/
```

For another harness, use its real name and official sandbox documentation in
the same format. If no official page exists, use `active harness` and
`docs/workflows/sandboxed-agent-execution.md`. The warning is mandatory but is
not proof that the sandbox is active.

## 1. Identify the Harness

Use the matching documented isolation boundary:

| Harness | Required sandbox | Verification |
| --- | --- | --- |
| GitHub Copilot CLI | Native local sandbox, or interactive cloud sandbox when stronger remote isolation is required | `/sandbox status` and `/sandbox policy` |
| Claude Code | Native Bash sandbox in strict mode | `/sandbox` resolved config |
| OpenCode | External OS/container sandbox such as Docker Sandboxes | Start with `sbx run opencode`; verify the Docker sandbox and its policy |
| Other | Documented OS, container, VM, or cloud sandbox | Harness-specific effective-policy check |

Permission prompts and tool allowlists are useful inside the boundary but do
not count as a sandbox.

### Coverage Limits

- Copilot local sandboxing does not sandbox the CLI process itself. Invoked
  commands, search tools, MCP servers, and LSP servers run under the sandbox
  policy; built-in in-process file tools enforce that policy themselves.
- Claude Code's native sandbox applies to Bash commands and child processes.
  File edit and other in-process tools still need restrictive permission and
  repository-path rules.
- Launching OpenCode through an external sandbox can contain the whole OpenCode
  process, while its own permission rules add a second approval layer.

State these limits when reporting that a sandbox is verified.

## 2. Enable Fail-Closed Isolation

### GitHub Copilot CLI

Local sandboxing is experimental. Start Copilot with experimental features,
then enable and inspect it:

```text
/experimental on
/sandbox enable
/sandbox status
/sandbox policy
```

For one session, start with:

```bash
copilot --experimental --sandbox
```

In `/sandbox config`:

- turn **Allow sandbox bypass** off
- keep MCP and LSP sandboxing on when those processes are used
- disable Git, `gh`, and keychain credentials unless required
- disable outbound and local network access unless required
- keep filesystem access limited to the working directory, `.git` when Git
  operations are needed, and isolated temporary/cache paths

For a fully remote interactive session when the organization allows it:

```bash
copilot --cloud --experimental
```

Cloud mode is not available with programmatic `-p` or `-i` sessions.

### Claude Code

Set strict sandbox behavior in user or managed settings:

```json
{
  "sandbox": {
    "enabled": true,
    "failIfUnavailable": true,
    "allowUnsandboxedCommands": false
  }
}
```

Open `/sandbox` and verify the resolved mode, overrides, and config. On Linux
or WSL2, install the documented `bubblewrap` and `socat` dependencies before
execution. Do not use `dangerouslyDisableSandbox`, excluded commands as a
general escape hatch, or filesystem isolation disabled.

### OpenCode

OpenCode permission rules govern approval, not OS isolation. Run OpenCode
inside an external sandbox. Docker Sandboxes documents:

```bash
sbx run opencode /absolute/path/to/repository
```

The workspace argument may be omitted when starting from the repository.
Configure credentials with the sandbox secret store and grant only required
network destinations with `sbx policy`; do not expose host credential files.

Inside the sandbox, keep OpenCode permissions restrictive:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "*": "ask",
    "external_directory": "deny"
  }
}
```

Do not commit this example as a repository-local `opencode.json` unless the
adopting repository explicitly chooses to own that runner configuration.

## 3. Verify Before Execution

Confirm all of the following:

1. The sandbox reports active, not merely configured.
2. Repository writes work only inside the intended working tree.
3. Unrelated home, secret, credential, and system paths are denied.
4. Network and local-network access match the task.
5. MCP and LSP subprocesses are inside the boundary when used.
6. An unavailable or denied capability fails instead of retrying outside.

Record the harness, sandbox type, effective policy, and narrow exceptions in
the task plan when execution is non-trivial.

## 4. Execute Narrowly

- Use repository-local commands and isolated temp/cache paths.
- Grant only the minimum path, domain, credential, or subprocess capability
  required by the current verification step.
- Remove temporary grants after the task when the harness supports it.
- Keep destructive, production, deployment, migration, and data operations
  behind their existing approval and runbook boundaries even inside a sandbox.

## 5. Handle a Sandbox Block

1. Read the violation and identify the exact missing capability.
2. Prefer a task-local path, cache, fixture, mock, or offline verification.
3. If a narrow grant is safe and required, update the sandbox policy
   deliberately and re-verify it.
4. If the sandbox is unavailable or the only solution is unsandboxed
   execution, stop and report the blocker.

Never request a sandbox bypass, silently retry outside isolation, disable the
sandbox, or describe an unsandboxed result as verified.

## 6. Hand Off

Report:

- the required sandbox warning
- harness and sandbox used
- effective filesystem, network, credential, MCP, and LSP policy
- any narrow grants
- checks completed inside the sandbox
- blocked checks that would require unsandboxed execution

In technical terms, PULSE requires verified containment plus permission
controls, with denial as the fallback state.
