---
id: MEM-003
title: Test Android Behavior on a Device, Not Only in jsdom
date: 2026-10-09
tags: [memory, android, capacitor, notifications, back-button, testing]
---

# Memory: Test Android Behavior on a Device, Not Only in jsdom

## Lesson

Three Android-only behaviors are invisible to unit tests and headless browser
screenshots and were only found with the app running on a phone:

1. **Hardware Back is WebView history by default.** Capacitor steps the
   WebView history unless the app registers an `App.addListener("backButton")`
   handler. That silently left a running mock exam. Keep the handler in
   `src/web/components/shell/use-back-button.ts`; screens claim a press with
   `useBackButton(handler, enabled)`.
2. **A debounced effect must not drop a pending run on an equal input.**
   `useNativeNotifications` compared a plan signature and returned early when
   it was unchanged, but React had already run the previous effect's cleanup
   and cleared the timer. Writes that follow onboarding within 800 ms
   (startup stamp, welcome inbox items) therefore cancelled the only sync.
   Keep the timer in a ref and clear it only when the signature changes or on
   unmount. `__tests__/notification-sync.test.tsx` guards this. Re-verified
   on the device on 2026-10-10 with a real onboarding run: `schedule` fired
   860 ms after "Start learning" and `getPending` listed eight reminders.
3. **Plugin calls are the proof.** Capacitor logs every bridge call at verbose
   level: `adb logcat -d | grep "Capacitor/Plugin: To native"`. A healthy
   reminder sync shows `checkPermissions, createChannel x4, getPending,
   [cancel], schedule`; a sync with an empty plan stops after `getPending`.
4. **Probe a URL from the phone before building on it.** The project's own
   domain answered `429` with `x-vercel-mitigated: challenge` to `curl`, to
   an Android user agent, and to `Capacitor.Plugins.CapacitorHttp.get` run
   through DevTools on the device, while `raw.githubusercontent.com` answered
   `200`. A ten-second check through the real native client (ADR-005)
   avoided shipping a fetch that could never succeed. Native requests show
   up in the plugin trace as `pluginId: CapacitorHttp`.
5. **Native replies bypass `Capacitor.fromNative` on Android.** Results
   arrive through `androidBridge.onmessage` → `JSON.parse(event.data)`, so
   a page script that wraps `JSON.parse` and watches for
   `pluginId: "CapacitorHttp"` is the only way to see the real status code
   and headers from DevTools. That trace confirmed `raw.githubusercontent.com`
   answers `304` with an empty body to `If-None-Match` and `404` with a
   14-byte text body for a missing file (ADR-006).
6. **Check the real screen before fixing a rendering "bug".** DevTools'
   `Page.captureScreenshot` on this phone painted the text of some
   same-styled elements at a visibly smaller size while layout, computed
   styles, and `CSS.getPlatformFontsForNode` all agreed; `adb exec-out
   screencap -p` showed them identical. Trust `screencap` for pixels and
   CDP for the DOM.

## When To Apply

- Before declaring any change to navigation, dialogs, exams, onboarding, or
  notifications finished for Android: install a debug build on a device with
  `adb install -r` (never uninstall; the stored record must survive) and walk
  the flows, pressing the hardware Back button on each screen type.
- When writing a debounced or throttled effect in React: never let an early
  return skip re-arming a timer that a cleanup may have cleared.
- When a reminder "should have been scheduled" but is not: read the plugin
  call log before changing code.

## Notes

- Samsung devices with Secure Folder can fail `adb shell pm list packages`
  with a "user 150" SecurityException; read the application id from
  `src/android/app/build.gradle` instead.
- Once per cold start the WebView logs
  `Cannot read properties of undefined (reading 'triggerEvent')`. The native
  bridge fires `resume` before the page script exists. It also happens with
  the released 2.0 app and has no visible effect; do not chase it.
- Debug builds only touch ignored folders under `src/android/`; confirm with
  `git status --short src/android` before finishing.
- Gradle needs a JDK 21 toolchain. The default Zulu 17 fails toolchain
  detection and a JDK unpacked under `/tmp` disappears between sessions; use
  Homebrew `openjdk@21` and pass it explicitly:
  `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
  ./gradlew assembleDebug -Dorg.gradle.java.installations.paths=$JAVA_HOME`.
- `@capacitor/local-notifications` 7 applies `BigTextStyle` when `largeBody`
  is set and then `InboxStyle` when `inboxList` is set, so `inboxList` wins
  and `largeBody` is dropped; never set both on one card. Action types are
  stored natively, so buttons registered once still render at alarm time.
- `adb install` prints `- waiting for device -` forever when the phone is
  unplugged; check `adb get-state` first and poll instead of blocking.
- `adb shell monkey -p <app> -c android.intent.category.LAUNCHER 1` injects
  one random input event after launching; with a dialog open it can press a
  button (it chose "keep classic" once). Use
  `adb shell am start -W -n <app>/.MainActivity` for launches during tests.
- A dozing screen gives black `screencap` images while CDP still works;
  `input keyevent KEYCODE_WAKEUP` and `svc power stayon usb` during a run,
  `svc power stayon false` afterwards.
- Testing the real release flavour (R8 + shrinkResources) on a phone without
  the CI secrets: `./gradlew assembleRelease` (JDK 21), then from
  `build-tools/<ver>/`: `zipalign -f -p 4 app-release-unsigned.apk aligned.apk`
  and `apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android
  --key-pass pass:android --ks-key-alias androiddebugkey --out signed.apk
  aligned.apk`. Same signer as the debug build, so `adb install -r` keeps the
  data. Release builds have no WebView debugging: check with `screencap`,
  `input tap`, logcat tags (`TipJar`), and `dumpsys alarm | grep <app>`
  (reminders show `exactAllowReason=permission`). 2.1 release build verified
  this way on 2026-10-11: 4.1 MB APK, cold start 0.5 s, plugins log normally.
- Any debug-signed build on a phone blocks a later Play install (different
  key): export the record in Settings first, uninstall, install from Play,
  import.
- Storage durability check on this device: 75 `localStorage` writes 5.5 s
  apart followed by `am force-stop` lost nothing, so a stored value that
  "changes by itself" between checks was a real tap on the phone, not lost
  writes.

## CDP screenshots can misrender transparent buttons

`Page.captureScreenshot` through the WebView's DevTools socket painted the
text of a HeroUI `variant="light"` button (transparent background,
`transform-gpu`) dark and tiny, while the computed style said 12 px light
text and the real screen (`adb exec-out screencap -p`) was correct. Use CDP
captures for layout and presence; judge colours and text rendering from
`screencap`.
