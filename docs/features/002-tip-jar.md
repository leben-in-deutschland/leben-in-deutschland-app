---
id: FEAT-002
title: Tip Jar Through Google Play Billing
status: In Progress
date: 2026-10-10
priority: Medium
areas: [android, web, settings, billing]
tags: [feature, android, billing, monetization]
---

# Feature: Tip Jar Through Google Play Billing

## Summary

Android learners can send the developer a small, medium, or large thank-you
from the settings page. Tips are one-time, repeatable purchases processed by
Google Play. Nothing is locked behind them: the app stays free and the same
for everyone, the website shows nothing, and the learner's stored record is
not touched. Decision: [`ADR-004`](../decisions/ADR-004-tip-jar-play-billing.md).
Plan: [`PLAN-006`](../plans/PLAN-006-tip-jar.md).

Two quiet ways point at the tip jar in the new design
([`PLAN-012`](../plans/PLAN-012-tip-thanks-card.md)): a heart button in the
learner header, placed before the streak chip and the bell, and a one-time
thank-you popup on Home after a real success moment. Both exist only where
the settings section exists (Android, owner switch on, products known).

## User Story

As a learner who likes the free app, I want a quick way to say thanks with a
few euros so that the developer can keep it free and ad-free.

## Requirements

### Functional

- [x] Settings → "Unterstützen" / "Support the app" shows up to three tiles,
      each with the product name and price exactly as the store reports them,
      in the order small, medium, large.
- [x] Tapping a tile opens Google Play's purchase sheet. A completed purchase
      is consumed at once (so it can be repeated), thanked with a toast, and
      counted in a "You have tipped N times" line.
- [x] Closing the sheet does nothing. A pending payment (for example cash at
      a kiosk) is explained and counted later; a failed one is explained.
- [x] Paid-but-never-counted tips (pending payments that went through, a
      crash between payment and confirmation) are consumed and counted when
      the settings page opens.
- [x] The section does not exist on the website, on Android builds without
      the plugin, when Google Play is unavailable, or while the store returns
      no products (so the owner can ship the code before creating products).
- [x] The privacy policy names Google Play's billing system for optional tips.
- [x] Header heart button (`tip_button_aria`) opens `/settings#support`; it
      follows the same visibility rules as the section. With the button
      present, the header title shrinks below 420 px and yields below 384 px
      so the row stays on one line.
- [x] Thank-you popup on Home (modern design only), 3 s after the screen
      opens, when the learner has passed a mock exam (title
      `home_thanks_title_mock`) or has a streak of 7+ days
      (`home_thanks_title_streak`); the passed exam wins. Buttons: "Trinkgeld
      geben" → `/settings#support`, "Nicht jetzt". Every way of closing it
      (either button, backdrop, Back) counts as one ask under
      `lid:support-ask`; the popup waits 30 days after an ask, never returns
      after the second ask or after any tip, and yields to a dialog that is
      already open (review, update, design prompts) without counting an ask.

### Non-Functional

- [x] The learner record (`localStorage` key `user`) is byte-identical before
      and after tips; the counter lives under `lid:support`.
- [x] No new npm dependency. One Android dependency
      (`com.android.billingclient:billing`, pinned in `variables.gradle`).
- [x] Native failures never throw into the UI; they become quiet outcomes.
- [x] Release builds are minified: the plugin is written like the existing
      `AppSystemBarsPlugin` and covered by the Capacitor annotation keep rule.

## Scope

### Area

- [x] `src/android` - `TipJarPlugin.java`, `MainActivity.java`,
      `app/build.gradle`, `variables.gradle`.
- [x] `src/web` - `services/tip-jar.ts`, `utils/support-store.ts`,
      `components/preferences/support-section.tsx`, `settings-screen.tsx`,
      `HeartIcon`, settings translations, privacy policy.

## Interface Changes

- New settings section with id `support` (hash target `/settings#support`),
  Android only, placed between notifications and "About".
- Capacitor plugin `TipJar`: `getProducts({ ids })`, `purchase({ id })`,
  `recoverPurchases()`.
- Privacy policy section 4 gains a paragraph; "Last updated" moves to
  2026-10-10.

## Data Changes

- New `localStorage` key `lid:support` → `{ "tips": number, "lastTipAt":
  string | null }`. Missing or damaged values read as zero tips. Old app
  versions, exports, and imports ignore the key.
- No change to the learner record or its schema version.

## Decisions

- [`ADR-004`](../decisions/ADR-004-tip-jar-play-billing.md): Play Billing in
  a local Capacitor plugin instead of a community plugin or external links.

## Edge Cases

- Products not created yet, or Play unavailable → section, header button and
  popup hidden.
- Popup and another prompt due at the same time → the other prompt wins; the
  popup tries again on a later Home visit.
- Popup dismissed by backdrop or hardware Back → counts as "Nicht jetzt".
- Purchase sheet closed → no toast, no count.
- `ITEM_ALREADY_OWNED` (an earlier tip was never consumed) → consume it and
  report "purchased".
- Pending payment → "pending" toast; counted by the next recovery.
- Consume fails after payment → "pending"; the next recovery finishes it.
- Second tap while a sheet is open → the other tiles are disabled; the native
  side also refuses a second flow.

## Rollback Strategy

See the rollback plan in [`PLAN-006`](../plans/PLAN-006-tip-jar.md).

## Acceptance Criteria

- [x] `cd src/web && npm test`, `npm run lint`, `npx tsc --noEmit`, and
      `npm run build` pass.
- [x] Gradle debug build installs over the existing app with the record
      intact; the plugin reaches Google Play from the device.
- [x] Minified release build passes and the plugin still answers (R8 check).
- [ ] Owner has created the three products and a test purchase succeeds from
      an internal testing track (cannot be verified from the repository).
- [x] Header button and popup verified on the owner's phone with the Play
      answer stubbed (2026-10-11, see
      [`PLAN-012`](../plans/PLAN-012-tip-thanks-card.md) evidence); both stay
      hidden on the unstubbed build until the products exist.

## Verification Plan

```bash
cd src/web && npm test
cd src/web && npm run lint
cd src/web && npx tsc --noEmit
cd src/web && npm run build:android
cd src/android && ./gradlew assembleDebug
cd src/android && ./gradlew assembleRelease
```

On the device, through the Chrome DevTools bridge of the WebView:
`Capacitor.Plugins.TipJar.getProducts({ ids: ["tip_small", "tip_medium", "tip_large"] })`
resolves `{ available: true, products: [] }` until the products exist, and
`recoverPurchases()` resolves `{ consumed: 0 }`; logcat tag `TipJar` shows
`connected: code 0`.
