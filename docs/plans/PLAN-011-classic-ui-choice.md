---
id: PLAN-011
title: Classic Design Opt-In for Upgraded Learners
status: Done
date: 2026-10-11
tags: [web, android, ui, migration]
---

# PLAN-011: Classic Design Opt-In for Upgraded Learners

Spec: [`FEAT-008`](../features/008-classic-ui-choice.md).
Decision: [`ADR-007`](../decisions/ADR-007-classic-ui-opt-in.md).

## Context

Version 2.1 replaced every learner screen of 2.0 with the new design
([`PLAN-004`](PLAN-004-ui-ux-revamp.md)). The owner asked that learners who
already use the app are **asked** before they are moved: they should be able
to stay on the design they know, switch later from Settings, and switch back.
New learners go straight to the new design.

Facts from the repository that shape the plan:

- The 2.0 screens exist only in Git (`c295bc7`); the working tree deleted
  them (`components/*.tsx`, `utils/*-logic.ts`, `icons/`, `services/user.ts`).
  Dependencies are identical, and all 100 translation keys the old screens use
  still exist in the merged translations. 43 icon components must come back.
- The 2.0 data layer rebuilt the whole record on a state change (wiping
  progress) and scheduled the 08:00 reminder (id 65241) from the dashboard.
  The restored screens must write through `utils/user-store.ts` and leave
  reminders, update and review prompts to the shell.
- The record schema stays at version 2; the design choice is stored under its
  own key `lid:ui-mode` so nothing the classic code does to the record can
  lose it.

## Steps

- [x] `utils/ui-mode.ts`: `resolveUiMode(stored, user)`, `readUiMode`,
      `setUiMode`, `clearUiMode`, `useUiMode` (undefined before hydration).
- [x] `src/web/classic/`: the 2.0 learner screens restored from `c295bc7`
      (components, logic utils, icons, types) with imports moved under
      `@/classic/`, a `ClassicApp` that renders the 2.0 navigation bar,
      dashboard, prepare, and mock screens for the learner routes, data
      adapters over `user-store`, no reminder scheduling, no update or review
      prompt, progress-preserving state change, and a "new design" button in
      the classic settings dialog.
- [x] Shell: `AppShell` renders `ClassicApp` for learner routes in classic
      mode, a neutral loading state until the mode is known, and the one-time
      prompt (`components/shell/ui-mode-prompt.tsx`) for upgraded learners.
- [x] Onboarding stores "modern" when it finishes; deleting the record clears
      the choice.
- [x] Settings (modern): a design section with "Use the classic design".
- [x] Translations (`common.{de,en}.json`): prompt, buttons, section.
- [x] Engagement toasts (goal, streak, achievements) stay silent while the
      classic design is active; the inbox items are still stored.
- [x] Tests: resolver rules, hook, shell switching, prompt choices, settings
      buttons, onboarding write, restored 2.0 logic tests under
      `__tests__/classic/`, a real 2.0 record rendering the classic dashboard.
- [x] Verification on the owner's phone (`<device-serial>`) with the current
      upgraded record (storage backed up first); the true 2.0 record was
      verified in the headless run (see Evidence).
- [x] Docs: ADR-007, FEAT-008, architecture overview, index rows, usage log.
- [x] `tailwind.config.ts`: `./classic/**` added to the content globs so the
      classes used only by classic files survive the production build.

## Acceptance Criteria

- A learner whose record exists, has a state, and finished onboarding (a
  2.0 record counts as finished) but who never chose a design sees the
  classic design plus one prompt; "Try the new design" opens the modern
  Home, "Keep the classic design" keeps the classic Home (Android Back
  counts as keep); the prompt never returns after either choice.
- A learner without a record sees the modern onboarding and the modern design
  afterwards; no prompt.
- Both designs offer a button in their settings that switches to the other
  design without losing any data; switching lands on Home.
- In classic mode the shared shell still plans reminders, shows update and
  review prompts, and routes notification taps; classic writes keep every 2.1
  field of the record (`schemaVersion`, `preferences`, `streak`, ...).
- Changing the state in classic mode keeps progress.
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` pass;
  `make build-sync` succeeds; device check passes.

## Verification

```bash
cd src/web && npm test
cd src/web && npm run lint && npx tsc --noEmit
cd src/web && npm run build
cd src && make build-sync
cd src/android && ./gradlew assembleDebug
adb -s <device-serial> install -r app/build/outputs/apk/debug/app-debug.apk
```

## Rollback

- **Baseline:** uncommitted branch `feat/ui-ux-revamp` at `c295bc7` with the
  prior tasks' changes (through PLAN-010); the phone record and all storage
  keys are backed up to the session folder before any device run.
- **Trigger:** failing tests/lint/build, a classic screen that crashes or
  writes a record the modern screens cannot read, the prompt returning after
  a choice, or the owner rejecting the flow.
- **Reversal:** the branch is uncommitted, so revert by hand: delete
  `src/web/classic/`, `utils/ui-mode.ts`, `components/shell/ui-mode-prompt.tsx`,
  the design section in Settings, `__tests__/classic/` and the new tests;
  restore `components/shell/app-shell.tsx`, `onboarding-flow.tsx`,
  `settings-screen.tsx`, and the translation files from the copies the agents
  keep in the session folder (`files/pre-classic/`); re-run `make build-sync`.
- **State safety:** no schema or dependency change; the only new storage key
  is `lid:ui-mode`, which older builds ignore; the phone record is restored
  from the backup and compared byte for byte.
- **Recovery verification:** `npm test` and `npm run build` pass; the modern
  design renders for every record; pending notifications on the phone equal
  the pre-change plan.

## Evidence

2026-10-11, uncommitted working tree:

- `npx vitest run`: 58 files, 1248 tests pass (1099 before this work; new:
  `__tests__/classic/**` 119, `ui-mode` 15, `app-shell-ui-mode` 10,
  `ui-mode-section` 2, `app-effects-classic-toasts` 3, onboarding
  assertions).
- `npm run lint` exit 0, `npx tsc --noEmit` exit 0, `npm run build` exit 0
  (77 static pages), `npm run build:android` exit 0 (export + Capacitor
  sync), `./gradlew assembleDebug` exit 0 (JDK 21).
- Bundle: `out/_next/static` 3.6 MB; debug APK 18,028,840 bytes
  (18.03 MB; the previous build before the classic screens was ~18 MB, so
  the growth is below 0.1 MB because the question data and images dominate).
- Headless check of the static export (Edge, CDP, 412×915 mobile viewport,
  the real 2.0 device record from
  `__tests__/fixtures/legacy-user-2.0-device.json`): 21/21 steps pass with
  zero console errors or exceptions. Covered: classic + prompt for the 2.0
  record; "Keep the classic design" closes the prompt and stores `classic`;
  reload shows classic without the prompt; `/prepare`, `/mock`, `/progress`,
  `/practice` render the classic screens; the record stays schema 2 with all
  53 answers, state BE, `preferences`, `streak`, `onboardingCompleted`;
  `/settings` opens the classic settings dialog and "Zum neuen Design
  wechseln" lands on the modern Home with `modern` stored; the modern
  Settings "Zum klassischen Design wechseln" lands on the classic Home with
  `classic` stored; a missing choice shows the prompt again and "Neues
  Design ausprobieren" stores `modern`; no record shows the modern
  onboarding without a prompt. Screenshots in the session folder
  (`files/smoke/`).
- A toast "4 Erfolge freigeschaltet … Fortschrittsseite" appeared over the
  classic dashboard during the first headless run; fixed by gating the
  engagement toasts on the active design (`use-app-effects.ts`), re-verified.
- Device (owner's Samsung S20 FE, `<device-serial>`, 2026-10-11 08:41): all
  storage keys backed up (`files/device/all-keys-before-classic.json`:
  schema 2, 54 answers, 1 mock, state BE, reminder 07:05 set by the owner);
  `adb install -r` of the 07:49 debug APK; explicit cold start
  (`am start -n …/.MainActivity`) shows the classic dashboard with the prompt
  and no stored choice; "Beim klassischen Design bleiben" closes it and
  stores `classic`; `/prepare.html` and `/mock.html` render the classic
  screens; `/settings.html` opens the classic settings dialog whose "Zum
  neuen Design wechseln" lands on the modern Home with `modern` stored; the
  modern Settings "Design" section's "Zum klassischen Design wechseln" lands
  on the classic Home with `classic` stored; hardware Back on the prompt
  stores `classic`, closes it, and the app stays in the foreground; 8
  reminders remain planned in classic mode (daily cards at 07:05, weekly
  review 18:00); `/prepare.html?action=practice&start=25` renders the
  classic prepare screen; the record afterwards is still schema 2 with 54
  answers, 1 mock, BE, 07:05, goal 10, 5 inbox items. Left for the owner:
  `lid:ui-mode` removed again so the prompt shows on the next open; all
  other keys untouched. Screenshots in `files/device/`.
- Caution: `adb shell monkey … 1` injects one random input event; on the
  first launch it pressed the prompt's keep button. Launch with
  `am start -n` when a dialog may be open.

