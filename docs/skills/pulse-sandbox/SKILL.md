---
name: pulse-sandbox
description: Recommend and report sandboxing before agent-controlled tools, commands, builds, tests, scripts, MCP servers, LSP servers, or executables run. Use first to identify whether execution is isolated or unsandboxed without blocking ordinary work.
---

# PULSE Sandbox Recommendation

Prefer isolated execution while reporting the real boundary honestly.

## Required Advisory Warning

Before any tool call or execution, and again in every tool-backed progress or
final response, print the exact line that matches the active harness:

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
harness sandbox` and `docs/workflows/sandboxed-agent-execution.md`.

The warning recommends isolation but does not require or prove it. Report
whether execution is sandboxed or unsandboxed before relying on the result.

## Procedure

1. Identify the active harness from the runner environment without executing
   a command.
2. Print the matching advisory warning and documentation URL.
3. Identify the available isolation boundary:
   - **GitHub Copilot CLI:** native local sandbox or interactive cloud sandbox.
   - **Claude Code:** native Bash sandbox.
   - **OpenCode:** an external OS/container sandbox such as Docker Sandboxes;
     OpenCode permissions alone are not a sandbox.
   - **Other:** a documented OS, container, VM, or cloud sandbox.
4. Prefer the available sandbox:
   - Copilot CLI: `/sandbox enable`, then `/sandbox status` and
     `/sandbox policy`.
   - Claude Code: prefer `sandbox.enabled: true` and verify with `/sandbox`.
     Fail-if-unavailable and disabled fallback are optional strict settings.
   - OpenCode: prefer `sbx run opencode` and keep restrictive `permission`
     rules in either mode.
5. If a sandbox is active, confirm its filesystem, network, credential,
   keychain, MCP, and LSP policy matches the task.
6. If no sandbox is active, state that execution is unsandboxed and continue
   under the harness's normal permissions unless a higher-level policy
   requires isolation.
7. Confirm what any active boundary actually covers:
   - Copilot local sandboxing constrains invoked commands and tools; built-in
     in-process file tools enforce the policy themselves.
   - Claude Code's native boundary covers Bash and child processes; keep edit
     and other tool permissions scoped to the repository.
   - An external OpenCode sandbox can contain the whole OpenCode process.
8. Prefer a narrow sandbox grant or compatible path when blocked. Do not
   automatically disable or bypass an active sandbox.
9. If execution continues outside isolation, disclose the transition and rely
   on the harness's normal permission prompts and allowlists. Never call those
   controls a sandbox.
10. Stop only when a higher-level policy, approval boundary, or task-specific
    rule requires isolation or forbids the needed access.
11. In the handoff, print the warning and report the harness, actual boundary,
    narrow grants, completed checks, and whether any work was unsandboxed.

Canonical workflow:
[`docs/workflows/sandboxed-agent-execution.md`](../../workflows/sandboxed-agent-execution.md)

## Output

Start every tool-backed response with the matching warning and documentation
URL. Then state one of:

- **Sandbox active:** name the harness and effective boundary.
- **Unsandboxed:** state that no sandbox is active and name the permission
  model controlling execution.
- **Read-only:** state that no agent-controlled execution occurred.
