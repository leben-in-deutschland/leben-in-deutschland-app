---
id: PLAN-002
title: Publish Only the Verified Android Release Bundle
status: Ready for Review
date: 2026-08-27
tags: [plan, android, release, signing]
---

# Plan: Publish Only the Verified Android Release Bundle

## Goal

Make the Android release workflow fail safely unless it produced the expected
signed app bundle, and publish only that verified bundle for production use.

## Context

- Git baseline: clean worktree at commit
  `2224da2e0a2415f3348910a565c20adc61c653f1` on branch
  `fix/android-release-artifact`, created from current `origin/main`.
- The successful run
  `https://github.com/leben-in-deutschland/leben-in-deutschland-app/actions/runs/33064462298`
  published three similarly named files: an unsigned `app-release.aab`, an
  intermediate `app-release-temp.aab`, and the valid
  `app-release-signed.aab`.
- The release workflow uploads the whole output directory and publishes
  `*.aab`, so a person can accidentally send the unsigned or temporary file
  to Google Play.
- The signed bundle's public certificate SHA-1 is
  `DE:8C:92:1E:CE:44:26:6D:5E:55:A0:08:3E:9D:E3:8D:C5:60:57:D0`, which
  matches the repository's known-good Play upload certificate.
- `ilharp/sign-android-release@v1.0.4` exposes the signed bundle as the
  `signedFile` output.
- Signing secrets, keystores, passwords, aliases, Play Console settings,
  application code, and existing release assets are out of scope.

## Steps

- [x] Inspect the latest release run, published files, and signed certificate.
- [x] Add a workflow gate that verifies the signed bundle and its expected
  certificate SHA-1.
- [x] Update the Java setup action to its supported major version.
- [x] Upload only the signing action's `signedFile` output as the workflow
  artifact.
- [x] Download and publish only `app-release-signed.aab` in the release job.
- [x] Record the signed-only production artifact rule in Android signing
  memory.
- [x] Validate YAML structure and run the exact verification script against
  both the current signed and unsigned bundles.
- [ ] Record verification evidence and work accounting, then publish the fix
  through a pull request.

## Rollback Plan

- **Baseline:** The branch started clean at
  `2224da2e0a2415f3348910a565c20adc61c653f1`. Expected task-owned files are
  `.github/workflows/android-release.yml`,
  `docs/memory/android-release-signing.md`, this plan, and
  `docs/usage/usage-log.md`.
- **Trigger:** Roll back if workflow syntax validation fails, the signing
  action's documented output cannot be consumed, the known-good signed bundle
  fails the new guard, or the next workflow run cannot upload and release the
  verified bundle.
- **Reversal:** Apply a precise inverse patch to the workflow. If already
  published, close the unmerged pull request or use an authorized `git
  revert` after merge.
- **State safety:** Do not change or expose signing secrets, do not replace
  the keystore, do not alter Play Console settings, and do not delete existing
  GitHub release assets. The workflow continues to build before signing.
- **Recovery verification:** Parse the restored workflow, confirm its diff is
  empty against the baseline, and verify the previously successful release
  run and signed artifact remain available.

## Acceptance Criteria

- [x] The workflow checks that `jarsigner` reports the selected AAB as
  verified.
- [x] The workflow checks the selected AAB certificate against the known-good
  SHA-1.
- [x] The workflow passes `actionlint` with a supported Java setup action.
- [x] Only the signing action's `signedFile` is uploaded between jobs.
- [x] Only `app-release-signed.aab` is attached to the GitHub release.
- [x] Android signing memory identifies the only valid production artifact.
- [x] The guard accepts the current signed bundle and rejects the unsigned
  bundle.
- [x] Workflow YAML parses successfully and `git diff --check` passes.
- [x] No signing secret, application code, Play setting, or existing release
  asset is changed.

## Verification

```bash
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/android-release.yml')"
go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/android-release.yml
git diff --check
```

Run the workflow's signature and SHA-1 guard locally against the downloaded
`app-release-signed.aab` and confirm the same guard rejects
`app-release.aab`.

Results on 2026-08-27:

- `actionlint`, Ruby YAML parsing, and `git diff --check` passed.
- The new guard accepted the current signed bundle and rejected the unsigned
  Gradle bundle.
- The signed bundle certificate matched the known-good SHA-1.
- The web build exported 74 pages, all 135 tests passed, and Capacitor Android
  sync completed without tracked generated changes.
- A local `./gradlew bundleRelease` could not start compilation because this
  machine has Java 17 and the project requires Java 21. The latest GitHub
  release run installed Java 21 and completed the same Gradle bundle task
  successfully.
