# Workflow - Sandbox-Recommended Agent Execution

Use this workflow before an agent runs any shell command, subprocess, build,
test, script, generated executable, local MCP server, or language server.

## 0. Warn and Load the Skill

Invoke `pulse-sandbox` first when the runner supports skills. Begin every
tool-backed work response with the exact line for the active harness:

```text
GitHub Copilot CLI:
⚠️ SANDBOX RECOMMENDED — use the GitHub Copilot CLI sandbox when available; state clearly if execution is unsandboxed. Docs: https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli#running-copilot-cli-commands-in-a-sandbox

Claude Code:
⚠️ SANDBOX RECOMMENDED — use the Claude Code sandbox when available; state clearly if execution is unsandboxed. Docs: https://code.claude.com/docs/en/sandboxing

OpenCode:
⚠️ SANDBOX RECOMMENDED — use an external sandbox for OpenCode when available; state clearly if execution is unsandboxed. Docs: https://docs.docker.com/ai/sandboxes/agents/opencode/
```

For another harness, use its recommended sandbox name and official
documentation in the same format. If no official page exists, use `the active
harness sandbox` and `docs/workflows/sandboxed-agent-execution.md`. The warning
is mandatory, but the sandbox is recommended rather than required.

## 1. Identify the Harness

Use the matching documented isolation boundary:

| Harness | Recommended sandbox | Verification |
| --- | --- | --- |
| GitHub Copilot CLI | Native local sandbox, or interactive cloud sandbox when stronger remote isolation is required | `/sandbox status` and `/sandbox policy` |
| Claude Code | Native Bash sandbox | `/sandbox` resolved config |
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

## 2. Prefer Isolation

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

In `/sandbox config`, keep access narrow. When a team requires a strict
profile, turn **Allow sandbox bypass** off. PULSE does not require that strict
profile by default.

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

Enable the native sandbox in user or managed settings:

```json
{
  "sandbox": {
    "enabled": true
  }
}
```

Open `/sandbox` and verify the resolved mode, overrides, and config. On Linux
or WSL2, install the documented `bubblewrap` and `socat` dependencies before
execution when sandboxing is desired.

Teams that independently require strict isolation can also set:

```json
{
  "sandbox": {
    "enabled": true,
    "failIfUnavailable": true,
    "allowUnsandboxedCommands": false
  }
}
```

### OpenCode

OpenCode permission rules govern approval, not OS isolation. Prefer running
OpenCode inside an external sandbox. Docker Sandboxes documents:

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

## 3. Determine and Report the Boundary

When a sandbox is active, confirm all of the following:

1. The sandbox reports active, not merely configured.
2. Repository writes work only inside the intended working tree.
3. Unrelated home, secret, credential, and system paths are denied.
4. Network and local-network access match the task.
5. MCP and LSP subprocesses are inside the boundary when used.
6. Any transition outside the boundary is reported before its result is used.

When no sandbox is active, say that execution is unsandboxed and name the
harness permissions or approval flow that still applies. This disclosure is
enough for ordinary PULSE work unless a higher-level policy requires
isolation.

Record the harness, actual boundary, effective policy, and narrow exceptions
in the task plan when execution is non-trivial.

## 4. Execute Narrowly

- Use repository-local commands and isolated temp/cache paths.
- Grant only the minimum path, domain, credential, or subprocess capability
  required by the current verification step.
- Remove temporary grants after the task when the harness supports it.
- Keep destructive, production, deployment, migration, and data operations
  behind their existing approval and runbook boundaries even inside a sandbox.

## 5. Handle an Unavailable or Blocking Sandbox

1. Read the violation and identify the exact missing capability.
2. Prefer a task-local path, cache, fixture, mock, or offline verification.
3. If a narrow grant is safe and required, update the sandbox policy
   deliberately and re-verify it.
4. If the sandbox is unavailable or the practical solution is unsandboxed
   execution, state that clearly and continue under normal harness permissions.
5. Stop only when an organization, runner, production, data, security-review,
   or task-specific policy requires isolation or forbids the needed access.

Do not automatically bypass or disable an active sandbox. Never describe an
unsandboxed result as isolated.

## 6. Hand Off

Report:

- the required sandbox recommendation warning
- harness and sandbox used
- effective filesystem, network, credential, MCP, and LSP policy
- any narrow grants
- checks completed inside the sandbox
- checks completed without a sandbox
- higher-level rules that still blocked execution

In technical terms, PULSE prefers verified containment and always reports the
actual boundary. Missing containment falls back to normal harness permissions
unless a stronger policy requires isolation.

## 7. Refresh Older PULSE Copies

An adopted repository may still contain the superseded ADR-008 hard gate in
its copied instructions or installed `pulse-sandbox` skill.

1. Run the PULSE bootstrap again or follow
   [`template-sync.md`](template-sync.md).
2. Replace copied `SANDBOX REQUIRED` and fail-closed PULSE text with the
   ADR-009 recommendation.
3. Refresh the canonical `docs/skills/` pack and any generated runner skill
   installation.
4. Restart or reload the coding-agent session so it reads the updated
   instructions.
5. Keep a stricter rule only when the adopting repository has its own explicit
   decision requiring isolation.
