---
name: pulse-sandbox
description: Verify and enforce fail-closed sandboxing before agent-controlled tools, commands, builds, tests, scripts, MCP servers, LSP servers, or executables run. Use first for every non-conversational task that may execute or modify anything.
---

# PULSE Sandbox

Prevent agent-controlled work from running with unrestricted host-user access.

## Required Warning

Before any tool call or execution, and again in every tool-backed progress or
final response, print the exact line that matches the active harness:

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
`docs/workflows/sandboxed-agent-execution.md`.

The warning does not prove isolation. Continue only after the effective
sandbox is verified.

## Procedure

1. Identify the active harness from the runner environment without executing
   a command.
2. Print the matching required warning and documentation URL.
3. Identify its real isolation boundary:
   - **GitHub Copilot CLI:** native local sandbox or interactive cloud sandbox.
   - **Claude Code:** native Bash sandbox.
   - **OpenCode:** an external OS/container sandbox such as Docker Sandboxes;
     OpenCode permissions alone are not a sandbox.
   - **Other:** a documented OS, container, VM, or cloud sandbox.
4. Enable fail-closed behavior and disable unsandboxed fallback:
   - Copilot CLI: `/sandbox enable`, then `/sandbox status` and
     `/sandbox policy`; turn **Allow sandbox bypass** off.
   - Claude Code: require `sandbox.enabled: true`,
     `sandbox.failIfUnavailable: true`, and
     `sandbox.allowUnsandboxedCommands: false`; verify with `/sandbox`.
   - OpenCode: launch through `sbx run opencode` and keep restrictive
     `permission` rules as defense in depth.
5. Confirm the effective filesystem, network, credential, keychain, MCP, and
   LSP policy matches the task.
6. Confirm what the boundary actually covers:
   - Copilot local sandboxing constrains invoked commands and tools; built-in
     in-process file tools enforce the policy themselves.
   - Claude Code's native boundary covers Bash and child processes; keep edit
     and other tool permissions scoped to the repository.
   - An external OpenCode sandbox can contain the whole OpenCode process.
7. Run only inside the verified boundary. Grant the narrowest additional path,
   domain, credential, or subprocess capability needed.
8. If the sandbox is unavailable, unsupported, or blocks a capability that
   cannot be granted safely, stop and report the blocker.
9. Never request a sandbox bypass, silently retry outside isolation, disable
   the sandbox, or call permission prompts a sandbox.
10. In the handoff, print the warning and report the harness, sandbox, policy,
   narrow grants, completed checks, and sandbox-blocked checks.

Canonical workflow:
[`docs/workflows/sandboxed-agent-execution.md`](../../workflows/sandboxed-agent-execution.md)

## Output

Start every tool-backed response with the matching warning and documentation
URL. Then state one of:

- **Sandbox verified:** name the harness and effective boundary.
- **Sandbox blocked:** state the missing or denied capability and stop.
- **Read-only:** state that no agent-controlled execution occurred.
