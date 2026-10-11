---
id: PLAN-006
title: Add a Tip Jar Through Google Play Billing
status: Done
date: 2026-10-10
tags: [plan, android, billing, monetization]
---

# Plan: Add a Tip Jar Through Google Play Billing

## Goal

Let Android learners send the developer a small, medium, or large thank-you
from the settings page. Nothing is locked behind it, nothing changes for the
website, and the learner's stored record is not touched. See
[`ADR-004`](../decisions/ADR-004-tip-jar-play-billing.md) and
[`FEAT-002`](../features/002-tip-jar.md).

## Context

- Google Play requires its own billing system for payments made inside the
  app, including tips to the developer. Links to outside payment pages are
  not allowed inside the app.
- The Android project already carries one local Capacitor plugin
  (`AppSystemBarsPlugin.java`) and release builds are minified with the
  Capacitor annotation keep rule from
  [`capacitor-r8-annotations.md`](../memory/capacitor-r8-annotations.md).
- Native bridges on the web side live in `src/web/services/`; stored data
  helpers in `src/web/utils/`.
- The learner record (`localStorage` key `user`, schema 2) is covered by
  `__tests__/legacy-compat.test.ts` with a real 2.0 record. The tip jar must
  not add, rename, or depend on any field in it.

## Steps

- [x] Native plugin `src/android/app/src/main/java/org/lebenindeutschland/app/TipJarPlugin.java`
      on Play Billing Library 9.1.0: `getProducts`, `purchase`,
      `recoverPurchases`; every purchase is consumed so it can be repeated.
      Register it in `MainActivity.java`; add the library to
      `app/build.gradle` (version pinned in `variables.gradle`).
- [x] Web bridge `src/web/services/tip-jar.ts` (product ids `tip_small`,
      `tip_medium`, `tip_large`; Android only; lazy plugin registration) and
      `src/web/utils/support-store.ts` (own key `lid:support`, never the
      `user` record).
- [x] `SupportSection` in settings (Android only; hidden until the store
      returns products), German and English strings, a heart icon.
- [x] Privacy policy: name Google Play's billing system as the payment
      processor for optional tips (owner reviews the legal wording).
- [x] Tests: store helper, bridge, section; existing settings tests keep
      passing; record stays byte-identical after a tip.
- [x] Build: `npm test`, lint, types, `npm run build`, Gradle debug and a
      minified release build; device check through the Capacitor bridge
      (`getProducts` and `recoverPurchases` reach Play and come back empty
      because the products do not exist yet).
- [x] Docs: ADR-004, FEAT-002, memory note on Play Billing, context and
      architecture updates, usage log.

## Owner Steps (Play Console, cannot be done from the repository)

These remain open after the repository work is done; the section stays
hidden in the app until step 2 is complete.

Status 2026-10-11: the keyless setup is complete (the `play-publisher`
service account, impersonation for the owner's login, the GitHub identity
pool pinned to this repository, the two GitHub Actions variables, and the
Play Console invite with "Manage store presence"). Step 2 is done:
`play-products.mjs --apply` created `tip_small`, `tip_medium`, `tip_large`
and activated them (ACTIVE, 1,99 / 4,99 / 9,99 € in Germany, 174 regions)
after a fix for Play's "new regions must be rounded" rule. The store
listing (texts with the BAMF notice, screenshots, feature graphics) was
published the same day. Open: step 1 (payments profile) is an owner
decision not visible from the repository; steps 3 and 4 remain.

1. Set up a payments profile (Play Console → Setup → Payments profile; tax
   and bank details). Google is the seller of record and handles VAT.
2. Create the products `tip_small`, `tip_medium`, `tip_large` and activate
   them. Either run `node src/store/play-products.mjs --apply` with the
   keyless service account (`PLAY_SERVICE_ACCOUNT` plus your `gcloud`
   login, or the Play Publish workflow; setup in `src/store/README.md`,
   "Google Play from the command line"), which takes the German and English names, the
   descriptions and the euro prices from
   `src/store/metadata/android/one-time-products.json` (Kaffee 1,99 €,
   Kuchen 4,99 €, Abendessen 9,99 €), or create them by hand under Monetize
   with Play → Products → One-time products with the same values. The app
   shows the store name and price, so wording and prices can change later
   without an app update.
3. Add your Google account under Settings → License testing so test purchases
   are free, then install the app from an internal testing track. Play
   Billing only completes purchases for builds installed through Play with
   the Play signing key.
4. Review the Data safety form if it asks about purchases. The app itself
   stores no purchase data beyond a tip counter on the device.

## Rollback Plan

- **Baseline:** uncommitted `feat/ui-ux-revamp` on top of `c295bc7` as of
  2026-10-10 06:20 CEST; 32 test files, 896 tests, lint and types clean;
  `git status --short src/android` empty. Copies of every file this plan
  edits are in the session workspace (`files/pre-tipjar/`).
- **Trigger:** a failing test, lint, or type check that cannot be fixed in
  the same step; a Gradle build that fails; a release build whose plugin
  cannot be called; any change to the shape of the stored learner record.
- **Reversal:** delete the new files (`TipJarPlugin.java`,
  `services/tip-jar.ts`, `utils/support-store.ts`,
  `components/preferences/support-section.tsx`, the three tests, ADR-004,
  FEAT-002, the memory note); `git checkout -- src/android/app/build.gradle
  src/android/variables.gradle
  src/android/app/src/main/java/org/lebenindeutschland/app/MainActivity.java`;
  copy the other edited files back from the snapshot. No npm dependency is
  added, so `package.json` and the lockfile stay untouched.
- **State safety:** no stored field changes; the tip counter lives under its
  own key and is ignored when missing. No Play Console or deployment change
  is made by this plan. The owner's phone keeps its record because the build
  is installed with `adb install -r`.
- **Recovery verification:** `cd src/web && npm test` reports 896 tests,
  lint and `npx tsc --noEmit` are clean, `./gradlew assembleDebug` succeeds,
  `git status --short src/android` is empty.

## Acceptance Criteria

- [x] On Android, settings shows a "Support" section with three tiles named
      and priced by the store; a completed purchase is consumed, thanked,
      and counted; cancel does nothing; a pending or failed payment is
      explained.
- [x] On the website and when billing is unavailable, nothing is shown.
- [x] The learner record is byte-identical before and after a tip (test).
- [x] `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`,
      Gradle debug and release builds pass.

## Verification

```bash
cd src/web && npm test
cd src/web && npm run lint
cd src/web && npx tsc --noEmit
cd src/web && npm run build:android
cd src/android && ./gradlew assembleDebug
cd src/android && ./gradlew assembleRelease
```

## Evidence (2026-10-10)

- Billing Library 9.1.0 API confirmed with `javap` against the downloaded
  AAR before writing the plugin (`ProductDetailsResponseListener` takes
  `QueryProductDetailsResult`; offers carry `getOfferToken()`).
- `cd src/web && npx vitest run`: 35 files, 915 tests (+3 files, +19
  tests); `npx eslint .` clean after moving a `setState` out of the
  synchronous effect body (React Compiler rule); `npx tsc --noEmit` clean;
  `npm run build` 77 pages; `npm run build:android` synced.
- `./gradlew assembleDebug` and `./gradlew assembleRelease` pass; the R8
  seeds file keeps `TipJarPlugin.getProducts/purchase/recoverPurchases`.
- Device (Samsung S20 FE, Android 13), debug build installed with
  `adb install -r` over the owner's record (BE, 54 answers, 1 mock, schema
  2 - unchanged before and after): `Capacitor.Plugins.TipJar.getProducts`
  → `{available:true, products:[]}`, `recoverPurchases` → `{consumed:0}`,
  `purchase({id:"tip_small"})` → `{state:"unavailable", message:"Product
  not found: tip_small"}`, `getProducts({ids:[]})` rejected as designed;
  logcat `TipJar`: `products: code 0, 0 found, 3 unfetched`,
  `recover: 0 unconsumed`. Settings shows all seven existing sections and
  no support section while Play has no products.
- UI check with the bridge intercepted in DevTools (fake products, fake
  "purchased" for one tile): section renders heading, three tiles with
  name and price, loading state disables the other tiles, success toast,
  "Du hast 1-mal Trinkgeld gegeben. Danke!", `lid:support` written, `user`
  byte-identical; a real Play purchase of a missing product shows the
  failure toast. The fake counter was removed from the phone afterwards.
- Minified release APK signed locally with the debug key and installed over
  the debug app: not debuggable, record intact, logcat shows the plugin
  answering (`recover: 0 unconsumed`, `products: code 0, 0 found, 3
  unfetched`). Debug build reinstalled afterwards.
- `git status --short src/android`: `app/build.gradle`, `variables.gradle`,
  `MainActivity.java` modified; `TipJarPlugin.java` new. Nothing committed.

