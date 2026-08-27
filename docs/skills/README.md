# PULSE Skills

Portable Agent Skills for the PULSE lifecycle. These folders are the canonical
skill source and follow the `skills/<name>/SKILL.md` convention.

Mandatory repository and safety policies remain in `AGENTS.md`. Skills add
detailed, on-demand procedures; they do not replace always-on instructions.

Every PULSE installation includes the complete canonical pack. The commands
below activate those skills in a runner's native project or user location.

Public catalog: <https://manishtiwari25.github.io/pulse/skills/>

## Available Skills

| Skill | Use it for |
| --- | --- |
| `pulse-bootstrap` | Adding PULSE safely to a new or established repository |
| `pulse-plan` | Creating a verifiable work plan with rollback |
| `pulse-decision` | Recording an ADR and decision trail |
| `pulse-feature` | Defining and delivering a feature through the PULSE lifecycle |
| `pulse-rollback` | Executing a scoped, verified rollback |
| `pulse-review` | Reviewing behavior, evidence, decisions, and rollback readiness |
| `pulse-memory` | Recording durable lessons without storing temporary notes |
| `pulse-delegation-advisor` | Estimating tokens and recommending agent, human, or hybrid work |
| `pulse-code-context` | Building a standard-library Go code index and relationship graph |
| `pulse-sandbox` | Warning about, verifying, and enforcing fail-closed execution isolation |

## Recommended: Activate the Complete Pack

The universal skills installer discovers the complete bundle set:

```bash
npx skills@latest add manishtiwari25/pulse \
  --skill '*' \
  --agent github-copilot \
  --copy \
  --yes
```

Replace `github-copilot` with another supported agent. Use Node.js 22.20 or
newer. To inspect the pack without installing:

```bash
npx skills@latest add manishtiwari25/pulse --list
```

Update universal-installer copies with:

```bash
npx skills update
```

The universal installer may create `skills-lock.json`. In a full PULSE
repository, `docs/skills/` remains canonical; review any lock-driven update
before it replaces project-customized skill content.

## Alternative: GitHub CLI

Install all skills for GitHub Copilot at project scope:

```bash
gh skill install manishtiwari25/pulse --all \
  --agent github-copilot \
  --scope project
```

Use `--scope user` to activate the same complete pack across repositories.
Installing one skill remains available for advanced customization:

```bash
gh skill install manishtiwari25/pulse pulse-rollback \
  --agent github-copilot \
  --scope user
```

Install all skills for another supported agent:

```bash
gh skill install manishtiwari25/pulse --all \
  --agent claude-code \
  --scope user
```

Generated project or user installation folders are outputs; do not commit them
to the PULSE source repository.

## Install from a Local Clone

```bash
gh skill install . --all --from-local \
  --agent github-copilot \
  --scope project
```

Copilot CLI can also use the canonical directory directly:

```bash
copilot skill add docs/skills
copilot skill list
```

Inside an interactive Copilot CLI session, use:

```text
/skills reload
/skills list
/skills info pulse-plan
```

Invoke a skill explicitly by name, for example:

```text
Use the /pulse-plan skill to plan this migration.
```

## Required Sandbox Preflight

Use `pulse-sandbox` first for any non-conversational task that may run tools,
commands, builds, tests, scripts, MCP servers, LSP servers, or executables.
Every tool-backed response begins with the matching harness warning:

```text
⚠️ SANDBOX REQUIRED — verify the <harness> sandbox before execution; do not bypass it. Docs: <matching official sandbox documentation URL>
```

The skill selects the official
[Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli#running-copilot-cli-commands-in-a-sandbox),
[Claude Code](https://code.claude.com/docs/en/sandboxing), or
[OpenCode Docker Sandbox](https://docs.docker.com/ai/sandboxes/agents/opencode/)
page. The warning is not proof of isolation. Copilot CLI and Claude Code use
their native sandboxes; OpenCode requires an external sandbox because
permissions alone are not an OS boundary. See
[`sandboxed-agent-execution.md`](../workflows/sandboxed-agent-execution.md).

## Optional Local Code Context

The `pulse-code-context` bundle includes a standard-library Go helper that
stores its generated index outside the repository.

```bash
go run docs/skills/pulse-code-context/code_context.go index \
  --repo .
go run docs/skills/pulse-code-context/code_context.go search \
  "where session tokens are refreshed" \
  --repo . \
  --json
```

The helper uses no third-party packages, model download, or hosted service.
Use a checksummed release binary when one is available and a Go toolchain is
not. The index narrows exploration; exact source reads and repository
verification remain required.

The documented release process builds binaries for macOS, Linux, and Windows
on AMD64 and ARM64. Verify a downloaded file against the release's
`SHA256SUMS` before running it.

## Update or Remove

```bash
gh skill update
copilot skill remove pulse-plan
```

Check the local command help because supported agents and update flags can
change between CLI versions.

## Skill Maintenance Rules

- Keep the `name` equal to the folder name.
- Make `description` state both what the skill does and when to use it.
- Keep mandatory policy in `AGENTS.md`; do not hide a safety rule only in a skill.
- Keep scripts inside the skill directory so they travel with the bundle.
- Do not pre-approve shell tools unless the skill and script have been fully reviewed.
- Link durable behavior to canonical PULSE features, ADRs, and workflows.
