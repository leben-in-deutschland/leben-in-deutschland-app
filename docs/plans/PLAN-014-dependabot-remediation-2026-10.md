---
id: PLAN-014
title: Remediate the October 2026 Dependabot Alerts
status: Completed
date: 2026-10-12
tags: [plan, dependencies, security]
---

# Plan: Remediate the October 2026 Dependabot Alerts

## Goal

Resolve every Dependabot alert open on 2026-10-12 in
`src/web/package-lock.json` without changing product behavior, the Next.js
static-export boundary, Capacitor 7, Tailwind 3, or the lint baseline.

## Context

- Git baseline: clean worktree at `681920c` (`main`, after #156).
- GitHub reports 33 open alerts, all in `src/web/package-lock.json`:
  6 critical, 8 high, 15 medium, 4 low. Direct packages: `@capacitor/android`
  and `@capacitor/ios` (remote content at the app origin, fixed in 7.6.9),
  `next` (7 advisories, fixed in 16.3.8), `sharp` (0.35.5), `vitest` and
  `@vitest/mocker` (4.1.11). Transitive: `handlebars` (via
  `@capacitor/assets`, dev tooling only), `undici` (via `jsdom`),
  `browserslist`, `baseline-browser-mapping`, `brace-expansion` (1.x, 2.x,
  5.x), `@humanfs/node`, `source-map-js`, `postcss-selector-parser`.
- Every transitive package except `postcss-selector-parser` has a patched
  release inside the range its parent already declares, so `npm update` on
  those names is enough. Tailwind 3.4.19 (the last 3.x) pins
  `postcss-selector-parser@^6`, and the CPU-exhaustion fix
  (GHSA-rj75-hqrm-r3gf) exists only in 7.1.6; 7.0.0's single breaking change
  was "make insertions during iteration safe". A narrow npm override is the
  only way to reach it.
- `braces <= 3.0.3` (GHSA-vfj7-8cjw-p6xm) has no patched release at all -
  3.0.3 is the latest - so `npm audit` keeps reporting it through
  `micromatch`, `fast-glob`, `chokidar`, `globby`, `del`, `tempy`,
  `tailwindcss`, `@trapezedev/project`, `@next/eslint-plugin-next` and
  `eslint-config-next`. All of these are build- or dev-time glob matching on
  trusted patterns. Out of scope until upstream publishes a fix.
- `eslint-config-next` carries no alert of its own. Raising it to 16.3.8
  pulls `eslint-plugin-react-hooks` 7.1.1, whose stricter
  `react-hooks/immutability` and `react-hooks/set-state-in-effect` rules
  flag 16 lines in the retired classic module (`src/web/classic/components/`
  `prepare-quiz.tsx`, `quiz-answer.tsx`, `quiz.tsx`). That is a separate
  task; this plan keeps `eslint-config-next@^16.3.3`.
- The repository is a static export. No deployment, user data, signing
  material, or external state is in scope. GitHub closes the hosted alerts
  only after the fixed lockfile reaches `main`.

## Steps

- [x] Capture the baseline: open alerts, `npm audit`, dependency paths, and a
  production build whose CSS fingerprint is kept for comparison.
- [x] Bump the direct ranges: `@capacitor/android|cli|core|ios` to `^7.6.9`,
  `next` to `^16.3.8` (locked to 16.3.8, not the newer 16.4.0 npm would
  pick), `sharp` to `^0.35.5`, `vitest` to `^4.1.11`.
- [x] Add the override `postcss-selector-parser: 7.1.6`.
- [x] `npm update` the eight transitive names; regenerate the lockfile.
- [x] Check every alerted package against the live advisory ranges.
- [x] Run audit, lint, type-check, tests, build, Capacitor sync, and an
  unsigned minified Android release build.
- [x] Record evidence, index the plan, note the lessons, and account.

## Rollback Plan

- **Baseline:** clean worktree at `681920c`. Task-owned files are
  `src/web/package.json`, `src/web/package-lock.json`, this plan,
  `docs/plans/README.md`, `docs/context/stack.md`,
  `docs/memory/classic-design-module.md`, and `docs/usage/usage-log.md`.
- **Trigger:** a reproducible test, lint, build, Capacitor sync, or Android
  release-build regression that cannot be corrected inside Next.js 16,
  React 19, Capacitor 7, and Tailwind 3; or an alerted package still inside
  its vulnerable range.
- **Reversal:** `git checkout 681920c -- src/web/package.json
  src/web/package-lock.json`, then `cd src/web && npm ci`. Keep this plan and
  mark the failed step.
- **State safety:** nothing is deployed, published, signed, or synced to an
  external system. `node_modules`, `out/`, `.next/`, and
  `src/android/app/build/` are generated and not the source of truth;
  `npx cap sync android` left no tracked Android change.
- **Recovery verification:** `npm ci`, `npm test`, `npm run lint`,
  `npm run build` pass as before, and `git status` shows only the plan.

## Acceptance Criteria

- [x] Every package named by the 33 alerts resolves outside its vulnerable
  range (checked with `semver` against the lockfile).
- [x] `npm audit --audit-level=low` reports only the unfixable `braces`
  chain (11 entries, all `via: braces`).
- [x] `npm run lint` exits 0 with no findings, as on `main`.
- [x] `tsc --noEmit` is clean; Vitest passes 62 files / 1293 tests.
- [x] `npm run build` exports all 77 pages and the concatenated CSS of
  `out/` is byte-identical to the baseline (`162c4f7c398d6639`), proving the
  `postcss-selector-parser` 7.1.6 override changes nothing Tailwind emits.
- [x] `npx cap sync android` succeeds without tracked changes;
  `./gradlew assembleRelease` (JDK 21 toolchain, R8 on) produces
  `app-release-unsigned.apk` with `@capacitor/android` 7.6.9, and the R8
  mapping keeps `com.getcapacitor.annotation.*` unrenamed (MEM-002).
- [x] No product source, deployment, signing, or external state changed.

## Verification

```bash
cd src/web && npm audit --audit-level=low
cd src/web && npm run lint && npx tsc --noEmit -p . && npx vitest run
cd src/web && npm run build && npx cap sync android
cd src/android && JAVA_HOME=<jdk21> ./gradlew assembleRelease \
  -Dorg.gradle.java.installations.paths=<jdk21>
```

Results on 2026-10-12: all of the above as listed under acceptance criteria.
68 lockfile entries changed, 34 of them `sharp`/`@next/swc` platform
binaries; the rest are the named packages and in-range companions
(`caniuse-lite`, `electron-to-chromium`, `node-releases`,
`update-browserslist-db`, `chai`, `tinyrainbow`, `@humanfs/core|types`).

## Follow-ups

- Raise `eslint-config-next` past 16.3.3 only together with a fix for the
  16 classic-module findings (immutable updates instead of mutate-and-save),
  or an explicit, scoped lint decision.
- Re-check `braces` when upstream publishes a release above 3.0.3.
- Drop the `postcss-selector-parser` override when Tailwind declares `^7`
  (Tailwind 4 no longer uses it).
- Run the minified build on a device once (MEM-002); no device was attached
  in this session.
