---
id: PLAN-012
title: Tip Jar Nudge - Header Button and One-Time Thank-You Popup
status: Done
date: 2026-10-11
tags: [web, android, billing, home]
---

# PLAN-012: Tip Jar Nudge - Header Button and One-Time Thank-You Popup

Spec: [`FEAT-002`](../features/002-tip-jar.md) (summary and the last two functional requirements).
Decision: [`ADR-004`](../decisions/ADR-004-tip-jar-play-billing.md).

## Context

The tip jar ([`PLAN-006`](PLAN-006-tip-jar.md)) lived only in Settings →
"Unterstützen"; nothing pointed at it. The owner asked for a nudge, first
leaving the form open, then deciding: **a popup**, plus **a button in the
header before the streak and the alerts**. An inline Home card was built and
device-checked first, then replaced by the popup on the owner's word.

Rules:

- Header: a heart icon link to `/settings#support`, shown under the same
  conditions as the settings section (Android app with the plugin, owner
  switch `flags.tipJar` on, Google Play returns at least one product).
- Popup trigger: the learner has passed a mock exam, or the current streak is
  seven days or more. The passed exam wins when both apply.
- Popup gates: the header conditions, no tip given yet, and the ask record
  allows it. It opens 3 s after Home and yields to any dialog already open
  (review, update, or design prompt) without counting an ask.
- Every way of closing the popup counts as "Nicht jetzt": 30 days of silence,
  and after the second time it never comes back. A tip at any time hides it
  for good.
- The learner record is not touched. The ask count lives under its own key
  `lid:support-ask`, like `lid:support` for tips (ADR-004).
- Classic design: no popup (the 2.0 screens stay as they were); the header
  belongs to the new design only.

## Steps

- [x] `utils/support-store.ts`: `AskRecord { asks, lastAskAt }`, `readAsk`,
      `recordAsk` under `lid:support-ask`; damaged data reads as "never asked".
- [x] `utils/support-nudge.ts`: pure `thanksReason(user, streakCurrent)` and
      `thanksAllowed(support, ask, now)`.
- [x] `components/support/use-tip-jar.ts`: `useTipJarAvailable(when)` shared
      by the header and the popup (the plugin keeps one billing connection,
      so the extra product query is cheap).
- [x] `components/support/thanks-dialog.tsx`: `ThanksDialog` (HeroUI modal
      like the review prompt; heart badge, title per reason, body,
      "Nicht jetzt", "Trinkgeld geben" → `/settings#support`).
- [x] `components/home/home-screen.tsx`: mount under the quick actions.
- [x] `components/shell/app-header.tsx`: `TipLink` before `StreakChip`;
      `components/shell/brand.tsx` gets `tight` so the title shrinks below
      420 px and yields below 384 px instead of wrapping.
- [x] Translations: `home_thanks_*` (home area) and `tip_button_aria`
      (common area), German and English.
- [x] Tests: `__tests__/support-nudge.test.ts`,
      `__tests__/support-thanks-dialog.test.tsx`,
      `__tests__/app-header-tip.test.tsx`; translation parity covers the keys.
- [x] Full checks: `npx vitest run` (61 files, 1276 tests), `npm run lint`,
      `npx tsc --noEmit`, `npm run build`, `npm run build:android`,
      `assembleDebug` (JDK 21).
- [x] Device check on the owner's phone (below).

## Acceptance Criteria

- No button and no popup on the web, on the classic design, when the switch
  is off, when Play has no products; no popup after a tip.
- Popup shown at most twice in a learner's life, 30 days apart, only after a
  passed mock exam or a 7-day streak, never on top of another dialog.
- Header stays on one line on a 384 px wide phone with the button present.
- Record export/import unchanged (new key is outside the record).

## Rollback

- **Baseline:** uncommitted working tree on `feat/ui-ux-revamp`, HEAD
  `c295bc7`; 1248 tests passing.
- **Trigger:** any failing check above, a card on the web/classic, or a card
  shown without a milestone.
- **Reversal:** delete `utils/support-nudge.ts`, `components/support/`, and
  the three tests; revert the `support-store.ts`, `home-screen.tsx`,
  `app-header.tsx`, `brand.tsx`, `home.*.json` and `common.*.json` edits;
  remove the PLAN-012 passages from FEAT-002 and ADR-004.
- **State safety:** no dependency, schema, build, or deployment change; the
  only new storage key is ignored by older builds.
- **Recovery verification:** `npx vitest run` back at the baseline count,
  `npm run lint`, `npx tsc --noEmit`.

## Evidence

2026-10-11, Samsung SM-G781B (Android 13), debug build installed over the
owner's data, Play answer stubbed through `device-cdp.mjs navwith`
(`Capacitor.nativePromise` for `TipJar.getProducts`), the owner's record
backed up and the one mock exam temporarily set to `passed: true`:

- Unstubbed build: no popup, no heart (Play has no products yet).
- Stubbed Home: popup open 3 s after load with "Glückwunsch zur bestandenen
  Probeprüfung!", buttons "Nicht jetzt" / "Trinkgeld geben"; header order
  heart → streak → bell → settings; title on one line at 15 px (`screencap`,
  session `files/device/thanks-dialog-final.png`, `header-crop.png`).
- "Nicht jetzt": dialog closed, `lid:support-ask` = `{asks: 1, …}`; next
  stubbed load: no popup, heart still there.
- "Trinkgeld geben": landed on `settings.html#support`, ask recorded.
- Restore: record byte-identical to the backup (`passed: false` again),
  `lid:support-ask` removed, the original six keys only, no popup and no heart.
- Learned: `Page.captureScreenshot` painted the light-variant button text
  dark and tiny while the real screen (`adb exec-out screencap`) was fine;
  judge text rendering from `screencap` (see
  [`android-device-testing`](../memory/android-device-testing.md)).
