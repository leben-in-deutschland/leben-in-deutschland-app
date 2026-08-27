# Leben in Deutschland - Agent Operating Guide

## Repository Scope

Leben in Deutschland helps people prepare for the German naturalization test.
The product is an exported Next.js application with a Capacitor Android
wrapper:

```text
src/web/       Next.js application, tests, static data, and Capacitor config
src/android/   Native Android project generated and maintained with Capacitor
docs/          PULSE engineering control plane
```

The PULSE control plane is the durable source for engineering context:

```text
docs/architecture/   System shape and boundaries
docs/context/        Product and stack facts
docs/decisions/      Architecture decision records
docs/features/       Behavior specifications
docs/memory/         Durable rules and lessons
docs/plans/          Non-trivial work plans
docs/prompts/        Reusable, model-agnostic prompts
docs/skills/         Canonical portable PULSE skills
docs/usage/          Token-only work accounting
docs/workflows/      Repeatable engineering procedures
```

## PULSE Lifecycle

1. Understand the repository through context, architecture, decisions, and memory.
2. Record important product or technical choices as ADRs.
3. Plan non-trivial work with measurable outcomes and verification.
4. Specify new user or system behavior before implementation.
5. Build, verify, and recover against the repository's real boundaries.
6. Record only durable lessons for future work.

## Critical Rules

- Keep canonical control-plane content under `docs/`.
- Do not create parallel root-level architecture, context, memory, plan,
  prompt, skill, or workflow folders.
- Do not commit tool-specific control folders such as `.claude/`, `.cursor/`,
  `.codex/`, or `.opencode/`.
- Preserve project source, tests, configuration, workflows, deployment, and
  existing user work unless the task explicitly requires a change.
- Modify product code only when the user asks for implementation.
- Infer facts from the repository. Mark unsupported facts as open questions
  instead of guessing.
- Create ADRs, feature specs, plans, prompts, and memory only when they make
  future work safer or clearer.
- Keep prompts model-agnostic.
- Treat `docs/skills/` as canonical. Runner-specific installed copies are
  generated local output and must not be committed.
- Do not build a `pulse-code-context` index unless a later task explicitly
  benefits from it. Generated indexes must stay outside the repository.
- Before changing Android signing or release secrets, read
  `docs/memory/android-release-signing.md`. Never commit, print, or request
  keystores, passwords, private keys, or encoded secret values.

## Sandbox-First Execution

Before every task that may use tools or execute code, invoke `pulse-sandbox`
when available and begin each tool-backed response with:

```text
⚠️ SANDBOX REQUIRED — verify the GitHub Copilot CLI sandbox before execution; do not bypass it. Docs: https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli#running-copilot-cli-commands-in-a-sandbox
```

The warning is not proof of isolation. Enable and inspect the native local
sandbox with `/sandbox enable`, `/sandbox status`, and `/sandbox policy`, or
start with `copilot --sandbox`. Turn **Allow sandbox bypass** off.

- Keep access limited to this working tree and isolated temporary/cache paths.
- Deny unrelated home, secret, credential, keychain, and system paths.
- Allow network, GitHub credentials, MCP, or LSP only when the task needs that
  narrow capability.
- If isolation is unavailable or a required capability cannot be granted
  safely, stop. Never retry outside the sandbox.

Follow `docs/workflows/sandboxed-agent-execution.md`.

## Rollback Planning

Every task that changes tracked files, dependencies, configuration, schemas,
deployments, or external state needs a rollback plan before the first change.

The plan must identify:

- **Baseline:** starting Git and relevant system state.
- **Trigger:** the exact failed check, regression, or unsafe condition.
- **Reversal:** narrow steps that undo only the current task.
- **State safety:** protection for dependencies, generated files, deployment,
  data, secrets, and external systems.
- **Recovery verification:** checks proving the baseline is restored.

Use a file under `docs/plans/` for non-trivial work. A small isolated change
may keep a concise in-session checklist. Follow `docs/workflows/rollback.md`.
Never use broad reset, cleanup, history rewriting, force-push, or unplanned
deletion as rollback shortcuts.

## Repository Context Retrieval

Prefer code intelligence or a language server for symbols and references.
When a fresh `pulse-code-context` index exists, use it only to narrow
discovery. Read the exact source before editing and verify behavior with the
repository's real checks.

## Real Verification Commands

Run the smallest command that covers the change:

```bash
cd src/web && npm test
cd src/web && npm run lint
cd src/web && npm run build
cd src && make build-sync
cd src/android && ./gradlew bundleRelease
```

Do not invent commands. Android signing and deployment also depend on GitHub
Actions secrets and their existing approval boundaries.

## Work Accounting

End completed work with the actual model and token usage exposed by the
runner. Never estimate missing token counts or substitute billing units.
Record one session row in `docs/usage/usage-log.md`; use
`n/a (not exposed)` for unavailable fields. The collectors under
`docs/scripts/` read supported local runner logs.

Append this footer at the end of the final response:

```text
---
### 🧮 Work Accounting
- Model(s): <actual model id(s)>
- Tokens: <input> in / <output> out / <total> total — source: <runner source>
```

## Output Format

Use the plain-language ELI5 format in
`docs/prompts/shared/eli5.prompt.md` by default. The user can request
`normal`, `technical`, or `no eli5` for a technical response, and `eli5` to
switch back. Exact facts, paths, commands, code, and the accounting footer do
not change.

## Routing

| Request | Read first | Write when useful |
| --- | --- | --- |
| Product or architecture decision | `docs/context/`, `docs/architecture/`, `docs/decisions/`, `docs/memory/` | `docs/decisions/`, `docs/architecture/` |
| New feature | `docs/context/`, `docs/architecture/`, `docs/decisions/`, `docs/memory/` | `docs/features/`, `docs/plans/`, `docs/prompts/` |
| Bug fix | Relevant source, tests, context, and memory | `docs/plans/` for non-trivial work; memory only for a durable lesson |
| Android release signing | `docs/memory/android-release-signing.md`, workflow, Android config | Update control-plane records only when facts change |
| Learning or mistake | Existing `docs/memory/` | The most specific memory file |
| PULSE maintenance | This file and `docs/*/README.md` | Durable control-plane files |

## Open Questions

Current unknowns are recorded in `docs/context/product.md` and
`docs/context/stack.md`. Resolve them only when repository evidence or an
owner provides the answer.
