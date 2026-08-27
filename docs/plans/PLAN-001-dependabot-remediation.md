---
id: PLAN-001
title: Remediate Open Dependabot Alerts
status: Rolled Back
date: 2026-08-27
tags: [plan, dependencies, security]
---

# Plan: Remediate Open Dependabot Alerts

## Goal

Update the web application's npm dependency graph so every Dependabot alert
open on 2026-08-27 is resolved without changing product behavior or the
Next.js static-export and Capacitor 7 boundaries.

## Context

- Git baseline: clean worktree at commit
  `5ce9ce92cde9827f6f0d518ffcc73054c9596eaf` on branch
  `fix/android-upload-signing`.
- GitHub reports 41 open alerts in `src/web/package-lock.json`: 1 critical,
  23 high, 16 medium, and 1 low.
- `npm audit` reproduces those advisories as 17 vulnerable packages.
- Direct upgrades are available for Next.js, PostCSS, Sharp, jsdom, ESLint's
  Next.js configuration, and Capacitor 7 tooling.
- `@capacitor/assets@3.0.5` is the latest published release but still pins old
  transitive packages. Narrow npm overrides may be needed where no upstream
  release can select a patched version.
- The application is a static export. No deployment, database, persisted user
  data, Android signing material, or external service state is in scope.
- GitHub will close the hosted alerts only after the fixed lockfile reaches
  the repository's default branch. Local completion is measured with the
  regenerated dependency graph and `npm audit`.

## Steps

- [x] Capture the Git baseline, open alerts, local audit, and dependency paths.
- [x] Update direct dependencies to supported patched versions while keeping
  Next.js 16, React 19, and Capacitor 7.
- [x] Replace stale security overrides and add only the overrides required for
  transitive packages whose parents cannot select a patched release.
- [x] Regenerate `src/web/package-lock.json` with npm and confirm each alerted
  package resolves to a non-vulnerable version.
- [x] Run the web test suite, lint, and production static-export build.
- [x] Record verification evidence, final plan status, and work accounting.

## Rollback Plan

- **Baseline:** The worktree was clean at
  `5ce9ce92cde9827f6f0d518ffcc73054c9596eaf`. Expected task-owned files are
  `src/web/package.json`, `src/web/package-lock.json`, this plan, and
  `docs/usage/usage-log.md`.
- **Trigger:** Roll back the dependency changes if an upgrade causes a
  reproducible test, lint, or production build regression that cannot be
  corrected within the supported Next.js 16, React 19, and Capacitor 7
  boundaries, or if the resulting graph still contains a reported vulnerable
  version.
- **Reversal:** Apply a precise inverse patch to restore the original
  `package.json` and `package-lock.json` content. Keep this plan and mark the
  failed step and evidence instead of hiding the attempt.
- **State safety:** Do not deploy, publish, sync native projects, modify
  signing configuration, or write external state. `node_modules` and build
  output are generated local files and are not the source of truth.
- **Recovery verification:** Run `cd src/web && npm ci`, followed by the
  previously passing `npm test`, `npm run lint`, and `npm run build` checks,
  then inspect `git status` to confirm only the plan and its evidence remain.

## Original Acceptance Criteria

- [x] `npm audit --audit-level=low` reports zero vulnerabilities.
- [x] Every package named by the 41 captured Dependabot alerts resolves at or
  above its patched version and outside all reported vulnerable ranges.
- [x] `cd src/web && npm test` passes.
- [x] Lint introduces no regression: the updated and baseline dependency
  graphs report the same 20 existing errors at the same locations.
- [x] `cd src/web && npm run build` completes the static export.
- [x] No product source, deployment, Android signing, or external state is
  changed.
- [x] The rollback plan remains scoped and executable.

## Verification

```bash
cd src/web && npm audit --audit-level=low
cd src/web && npm test
cd src/web && npm run lint
cd src/web && npm run build
```

Results on 2026-08-27:

- A clean `npm ci` completed, and `npm audit --audit-level=low` reported
  `found 0 vulnerabilities`.
- All 41 live GitHub advisory ranges were checked against the regenerated
  lockfile; none contains an installed vulnerable version.
- Vitest passed 11 test files and 135 tests.
- Next.js 16.3.3 built and exported all 74 static pages.
- `cd src && make build-sync` completed the same build and Capacitor Android
  sync used by the release workflow without creating tracked Android changes.
- `npm run lint` reports 20 errors. Running the untouched baseline commit in
  an isolated session copy reports the same 20 errors at the same locations,
  so the dependency remediation adds no lint regression.
- `npm ls --all` retains the baseline's three existing peer/version warnings:
  missing jQuery for `slick-carousel`, HeroUI's Tailwind 4 peer expectation,
  and an `fdir`/`picomatch` mismatch.

## Rollback Execution

Rollback completed on 2026-08-27 after production Android version code 147
was reported broken.

- **Trigger confirmed:** Run 146 used commit `522a9e1`; run 147 used merge
  `73bda66`. The only runtime files changed between those releases were
  `src/web/package.json` and `src/web/package-lock.json` from dependency
  remediation commit `b2b1303`.
- **Reversal:** Applied the precise inverse of `b2b1303` to those two package
  files only. Preserved the later application version `2.0.119`, PULSE
  records, and Android signed-artifact workflow fix.
- **Recovery verification:** After normalizing only the version fields, both
  package files exactly match the run-146 baseline. A clean npm install,
  135 tests, the 74-page static export, and Capacitor Android sync passed.
- **State safety:** No release was deleted, no signing secret or Play Console
  setting changed, and no production deployment was triggered.
- **Remaining risk:** The rollback reopens 17 npm audit findings representing
  the 41 Dependabot alerts. Remediate them in small groups and require an
  installed signed-bundle smoke test on an internal track before production.
