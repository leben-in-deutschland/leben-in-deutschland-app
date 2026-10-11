---
id: PLAN-004
title: UI and UX Revamp with Study Modes, Streak Options, and Notifications
status: Done
date: 2026-10-09
tags: [plan, ui, ux, notifications, streaks]
---

# Plan: UI and UX Revamp with Study Modes, Streak Options, and Notifications

## Goal

Give the app a modern, friendly look and make daily studying easier to keep up.
The owner asked to "modernize the UI, make it more UX friendly, add more
streak/study options and more notifications", with freedom to redesign
everything. The behavior is specified in
[`FEAT-001`](../features/001-ui-ux-revamp.md).

## Context

- Web app: `src/web/` (Next.js 16 static export, React 19, HeroUI 2.8,
  Tailwind 3). Android wraps the same export with Capacitor 7.
- All learner data lives in browser `localStorage` under the key `user`.
  Existing learners must keep every answer, mock exam, and setting.
- Android navigation must use real `.html` files (`utils/navigation.ts`)
  because the Android bundle strips the files that Next.js uses for
  client-side page changes.
- Pushing to `main` starts the Android release workflow, so this work stays
  on the local branch `feat/ui-ux-revamp` and is not committed or pushed
  unless the owner asks.
- No new npm packages are planned. Fonts come from `next/font/google`, which
  copies them into the build so the Android app works offline.

## Steps

- [x] Record the baseline (tests, lint, build) and create the local branch.
- [x] Foundation: theme tokens, fonts, user data defaults and migration,
      shared hooks, study-mode, streak, goal, readiness, spaced-review,
      achievement, inbox, and notification-planning logic with unit tests.
- [x] App shell: header, bottom tab bar, notification center, onboarding gate,
      Android notification tap handling.
- [x] Screens (parallel, one owner per area): home, practice hub and session,
      mock exam and results, progress page, settings and onboarding,
      landing page and footer, question catalogue, exam centers, privacy page.
- [x] Remove the old components that the new screens replace.
- [x] Review pass: correctness, Android navigation, translations (German and
      English), accessibility, design consistency; fix confirmed findings.
- [x] Visual check with headless screenshots at phone and desktop widths.
- [x] Modern pass (owner request): Inter and Plus Jakarta Sans typefaces,
      layered shadows, ambient glow, gradient buttons, floating translucent
      tab bar, press feedback on cards; see the ADR-002 amendment.
- [x] Android device test on the owner's phone (Samsung Galaxy S20 FE,
      Android 13) with a debug build installed over the released 2.0 app:
      upgrade of the real record, practice, mock exam, review, progress,
      settings, theme and language switch, test notification, export share
      sheet, fresh-install onboarding, hardware Back button.
- [x] Fix what the device test found: hardware Back abandoned a running mock
      exam (new `components/shell/use-back-button.ts`); a new learner's
      reminders were never scheduled right after onboarding (debounced sync
      in `use-app-effects.ts` lost its timer; regression test
      `__tests__/notification-sync.test.tsx`); mock timer description always
      described the "off" state; onboarding showed the header and tab bar.
- [x] Update `docs/context/`, `docs/architecture/`, and the usage log.

## Rollback Plan

- **Baseline:** Branch `main` at `c295bc7`, clean working tree.
  `npm test` passes 135 of 135 tests in 11 files. `npm run lint` reports 20
  existing errors (rules `react-hooks/set-state-in-effect` and
  `react-hooks/immutability`) in `app/dashboard/page.tsx`, `app/mock/page.tsx`,
  `app/page.tsx`, `app/prepare/page.tsx`, `components/footer.tsx`,
  `components/modals/in-app-review.tsx`, `components/navigation-bar.tsx`,
  `components/settings/state-dropdown.tsx`,
  `components/settings/user-setting.tsx`, `components/state-select.tsx`,
  `components/statistic/state-progress.tsx`, and
  `components/theme-switch.tsx`. `npm run build` passes and exports 74 pages.
- **Trigger:** Any of these after the change: a failing unit test; a failing
  production build; more lint errors than the baseline; a page that no longer
  exports statically; Android links that point to non-`.html` paths; or a
  stored learner record that loses answers, mock exams, or settings when the
  new code reads it.
- **Reversal:** All work is uncommitted on `feat/ui-ux-revamp`.
  1. Save the work without deleting it:
     `git stash push --include-untracked -m "ui-ux-revamp"`.
  2. Return to the baseline branch: `git switch main`.
  3. To undo a single file instead, restore it from the baseline commit:
     `git restore --source=c295bc7 -- <path>` and delete only files this plan
     created (listed by `git status --porcelain` on the branch).
- **State safety:** No dependency, lockfile, Android Gradle, signing, or
  deployment change is planned. Build output (`.next/`, `out/`) is ignored by
  Git. The data migration only adds optional fields with defaults and never
  removes existing fields, so the previous app version can still read records
  written by the new one. The new notification scheduler cancels the old daily
  reminder id `65241`; after a rollback the old app schedules it again the next
  time the dashboard opens.
- **Recovery verification:** `git status` shows the baseline tree;
  `cd src/web && npm test` passes 135 tests; `npm run lint` reports the same
  20 baseline errors; `npm run build` exports the baseline pages.

## Acceptance Criteria

- [x] Every learner-facing screen uses the new design system in light and dark
      mode and works at 360 px phone width and on desktop.
- [x] Learners can choose from at least eight study modes, including new
      modes for topics, quick rounds, marathon, and spaced review.
- [x] Streak options exist: daily goal, streak rule, rest days, streak
      freezes, best streak, and milestones.
- [x] Notifications exist in two forms: an in-app notification center on web
      and Android, and scheduled Android notifications that learners can turn
      on or off one by one.
- [x] Existing stored learner records load without losing data
      (`__tests__/legacy-compat.test.ts` includes a real 2.0 record from the
      owner's phone; the phone upgrade kept 53 answers, the mock exam, and
      every legacy key, and showed no onboarding).
- [x] German and English strings exist for every new text, checked by a test.
- [x] `npm test`, `npm run build` pass; lint has no more errors than baseline.
      Final: 33 test files, 871 tests, `eslint .` clean (baseline had 20
      errors), 77 exported pages.

## Verification

```bash
cd src/web && npm test
cd src/web && npm run lint
cd src/web && npm run build
```

Manual checks: headless browser screenshots of the main screens with a seeded
learner record, plus a device walkthrough on the owner's connected Android
phone with the debug build installed over the released app (the stored record
survives an `adb install -r`; the app is never uninstalled). Capacitor logs
every plugin call, so `adb logcat -d | grep "Capacitor/Plugin: To native"`
proves what the notification sync actually scheduled.

Known and accepted: once per cold start the WebView logs
`Cannot read properties of undefined (reading 'triggerEvent')` because the
native bridge fires `resume` before the page script exists. It also appears
with the released 2.0 app and has no visible effect.

Not done on purpose: no commit, no push (pushing `main` releases to Google
Play), no Android project change (`git status --short src/android` is clean),
and no version bump; the release workflow takes the version from
`src/web/package.json`, so the owner decides when 2.0.145 becomes 2.1.0.
