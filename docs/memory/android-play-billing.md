---
id: MEM-004
title: Google Play Billing in the Android App
date: 2026-10-10
tags: [memory, android, billing, capacitor]
---

# Memory: Google Play Billing in the Android App

## Lesson

The tip jar talks to Google Play through a local Capacitor plugin
(`src/android/app/src/main/java/org/lebenindeutschland/app/TipJarPlugin.java`)
on the Play Billing Library, pinned as `playBillingVersion` in
`src/android/variables.gradle`. Five facts keep it working:

1. **Google retires old library majors.** New app versions must use a
   library major that Google still accepts (roughly the last two years; see
   Google's "Play Billing Library deprecation" schedule). When the Play
   Console warns about the billing library, bump `playBillingVersion`,
   check the API with `javap` against the downloaded AAR, rebuild, and run
   the device check below.
2. **A tip counts only when it is consumed.** Purchases are consumed right
   after payment so they can be repeated. `recoverPurchases()` consumes
   anything paid but never consumed (pending payments that went through, a
   crash in between) and reports the count; the web side counts exactly
   those numbers and nothing else. Do not count a `PENDING` purchase.
3. **With `enableAutoServiceReconnection()` the client is usually already
   connected** when the first plugin call arrives, so the explicit
   `startConnection` path in `connect()` rarely logs `connected: code …`.
   Both paths must stay; the explicit one covers a dropped service.
4. **Purchases only work for builds installed through Google Play** with
   the Play signing key, by an account listed under License testing (free
   test purchases) or a real buyer. A sideloaded debug or release APK can
   list products and consume, but `launchBillingFlow` fails. Product ids
   (`tip_small`, `tip_medium`, `tip_large`) must exist and be active in
   Play Console → Monetize → One-time products; until then the settings
   section, the header heart button and the thank-you popup (PLAN-012) are
   hidden because `getProducts` returns an empty list.
5. **Products are defined in the repository and pushed with a script.**
   `src/store/metadata/android/one-time-products.json` holds ids, German
   and English texts and euro prices; `node src/store/play-products.mjs
   --apply` creates, prices (via Google's converter) and activates them
   through the Play Developer API (ADR-008, `src/store/README.md`). The
   single purchase option must stay `legacyCompatible: true`, because the
   plugin reads `OneTimePurchaseOfferDetails`; a product whose only option
   is not backwards compatible is invisible to that flow. The service
   account needs "Manage store presence" on the app; a fresh grant can take
   up to 24 hours before the API stops answering 401/403. The account is
   used **keyless**: Google's Secure-by-Default policy
   `iam.disableServiceAccountKeyCreation` blocks key downloads in the
   owner's organisation, so tokens come from the owner's `gcloud` login
   (`roles/iam.serviceAccountTokenCreator`) or from GitHub's OIDC token via
   Workload Identity Federation (`roles/iam.workloadIdentityUser`, provider
   pinned to this repository). Do not ask for or create a key.

## When To Apply

- Before touching `TipJarPlugin.java`, `services/tip-jar.ts`,
  `support-section.tsx`, or `playBillingVersion`.
- When the Play Console reports a billing-library deadline.
- When a learner reports a tip that was charged but not thanked: the next
  settings visit runs `recoverPurchases()`; a consume failure is logged
  under logcat tag `TipJar`.

## Notes

- Device check without products (Chrome DevTools of the WebView):
  `Capacitor.Plugins.TipJar.getProducts({ ids: ["tip_small", "tip_medium", "tip_large"] })`
  → `{ available: true, products: [] }`; `recoverPurchases()` →
  `{ consumed: 0 }`; `purchase({ id: "tip_small" })` →
  `{ state: "unavailable", message: "Product not found: tip_small" }`.
  Logcat tag `TipJar` shows `products: code 0, 0 found, 3 unfetched`.
- The UI can be checked before products exist by intercepting
  `Capacitor.nativePromise` for `TipJar.getProducts` in DevTools; the
  session helper `device-cdp.mjs navwith` injects such a patch before the
  page scripts run.
- The tip counter lives under `localStorage` key `lid:support`; the learner
  record is never written by the tip jar. Exports and imports ignore the key.
- Release builds are minified; the plugin relies on the same keep rule as
  `AppSystemBarsPlugin` ([`capacitor-r8-annotations.md`](capacitor-r8-annotations.md)).
  Verify a minified build still answers `getProducts` after a library bump.
