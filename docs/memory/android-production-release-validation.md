---
id: MEM-001
title: Validate Android Runtime Changes Before Production
date: 2026-08-27
tags: [memory, android, release, dependencies]
---

# Memory: Validate Android Runtime Changes Before Production

## Lesson

A passing web build, unit test suite, Capacitor sync, and Gradle bundle build
do not prove that the installed Android release works.

Changes to Next.js, React, Capacitor, native plugins, or the npm lockfile must
pass an installed, correctly signed app-bundle smoke test on a Play internal
testing track or a representative device before production promotion.

Do not batch unrelated runtime dependency upgrades into one production
release. Upgrade and stage small groups so a failure can be isolated and
reversed without discarding unrelated security fixes.

## When To Apply

- Before merging runtime dependency changes that trigger the Android release
  workflow.
- Before promoting an Android bundle from internal testing to production.
- When planning Dependabot remediation that affects the exported web runtime
  or Capacitor wrapper.

## Verified Incident

Android workflow run 146 at commit `522a9e1` was the known-good baseline.
Production version code 147 at merge commit `73bda66` was reported broken.
The only runtime files changed between those runs were
`src/web/package.json` and `src/web/package-lock.json`.

The emergency recovery restored those two files to the run-146 dependency
graph while preserving application version `2.0.119`.

Related records:

- [`PLAN-001-dependabot-remediation.md`](../plans/PLAN-001-dependabot-remediation.md)
- [`PLAN-002-android-release-signed-artifact.md`](../plans/PLAN-002-android-release-signed-artifact.md)
