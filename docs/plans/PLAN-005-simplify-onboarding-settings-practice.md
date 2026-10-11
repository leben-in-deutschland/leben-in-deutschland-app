---
id: PLAN-005
title: Simplify Onboarding, Settings, and the Practice Hub
status: Done
date: 2026-10-10
tags: [plan, ui, ux, simplification]
---

# Plan: Simplify Onboarding, Settings, and the Practice Hub

## Goal

After the revamp ([`PLAN-004`](PLAN-004-ui-ux-revamp.md)) the owner asked
whether the app had become more complex. It had, mostly for the learner:
a six-step onboarding, a settings page with every knob visible, and ten study
modes shown at once. This plan hides the knobs without removing any feature
or changing the stored record.

## Context

- Onboarding: `src/web/components/onboarding/`. Steps today: welcome and
  language, state, goal, exam date, reminders (Android only), summary.
- Settings: `src/web/components/preferences/` (one section per topic).
- Practice hub: `src/web/components/practice/practice-hub.tsx` and
  `utils/study-modes.ts`.
- No stored field is removed or renamed. `completeOnboarding` keeps its
  shape; `examDate` is simply `null` after onboarding and is set in settings.
- No new npm packages. HeroUI `Accordion` and `useDisclosure` already exist
  in the project for fold-outs.

## Steps

- [x] Onboarding 6 → 3 steps: state (with a small inline language toggle,
      default from the device language), goal, reminders (Android only, so
      the web shows 2). The last step finishes directly; no summary step.
      Exam date moves to settings; the home exam card already links there
      while no date is set. `completeOnboarding` keeps an existing record's
      `examDate`. `hasLanguageChoice()` in `utils/user-store.ts` keeps the
      language key in one place.
- [x] Settings: one "Reminders" master switch with a "Fine-tune" fold-out
      (summary "n of 6 on") for the individual types and times; streak rule,
      rest days, and freezes behind a "Streak rules" fold-out with a one-line
      summary. The daily goal chips already live in the practice section and
      stay visible. Shared primitive: `components/ui/fold-out.tsx`.
- [x] Practice hub: four primary modes (recommended or learn new, review due,
      mistakes, quick round) always visible; the rest behind "n more modes"
      (`splitStudyModes` in `utils/study-modes.ts`). Deep links
      `/prepare?action=...` keep working for every mode.
- [x] Update tests, German and English strings, FEAT-001, and the usage log.
- [x] Verify on the connected phone: fresh onboarding, settings fold-outs,
      practice hub; then restore the owner's record. (See Verification
      Evidence below.)

## Rollback Plan

- **Baseline:** the uncommitted revamp on `feat/ui-ux-revamp` as of
  2026-10-10 05:40 CEST: 33 test files, 871 tests, lint clean. Because
  nothing is committed, a file copy of `src/web/components`, `app`,
  `__tests__`, `data/translations`, and `utils` was taken into the session
  workspace (`files/pre-trim-snapshot/`) before the first change.
- **Trigger:** a failing test, lint, or type check that cannot be fixed in
  the same step; a mode or setting that is no longer reachable; a stored
  record that changes shape; onboarding that cannot be finished on the phone.
- **Reversal:** copy the touched files back from the snapshot (whole
  directories or single files), delete files created by this plan, and
  re-run the checks. No dependency, Android, or deployment change exists to
  undo.
- **State safety:** stored records are untouched; the owner's phone record
  is saved in the session workspace before any fresh-install test and
  restored afterwards.
- **Recovery verification:** `cd src/web && npm test` reports 871 tests,
  `npm run lint` and `npx tsc --noEmit` are clean.

## Acceptance Criteria

- [x] Onboarding has at most 3 steps on Android and 2 on the web.
- [x] Every notification type, streak option, and study mode is still
      reachable and still stored the same way.
- [x] `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` pass
      (33 files, 900 tests; lint and types clean; 77 pages).
- [x] Verified on the connected Android phone (see below).

## Verification Evidence (device, 2026-10-10)

Debug build installed over the previous build on the owner's Galaxy S20 FE
(`adb install -r`, record preserved), owner's record saved to the session
workspace, storage cleared for a fresh install:

- Onboarding opened in English because the phone is set to `en-GB`
  (`navigator.languages` = en-GB, de-DE, en-US); the inline toggle switched
  to German instantly; "Schritt 1 von 3"; no header or tab bar; hardware
  Back stepped 3 → 2; finish from step 3 wrote a schema-2 record (HH, goal
  10, reminders on, `examDate: null`) and the plugin log showed
  `checkPermissions, createChannel x4, getPending, schedule` at once.
- Practice hub: four cards (Neue Fragen lernen · EMPFOHLEN, Wiederholen,
  Fehler üben, Schnelle Runde) and a "6 weitere Modi" row; opening it showed
  the six other cards with their counts.
- Settings: both fold-outs closed by default ("Jedes Üben · keine Ruhetage",
  "6 von 6 aktiv"); the streak fold-out opened with rule chips, rest days,
  and freezes intact; the reminders fold-out opened and exposed the six type
  switches (7 → 13 switches on the page).
- The phone left the USB bus mid-test and came back after about 80 s. The
  final build (with the "Serienregeln" title; 33 files, 900 tests, lint and
  types clean) was installed with `adb install -r`. Settings showed
  "Serienregeln · Jedes Üben · keine Ruhetage" and "Feinabstimmung · 6 von
  6 aktiv". Opening "Feinabstimmung" and switching off "Tägliche
  Erinnerung" wrote `preferences.reminders.daily: false`, changed the
  summary to "5 von 6 aktiv", and the plugin log showed `cancel, schedule`
  (reminders re-synced).
- Owner's record restored from the session workspace
  (`restore-owner-record.sh`): BE, de, schema 2, 54 answers, 1 mock,
  `onboardingCompleted: true`; the dashboard showed Berlin, streak 2,
  13/310 known, and the plugin re-synced the reminders (`cancel, schedule`).
  `svc power stayon false` and `adb forward --remove-all` were run; tracked
  files under `src/android/` are unchanged.

## Verification

```bash
cd src/web && npm test
cd src/web && npm run lint
cd src/web && npx tsc --noEmit
cd src/web && npm run build
```
