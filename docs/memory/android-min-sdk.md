---
id: MEM-007
title: Keep the Android minSdkVersion at 24 or Higher for Google Play
date: 2026-10-11
tags: [memory, android, google-play, capacitor, release]
---

# Memory: Keep the Android minSdkVersion at 24 or Higher for Google Play

## Lesson

Google Play's automatic integrity protection (switched on for this app in the
Play Console) refuses app bundles whose `minSdkVersion` is below 24. The
2.1.0 bundle was built, signed and released by the workflow without any
error and was rejected only at upload time:

> Play automatic protection requires a minimum SDK version of 24 or higher.
> The uploaded App Bundle has a minimum SDK version of 23.

The value lives in `src/android/variables.gradle` (`minSdkVersion = 24`), and
`app/build.gradle` reads it from there. Capacitor's default for Android is
23, so a Capacitor major upgrade or a `cap migrate` run may write 23 back.

## When To Apply

- After any Capacitor upgrade or migration: re-read `variables.gradle` and
  keep `minSdkVersion` at 24 or above.
- Before a release, the local proof is the merged manifest after
  `./gradlew bundleRelease`:
  `app/build/intermediates/packaged_manifests/release/*/AndroidManifest.xml`
  must contain `<uses-sdk android:minSdkVersion="24" ...>`. A commented
  `<!-- <uses-sdk android:minSdkVersion="14"/> -->` line in that file comes
  from a library manifest and has no effect.
- The alternative (turning automatic integrity protection off in the Play
  Console) was not chosen; Android 6.0 devices are a negligible share and the
  protection is worth keeping.

## Notes

- The minimum SDK is not shown in the GitHub release; only Play checks it.
- No Java/Kotlin code in `src/android/app` branches on `SDK_INT`, so raising
  the minimum did not leave dead checks behind.
