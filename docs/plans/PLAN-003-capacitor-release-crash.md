---
id: PLAN-003
title: Fix Capacitor Release-Only Permission Crash
status: Complete
date: 2026-08-27
tags: [plan, android, capacitor, r8, release]
---

# Plan: Fix Capacitor Release-Only Permission Crash

## Goal

Make the minified Android release build start and render normally without
crashing when the dashboard checks local-notification permissions.

## Context

- Git baseline: clean `main` at merge commit
  `288b3cfd1497f5008b03105f054c14e45ad688e6`.
- Android production version code 147 (`2.0.118`) was reported broken.
- A clean debug APK from current `main` starts and renders on
  `Pixel_9_Pro_API_35`.
- A minified release APK from the same source crashes on the
  `CapacitorPlugins` thread in
  `LocalNotificationsPlugin.checkPermissions()`.
- The root exception is a null `CapacitorPlugin` annotation in
  `Bridge.getPermissionStates()`.
- R8 keeps plugin classes and visible annotation attributes, but the release
  mapping rewrites Capacitor annotation types and the runtime lookup fails.
- Capacitor's consumer rules for plugin classes are present in the merged R8
  configuration, and the merged manifest already includes
  `POST_NOTIFICATIONS`.
- Public source comparison shows Local Notifications 7.0.7 uses the same
  permission-check path as 7.0.6, so a package bump alone would not fix this
  crash.
- Preserving `com.getcapacitor.annotation.**` in the app ProGuard rules keeps
  the minified release process alive and allows normal navigation.
- Production signing secrets and Play Console state are out of scope. Release
  APKs used for emulator testing use the standard local debug signing
  configuration through a session-only Gradle init script.

## Steps

- [x] Reproduce the difference between debug and minified release builds.
- [x] Capture the release stack trace and inspect merged R8 rules and mapping.
- [x] Compare the known-good dependency build and public Capacitor guidance.
- [x] Add the narrowest supported R8 rule or compatible package correction.
- [x] Build, install, and launch a minified release APK on the emulator.
- [x] Verify startup navigation, process health, and absence of fatal logs.
- [x] Run the web tests, static export, and Capacitor sync.
- [x] Record the result and publish a focused pull request if source changes
  are required.

## Rollback Plan

- **Baseline:** `main` is clean at
  `288b3cfd1497f5008b03105f054c14e45ad688e6`. Expected task-owned files are
  `src/android/app/proguard-rules.pro`, this plan,
  `docs/memory/capacitor-r8-annotations.md`, `docs/memory/README.md`, and
  `docs/usage/usage-log.md`.
- **Trigger:** Roll back if the release build still crashes, the change hides
  a different runtime failure, debug behavior regresses, or the fix requires
  broad disabling of minification or resource shrinking.
- **Reversal:** Apply a precise inverse patch to the task-owned R8 or package
  change. Keep the plan and failure evidence.
- **State safety:** Do not change signing secrets, keystores, Play settings,
  production releases, or persisted user data. Emulator installs and build
  output are disposable local state.
- **Recovery verification:** Rebuild the baseline debug APK, confirm it still
  renders, and inspect Git status to ensure only the plan evidence remains.

## Acceptance Criteria

- [x] The minified release APK installs and cold-starts on API 35.
- [x] `org.lebenindeutschland.app` remains alive and foreground after startup.
- [x] The initial dashboard/state-selection UI renders.
- [x] Logcat contains no fatal exception from Capacitor permission handling.
- [x] A basic navigation action succeeds.
- [x] Debug behavior remains unchanged.
- [x] All 135 web tests pass and the 74-page static export completes.
- [x] No production signing or Play Console state changes.

## Verification

```bash
cd src && make build-sync
cd src/web && npm test
cd src/android && ./gradlew assembleDebug
```

Build the minified release variant with the session-only debug-signing init
script, install it on `Pixel_9_Pro_API_35`, launch
`org.lebenindeutschland.app/.MainActivity`, and inspect logcat and a
screenshot.

Verified on 2026-08-27:

- 11 test files and all 135 tests passed.
- Next.js exported all 74 static pages and Capacitor synced 12 Android plugins.
- Debug and minified release APKs built successfully after the sync.
- The final release APK cold-started in 311 ms, remained foreground, opened
  the application menu, and produced zero fatal or permission-crash log
  entries.
