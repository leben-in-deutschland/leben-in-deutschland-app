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
src/termine/    Exam-date pipeline: reads the exam centres' own course pages and publishes them (registry, adapters, sync, publish)
scripts/        The repository's own checks (`check.sh`, `verify.sh`) and the BAMF data sync (`bamf-data-sync.mjs`, `lib/xlsx.mjs`)
.hive/automations/  Standing work the Hive daemon runs from main: one YAML file per automation plus its watch script (`<name>.yaml` + `<name>.sh`)
.hive/skills/       Project skills: one folder per skill, SKILL.md plus support files
```

Native code that both apps share by contract lives twice: the `TipJar` and
`AppSystemBars` plugins exist as `src/android/.../*.java` and
`src/ios/App/App/*.swift` with the same method names and JSON shapes, and
`AppViewController.swift` registers them like `MainActivity.java` does. Keep
the two in step when one changes.

## Hive

This repository is run through Hive. The store is canonical for everything
that used to live under `docs/`: decisions, plans, features, memory,
workflows, prompts, the constitution and the evaluators are records, and
coordination happens on the board. Start with `hive guide`, then
`hive board --project leben-in-deutschland` and
`hive task list --project leben-in-deutschland`. Read records with
`hive record list <kind> --project leben-in-deutschland` (`adr`, `memory`,
`context`, `wu`, ...) and `hive record show <id>`. Do not recreate a `docs/`
control plane, and do not commit tool-specific folders such as `.claude/`,
`.cursor/`, `.codex/`, or `.opencode/`.

Hive was called PULSE until November 2026. Older branches (`pulse/...`),
records, the stored guide and the framework skills (`pulse-*`) still carry
that name; wherever they spell a command as `pulse ...`, the command is
`hive ...`.

## Skills

Project skills live in `.hive/skills/<name>/SKILL.md`, the first folder
Hive's harness reads (then `.claude/skills`, `.github/skills`,
`.agents/skills`, the owner's `~/.hive/skills`, and the `hive skill`
registry; a repository skill shadows the owner's). Support files sit beside
`SKILL.md` and are read on demand. Skills document procedures, never the
owner's values. The framework skills (`pulse-*`) are not copied into this
repository.

| Skill | Use it for |
| --- | --- |
| `play-console-publish` | Pushing the tip-jar products, the Play store listing and the signed App Bundle (Internal testing track) from the repository through the Play Developer API, with offline checks and a credential gate |
| `app-store-connect-publish` | Pushing the tip-jar products and the App Store listing from the repository through the App Store Connect API, with an offline rehearsal and a credential gate |
| `bamf-catalogue-sync` | Checking whether BAMF published a new official question catalogue PDF, extracting and comparing it with the app's questions, applying the safe part, and handing the owner the held-back questions |
| `bamf-data-sync` | Reading a new BAMF evaluation status (`current-evaluation.json`) or exam-centre list (`prüfstellen.json`) from bamf.de into the app, with validation, version bump, tests and one data commit |

## Automations

The data syncs that used to be GitHub workflows are Hive automations in
`.hive/automations/` (`hive manifest check` validates them; `hive
schedule list --project leben-in-deutschland` shows them). All four are
**watches**: the daemon runs the script without a model. Three of them only
look, every day (the exam centres weekly), and the daemon queues one agent
job - whose brief names the skill - only when the script prints a change.
The fourth, the exam dates, does its work itself and prints nothing. An
automation's script has to sit under `.hive/` as well, so it lives beside
its YAML file.

| Automation | Script | Skill the job follows |
| --- | --- | --- |
| `bamf-catalogue-sync` (daily 06:00 UTC) | `.hive/automations/bamf-catalogue-sync.sh` → `src/catalogue/watch.mjs` | `bamf-catalogue-sync` |
| `evaluation-sync` (daily 14:00 UTC) | `.hive/automations/evaluation-sync.sh` → `scripts/bamf-data-sync.mjs evaluation --check` | `bamf-data-sync` |
| `pruefstellen-sync` (weekly 05:30 UTC) | `.hive/automations/pruefstellen-sync.sh` → `scripts/bamf-data-sync.mjs pruefstellen --check` | `bamf-data-sync` |
| `termine-sync` (every six hours) | `.hive/automations/termine-sync.sh` → `src/termine/publish.mjs` | None: the script publishes by itself; a job comes only when it is broken, and `src/termine/README.md` is its guide |

The job commits on its branch and the runner lands it on `main`; the daemon
pushes, and that push deploys the web. No secrets: the scripts only `GET`
public pages of bamf.de (never `HEAD`, never through a redirect - the site
sits behind a firewall). The evaluation check reports a change every day
the bundled "last checked" date is not today, so that job runs daily like
the former GitHub Action. The former scraper repository
(`leben-in-deutschland-scrapper`) is archived since 2026-11-02; nothing
reads it any more, and its `question.json` was never copied into the app
(the official PDF is the only source of questions).

The exam dates change several times a day, so their watch queues no job
(ADR-050): `src/termine/publish.mjs` lets `sync.mjs` read the centres and
pushes `termine.json` as one commit to the `data` branch - no model,
nothing on `main`, no deploy. The apps read that file from GitHub, the
website from its own origin (`/live/termine.json`, a rewrite in
`src/web/vercel.json`). It is the one push an automation of this repository
makes: `<commit>:refs/heads/data`, never with force, with the git login of
the checkout the daemon runs the script in (Hive gives a script no
credential of its own). A read that fails or a push that is refused exits
1 and shows in `hive schedule log`. The pages under `/termine` name the
registry's centres and towns before the dates arrive, from a copy inside
the web app: after every change to `src/termine/sources.json` run
`node src/termine/web-registry.mjs` (a test fails when
`src/web/data/termine-registry.json` is out of date); the change reaches
the pages with the next deploy.

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
  production artifacts, and no `*.aab` wildcard. Artifact `path:` and
  release `files:` name exactly one file, never a directory or `**`: the
  signing action decodes the keystore to `key.jks` inside the bundle
  directory, and a directory glob published it once (release v1.17.21,
  2025-09; the asset was removed on 2026-11-01 and the upload key is
  replaced through Play App Signing's upload-key reset). The "Remove the
  decoded keystore" step stays directly after signing. Third-party actions
  in the signing job are pinned to commit SHAs. Never commit, print, or
  request keystores, passwords, private keys, or encoded secret values.
- iOS release signing: the app is `org.lebenindeutschland.app` as well, built
  and uploaded to TestFlight by `.github/workflows/ios-release.yml` (ADR-047,
  PLAN-013). Both app workflows (`android-release.yml`, `ios-release.yml`)
  are started by hand; a merge to `main` deploys the web only, and the apps
  refresh their catalogue over the air. The Apple Distribution certificate (`.p12` and its password),
  the App Store Connect API key (`.p8`, key id, issuer id) and the Team ID
  live in the owner's password manager and reach GitHub Actions only as the
  secrets `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`,
  `ASC_API_KEY_BASE64`, `ASC_KEY_ID`, `ASC_ISSUER_ID` and `APPLE_TEAM_ID`.
  `src/ios/App/ExportOptions.plist` keeps a `TEAM_ID_PLACEHOLDER`; the
  workflow fills it at run time. The Release configuration signs manually
  with the App Store profile "Leben in Deutschland App Store", which
  `src/store/asc-profile.mjs` creates for the distribution certificate and
  installs on the runner; Debug stays automatic for Xcode on the owner's
  Mac. Apple raises the iOS SDK an upload must be built with every spring
  and warns by mail before (ITMS-90725): both macOS jobs run on the runner
  image of that Xcode (`xcode-27`), and the workflow stops when the SDK is
  older than its `IOS_SDK_MAJOR` - raise the image label and that number
  together. Release to the App Store is a manual step in App Store Connect. Never
  commit, print, or request certificates, keys, profiles or the Team ID. The
  numeric Apple ID of the app is public since the app is in the App Store:
  its App Store URL lives in `siteConfig.links.appStore`, which the app
  reads, and the README links the same page. The store scripts find the app
  by its bundle id and never carry the id.
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
work carries it in the work-unit or plan record (`hive guide`,
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
| Product or architecture decision | `hive record list context`, `architecture`, `adr`, and `memory` for the project | Tier 2: an ADR record, and the owner's explicit yes before implementation |
| New feature or bug fix | Relevant source, tests, and the project's records | Tier 1: a work-unit record naming its ADR; memory only for a durable lesson |
| Android release signing | The signing rule above, `.github/workflows/android-release.yml`, Android config | Nothing in the repository holds secret values |
| iOS release signing, TestFlight, App Store | The iOS signing rule above, `.github/workflows/ios-release.yml`, `src/store/README.md` (App Store Connect), `hive record show PLAN-013` | Nothing in the repository holds secret values; the owner submits to review by hand |
| Play products, store listing or track upload | `src/store/README.md`, the `play-console-publish` skill | Change `src/store/metadata/`, never a key; production promotion stays the owner's click |
| App Store products or listing | `src/store/README.md` ("App Store Connect from the command line"), the `app-store-connect-publish` skill | Change `src/store/metadata/`, never a key |
| BAMF question catalogue (official PDF) | `src/catalogue/README.md`, the `bamf-catalogue-sync` skill | Only `apply.mjs` writes `src/web/data/question.json`, and only the safe part |
| Exam dates (Termine: sources, adapters, the published file, alerts) | `src/termine/README.md`, `hive record show ADR-050`, `src/web/utils/termine-watch.ts` | Only `sync.mjs` writes `termine.json` (`publish.mjs`, run by the Hive automation `termine-sync`, pushes it to `data` and nothing else, never with force); a date is `free` only when the centre's page says so, anything unclear is `unknown`; a new centre is an entry in `sources.json` (`discover.mjs`), a new course system an adapter with fixtures; the watch list stays on the device |
| Evaluation status or exam centres (bamf.de data) | The `bamf-data-sync` skill, `scripts/bamf-data-sync.mjs` | Only the script writes the two data files; never edit the data by hand |
| A standing check or sync (automation) | `.hive/automations/`, the "Automations" section above, `hive manifest check` | One YAML file per automation plus its script beside it in `.hive/automations/` as `<name>.sh`; prefer a watch over a job that runs every time |
| Legal pages (`/impressum`, privacy policy, footer and About links) | `hive record show MEM-legal-notice-names-a-natural-person-ddg-mstv-leben-in-deutschland` | Keep the named person, address and contact consistent across all of them; never link the EU ODR platform |
| Learning or mistake | `hive record list memory --project leben-in-deutschland` | A `finding` on the board, or a `MEM-*` record when it is durable |
