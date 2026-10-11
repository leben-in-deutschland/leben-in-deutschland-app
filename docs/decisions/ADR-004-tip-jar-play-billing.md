---
id: ADR-004
title: Add a Tip Jar Through Google Play Billing With a Local Plugin
status: Accepted
date: 2026-10-10
areas: [android, web, product]
tags: [adr, monetization, billing, android]
---

# ADR-004: Add a Tip Jar Through Google Play Billing With a Local Plugin

## Context

The app is free on Google Play and on the web, has no ads, no account, and
no server ([`ADR-003`](ADR-003-local-first-notifications.md)). The owner
wants a simple paid option without taking anything away from current
learners. The privacy policy promises that no data is collected and that the
app talks to no third-party services beyond what the platform needs.

Google Play's payments policy requires Play's own billing system for
purchases made inside the app, including voluntary tips to the developer,
and forbids steering users to outside payment pages from inside the app.
Google also requires app updates to use a recent Play Billing Library
(each major version has a yearly deadline).

## Options Considered

### One-time "Pro" unlock

- Predictable revenue per buyer; common in study apps.
- Splits the product into free and paid parts, which is exactly the
  complexity the owner asked to remove ([`PLAN-005`](../plans/PLAN-005-simplify-onboarding-settings-practice.md)),
  and needs an entitlement that must be restored on new devices.

### Tip jar (consumable one-time products)

- Nothing is locked; the free app stays complete and the stored record is
  not involved at all.
- Three products whose names and prices are set in the Play Console, so the
  owner can change wording and prices without an app update.
- Revenue depends on goodwill; that is acceptable for the owner.

### How to talk to Play Billing

- **RevenueCat SDK:** easiest cross-platform API, but every purchase is sent
  to RevenueCat's servers, which contradicts the privacy policy.
- **Community Capacitor plugin (`@capgo/native-purchases` or
  `cordova-plugin-purchase`):** no native code to write, but a new npm
  dependency with its own release cadence that must keep up with Google's
  yearly library deadline; both bring far more API than three consumables
  need.
- **Local plugin in the Android project:** about 200 lines of Java next to
  the existing `AppSystemBarsPlugin.java`, using the Play Billing Library
  directly. The only dependency is Google's own library, the version is one
  line in `app/build.gradle`, and the code does exactly three things: list
  products, buy and consume one, and consume anything left over.

## Decision

Add a tip jar, Android only, implemented as a local Capacitor plugin
(`TipJarPlugin`, Play Billing Library 9.1.0) with a thin web bridge in
`src/web/services/tip-jar.ts`. Product ids are fixed in the app
(`tip_small`, `tip_medium`, `tip_large`); names and prices come from the
store at run time. Every purchase is consumed immediately so a learner can
tip again. The thank-you counter lives under its own `localStorage` key
(`lid:support`) and is never written into the learner record.

The section is hidden until the store returns products, so the website, iOS,
devices without Play, and builds not installed through Play show nothing.

## Consequences

### Positive

- Learners lose nothing; the free app stays whole.
- No new npm dependency and no third-party server; the only new network
  party is Google Play, which already handles installs, updates, and reviews.
- Backward compatibility is guaranteed by construction: the record schema,
  its migration, and the legacy-compat tests are untouched.

### Negative

- The owner must bump the billing library version roughly once a year when
  Google announces a deadline (one line, then rebuild).
- Real purchases can only be tested with a build installed from a Play
  testing track and a license-tester account; the repository can verify the
  bridge, the empty-store path, and the minified build, not a payment.
- The privacy policy needs a sentence about Google Play processing optional
  tips; the owner reviews the legal wording.

## Follow-Up

- [x] 2026-10-11: the owner asked for a nudge. Added a header heart button
      and a one-time, milestone-based popup on Home
      ([`PLAN-012`](../plans/PLAN-012-tip-thanks-card.md)). The popup counts
      its asks under a separate key `lid:support-ask`, in line with the
      "record untouched" rule above; the kill switch `flags.tipJar` covers
      the section, the button and the popup together.
- [ ] Owner: payments profile, three one-time products, license tester,
      internal-testing build (see [`PLAN-006`](../plans/PLAN-006-tip-jar.md)).
- [ ] Owner: decide whether the website should link to an outside tip page
      (allowed on the web, not inside the Android app).
