# Workflow - Android Release (Go-Live)

Repeatable steps for shipping a new app version to Google Play. The pipeline
in `.github/workflows/android-release.yml` builds and signs the bundle; the
upload to the Play Console is a manual owner step, so merging never publishes
to learners by itself.

## Before the merge

1. All checks green from `src/web`: `npm test`, `npm run lint`,
   `npx tsc --noEmit`, `npm run build`, `npm run build:android`.
2. Web flavour viewed in a desktop browser (`npm run build`, serve
   `src/web/out/`) at desktop, tablet, 390 and 360 px, light and dark, as a
   fresh, a modern and a 2.0 learner; no cut labels in dialogs, drawer
   headers or tiles (`docs/memory/web-browser-check.md`). The website ships
   from the same merge as the app.
3. Release flavour built once locally (R8 and resource shrinking are on only
   in release): `cd src/android && ./gradlew assembleRelease` with JDK 21.
   Sign the unsigned APK with the local debug keystore and run it on a phone
   (recipe in `docs/memory/android-device-testing.md`); confirm the custom
   plugins log normally (`TipJar`, system bars) and reminders appear in
   `adb shell dumpsys alarm`.
4. Version bump in `src/web/package.json`: the workflow uses it as
   `versionName` and as the GitHub release tag `v<version>`; `versionCode`
   is the workflow run number, so the Gradle file keeps `1` / `"1.0"`.
5. Remote content ready: `services/notices.ts` reads `notices.json` from the
   `content` branch (missing file = no notices, retried daily);
   `services/questions.ts` and `services/evaluation.ts` read from `main` and
   the scraper repository. Create or refresh the `content` branch when a
   notice should greet upgraded learners.
6. Play Console prepared: one-time products `tip_small`, `tip_medium`,
   `tip_large` exist and are active (`node src/store/play-products.mjs
   --list`, create with `--apply`; see `docs/memory/android-play-billing.md`);
   store listing, screenshots, and release notes updated from
   `docs/features/006-store-assets.md` output (`node src/store/play-listing.mjs
   --validate`, then `--apply`); data-safety answers still true (the app
   downloads public JSON, sends nothing).
7. Schema compatibility re-read: the learner record stays schema 2 and
   `normalizeUser` in `utils/user-store.ts` accepts every older shape
   (`docs/features/001-ui-ux-revamp.md`, `__tests__/legacy-compat.test.ts`).

## The merge

1. Open a pull request from the feature branch; review against the PLAN and
   FEAT files it closes.
2. Merging to `main` triggers two workflows: `android-release.yml` (tests,
   signed AAB, signature check against the expected SHA-1, GitHub release)
   and `vercel-deploy.yml` (the website gets the same build).
3. Download the signed AAB from the GitHub release. It is named
   `leben-in-deutschland-v<versionName>-<versionCode>.aab`; the versionCode
   is the workflow run number and is what Play lists.

## Rollout

1. Upload the AAB to the **internal testing** track first; install it from
   Play on at least one phone. Only a Play-installed build can show the
   in-app review sheet, run real tip purchases (license testers), and offer
   in-app updates. Play rejects bundles with `minSdkVersion` below 24 while
   automatic integrity protection is on; `src/android/variables.gradle` keeps
   24 (`docs/memory/android-min-sdk.md`).
2. Check on that install: upgrade from the previous version keeps the record
   (classic prompt appears once for finished records), reminders are
   scheduled, tip products load with prices, notices load when the `content`
   branch has a file.
3. Promote to production with a staged rollout (for example 20 %), watch
   Play vitals and the review inbox for two or three days, then complete.

## Rollback

- Play: halt the staged rollout or publish the previous AAB (kept on the
  GitHub release page) as a new release with a higher `versionCode`.
- Code: revert the merge commit on `main`; the workflows rebuild and redeploy.
- Learner data never needs migration back: records written by the new
  version remain readable by the old one (schema 2 additive fields).
- Follow [`rollback.md`](rollback.md) for the control-plane steps.

## Known limits

- Phones that ran a debug-signed test build must uninstall it before a Play
  install (different signing key); export the record first through Settings
  → Export, import after.
- Only one device model (Samsung S20 FE, Android 13) was used for the 2.1
  checks; Android 14/15 behaviour of exact alarms and edge-to-edge is
  covered by Capacitor defaults, not by a device run.
