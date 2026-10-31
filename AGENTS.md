# Leben in Deutschland - Agent Guide

## Repository Scope

Leben in Deutschland helps people prepare for the German naturalization test.
The product is an exported Next.js application with Capacitor Android and
iOS wrappers:

```text
src/web/        Next.js application, tests, static data, and Capacitor config
src/android/    Native Android project generated and maintained with Capacitor
src/ios/        Native iOS project (Xcode, CocoaPods) generated and maintained with Capacitor
src/store/      Play Console and App Store Connect configuration and the scripts that publish it
src/catalogue/  Official BAMF question-catalogue pipeline
.pulse/skills/  Project skills: one folder per skill, SKILL.md plus support files
```

Native code that both apps share by contract lives twice: the `TipJar` and
`AppSystemBars` plugins exist as `src/android/.../*.java` and
`src/ios/App/App/*.swift` with the same method names and JSON shapes, and
`AppViewController.swift` registers them like `MainActivity.java` does. Keep
the two in step when one changes.

## PULSE

This repository is run through PULSE. The store is canonical for everything
that used to live under `docs/`: decisions, plans, features, memory,
workflows, prompts, the constitution and the evaluators are records, and
coordination happens on the board. Start with `pulse guide`, then
`pulse board --project leben-in-deutschland` and
`pulse task list --project leben-in-deutschland`. Read records with
`pulse record list <kind> --project leben-in-deutschland` (`adr`, `memory`,
`context`, `wu`, ...) and `pulse record show <id>`. Do not recreate a `docs/`
control plane, and do not commit tool-specific folders such as `.claude/`,
`.cursor/`, `.codex/`, or `.opencode/`.

## Skills

Project skills live in `.pulse/skills/<name>/SKILL.md`, the first folder
PULSE's harness reads (then `.claude/skills`, `.github/skills`,
`.agents/skills`, the owner's `~/.pulse/skills`, and the `pulse skill`
registry; a repository skill shadows the owner's). Support files sit beside
`SKILL.md` and are read on demand. Skills document procedures, never the
owner's values. The PULSE framework skills are not copied into this
repository.

| Skill | Use it for |
| --- | --- |
| `play-console-publish` | Pushing the tip-jar products and the Play store listing from the repository through the Play Developer API, with offline checks and a credential gate |
| `app-store-connect-publish` | Pushing the tip-jar products and the App Store listing from the repository through the App Store Connect API, with an offline rehearsal and a credential gate |
| `bamf-catalogue-sync` | Checking whether BAMF published a new official question catalogue PDF, extracting and comparing it with the app's questions, applying the safe part, and handing the owner the held-back questions |

## Critical Rules

- Preserve project source, tests, configuration, workflows, deployment, and
  existing user work unless the task explicitly requires a change.
- Modify product code only when the user asks for implementation.
- Infer facts from the repository. Mark unsupported facts as open questions
  instead of guessing.
- Android release signing: the app is `org.lebenindeutschland.app`, and its
  known-good upload certificate has SHA-1
  `DE:8C:92:1E:CE:44:26:6D:5E:55:A0:08:3E:9D:E3:8D:C5:60:57:D0`. The keystore,
  its password and the key alias live in the owner's password manager and
  reach GitHub Actions only as the secrets `ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEY_ALIAS`, and `ANDROID_KEYSTORE_PASSWORD`; GitHub does not expose
  prior secret values, so confirm the source is recoverable before
  overwriting them. Before changing signing material, confirm the package and
  the certificate without placing the password on the command line
  (`keytool -list -v -keystore <path> | grep -E "Alias name:|Entry type:|SHA1:"`,
  the `PrivateKeyEntry`). Publish only the signing action's `signedFile`
  output, renamed to `leben-in-deutschland-v<versionName>-<versionCode>.aab`;
  the unsigned `app-release.aab` and `app-release-temp.aab` are not
  production artifacts, and no `*.aab` wildcard. Never commit, print, or
  request keystores, passwords, private keys, or encoded secret values.
- iOS release signing: the app is `org.lebenindeutschland.app` as well, built
  and uploaded to TestFlight by `.github/workflows/ios-release.yml` (ADR-047,
  PLAN-013). The Apple Distribution certificate (`.p12` and its password),
  the App Store Connect API key (`.p8`, key id, issuer id) and the Team ID
  live in the owner's password manager and reach GitHub Actions only as the
  secrets `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`,
  `ASC_API_KEY_BASE64`, `ASC_KEY_ID`, `ASC_ISSUER_ID` and `APPLE_TEAM_ID`.
  `src/ios/App/ExportOptions.plist` keeps a `TEAM_ID_PLACEHOLDER`; the
  workflow fills it at run time. The Release configuration signs manually
  with the App Store profile "Leben in Deutschland App Store", which
  `src/store/asc-profile.mjs` creates for the distribution certificate and
  installs on the runner; Debug stays automatic for Xcode on the owner's
  Mac. Release to the App Store is a manual step in App Store Connect. Never commit, print, or request certificates, keys,
  profiles, the Team ID or the numeric Apple ID of the app - once the app is
  public its App Store URL (and so the id) belongs in
  `siteConfig.links.appStore`, nowhere else.
- The iOS app must not name Google Play, and the Android app need not name
  the App Store: user-facing store wording goes through `storeName()` and
  `storeRatingUrl()` in `src/web/utils/app-store.ts` (translations use a
  `{store}` placeholder). Apple rejects references to other platforms
  (App Review Guideline 2.3.10).
- The repository is public: files, history, Actions logs, and release assets
  are readable by anyone. Never commit personal identifiers either - private
  e-mail addresses, device serials, home paths, cloud project ids,
  service-account e-mails, Play developer ids - and never print variable
  values in workflows or scripts (`vars.*` are not masked, only `secrets.*`
  are); use placeholders such as `<device-serial>` or `<project>`. Commit
  with the GitHub noreply address.

## Sandbox Recommendation

Before every task that may use tools or execute code, begin each tool-backed
response with:

```text
⚠️ SANDBOX RECOMMENDED — use the GitHub Copilot CLI sandbox when available; state clearly if execution is unsandboxed. Docs: https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli#running-copilot-cli-commands-in-a-sandbox
```

The warning recommends isolation but does not prove it. Prefer and inspect the
native local sandbox with `/sandbox enable`, `/sandbox status`, and
`/sandbox policy`, or start with `copilot --sandbox`. Keep access limited to
this working tree and isolated temporary/cache paths; deny unrelated home,
secret, credential, keychain, and system paths; allow network, GitHub
credentials, MCP, or LSP only when the task needs that narrow capability. If
no sandbox is active, state that execution is unsandboxed and continue under
normal permissions. Do not automatically disable or bypass an active sandbox.

## Rollback Planning

Every task that changes tracked files, dependencies, configuration, schemas,
deployments, or external state needs a rollback plan before the first change:

- **Baseline:** starting Git and relevant system state.
- **Trigger:** the exact failed check, regression, or unsafe condition.
- **Reversal:** narrow steps that undo only the current task.
- **State safety:** protection for dependencies, generated files, deployment,
  data, secrets, and external systems.
- **Recovery verification:** checks proving the baseline is restored.

Tier 0 work keeps it as a concise in-session checklist; Tier 1 and Tier 2
work carries it in the work-unit or plan record (`pulse guide`,
"Proportional lifecycle tiers"). Never use broad reset, cleanup, history
rewriting, force-push, or unplanned deletion as rollback shortcuts.

## Repository Context Retrieval

Prefer code intelligence or a language server for symbols and references.
Read the exact source before editing and verify behavior with the
repository's real checks. Generated indexes stay outside the repository.

## Real Verification Commands

Run the smallest command that covers the change:

```bash
cd src/web && npm test
cd src/web && npm run lint
cd src/web && npm run build
cd src && make build-sync
cd src/android && ./gradlew bundleRelease
cd src && make build-sync-ios
cd src/ios/App && xcodebuild -workspace App.xcworkspace -scheme App -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Do not invent commands. Android and iOS signing and deployment also depend
on GitHub Actions secrets and their existing approval boundaries. `npm run
assets:ios` re-renders the iOS icon and launch images from the app icon.

## Output Format

Answer in plain language by default; the user can ask for a technical
response. Exact facts, paths, commands, and code do not change.

## Routing

| Request | Read first | Write when useful |
| --- | --- | --- |
| Product or architecture decision | `pulse record list context`, `architecture`, `adr`, and `memory` for the project | Tier 2: an ADR record, and the owner's explicit yes before implementation |
| New feature or bug fix | Relevant source, tests, and the project's records | Tier 1: a work-unit record naming its ADR; memory only for a durable lesson |
| Android release signing | The signing rule above, `.github/workflows/android-release.yml`, Android config | Nothing in the repository holds secret values |
| iOS release signing, TestFlight, App Store | The iOS signing rule above, `.github/workflows/ios-release.yml`, `src/store/README.md` (App Store Connect), `pulse record show PLAN-013` | Nothing in the repository holds secret values; the owner submits to review by hand |
| Play products or store listing | `src/store/README.md`, the `play-console-publish` skill | Change `src/store/metadata/`, never a key |
| App Store products or listing | `src/store/README.md` ("App Store Connect from the command line"), the `app-store-connect-publish` skill | Change `src/store/metadata/`, never a key |
| BAMF question catalogue (official PDF) | `src/catalogue/README.md`, the `bamf-catalogue-sync` skill | Only `apply.mjs` writes `src/web/data/question.json`, and only the safe part |
| Legal pages (`/impressum`, privacy policy, footer and About links) | `pulse record show MEM-legal-notice-names-a-natural-person-ddg-mstv-leben-in-deutschland` | Keep the named person, address and contact consistent across all of them; never link the EU ODR platform |
| Learning or mistake | `pulse record list memory --project leben-in-deutschland` | A `finding` on the board, or a `MEM-*` record when it is durable |
