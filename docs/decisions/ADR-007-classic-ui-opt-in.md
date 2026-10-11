---
id: ADR-007
title: Keep the 2.0 Learner Screens as an Opt-In Classic Design
status: Accepted
date: 2026-10-11
areas: [web, android, ui, product]
tags: [adr, ui, migration, storage]
---

# ADR-007: Keep the 2.0 Learner Screens as an Opt-In Classic Design

## Context

Version 2.1 (the uncommitted branch `feat/ui-ux-revamp`; `c295bc7` is the
released 2.0 code) replaced every learner screen of 2.0 with the modern
design ([`ADR-002`](ADR-002-passport-design-system.md),
[`FEAT-001`](../features/001-ui-ux-revamp.md),
[`PLAN-004`](../plans/PLAN-004-ui-ux-revamp.md)). The record migration was
built to be backward compatible - optional fields with defaults, schema
version 2, a real 2.0 record upgraded in place on the owner's phone - but the
screens had no fallback: after the update every existing learner would open
the new design without being asked.

On 2026-10-11 the owner asked: "for old existing user, it should ask for
switch to new UI and user can choose to be in old... and there should be a
button in the settings. new users will go directly to new".

Facts found while scoping:

- There is no server and no account. The app is a Next.js static export
  inside a Capacitor 7 wrapper, and all learner data lives in `localStorage`
  under the record key `user`. A design choice therefore has to live on the
  device as well.
- The 2.0 learner screens exist only in Git at `c295bc7`; the working tree
  deleted them (`components/*.tsx`, `utils/*-logic.ts`, `icons/`,
  `services/user.ts`). The dependencies are identical (HeroUI and friends),
  all 100 translation keys the 2.0 screens use still exist in the merged
  translations, and 43 icon components would have to come back.
- The 2.0 data layer rebuilt the whole record on a state change (wiping
  progress), scheduled the 08:00 reminder (id 65241) from the dashboard, and
  showed its own update and review prompts. Run unchanged next to the 2.1
  shell, it would double the reminders and could drop 2.1 fields.
- `utils/user-store.ts` normalizes every read (`readUser`), so a restored
  screen that reads and writes through it keeps every 2.1 field
  (`schemaVersion`, `preferences`, `streak`, ...) without knowing them.
- A 2.0 record has no `onboardingCompleted` field; normalization derives it
  from the presence of a federal state (`utils/user-defaults.ts`). An
  upgraded learner is therefore detectable: a finished record and no stored
  design choice.
- Notification cards and their deep links (`/prepare?action=…&start=…`,
  [`FEAT-007`](../features/007-rich-notifications.md)) and the Android
  `.html` navigation (`utils/navigation.ts`) are bound to the existing
  routes.

## Options Considered

### Option 1: Ship only the new design

Pros: nothing to maintain twice; the smallest bundle.
Cons: the owner explicitly wants existing learners to be asked and to be able
to stay. Rejected.

### Option 2: A separate classic app or a route prefix

A second APK, or the 2.0 screens under `/classic/*` next to the modern
routes. Pros: the two designs never share a page. Cons: notification deep
links and bookmarks point at the existing routes and would open the wrong
design; the Android bundle would carry two sets of entry points. Rejected.

### Option 3: The 2.0 screens on the same routes, chosen per learner (chosen)

Keep the 2.0 learner screens as a **classic design** under `src/web/classic/`
and let the shared shell render them for the learner routes when the
learner's choice says so. Pros: one app, one set of routes, one data layer,
one notification plan; the choice is a single value on the device. Cons: two
designs to maintain for a while; the restored code needs small adaptations
to live next to the 2.1 shell.

### Option 4: Store the choice inside the learner record

Pros: one storage key, carried along by export and import. Cons: the 2.0
code paths can rebuild the record, so the choice could be lost exactly in the
design that depends on it. Rejected in favour of a separate key.

### Option 5: A switch in the remote content channel

A flag in `notices.json` ([`ADR-006`](ADR-006-remote-content.md)). Pros: the
owner could move everyone at once without a release. Cons: it is a global
switch, and the owner asked for a per-learner choice. Not chosen now, but a
reasonable lever to retire the classic design later (see Follow-Up).

## Decision

Option 3. Concretely:

- `utils/ui-mode.ts` - `resolveUiMode(stored, user)`, `readUiMode`,
  `setUiMode`, `clearUiMode`, and `useUiMode` (`undefined` before
  hydration). The choice is stored under its own key **`lid:ui-mode`** with
  the values `"classic"` or `"modern"`, apart from the record, so nothing the
  classic code does to the record can lose it. The record schema stays at
  version 2.
- Resolution: a stored choice wins. No record, a record without a federal
  state, or `onboardingCompleted` false resolves to modern, so new learners
  go straight to the modern onboarding, which stores `"modern"` when it
  finishes. A finished record without a choice belongs to a learner who
  upgraded from 2.0 and resolves to classic plus a one-time prompt. Deleting
  the record clears the choice.
- `src/web/classic/` holds the 2.0 components, logic utils, icons, types, and
  user service restored from `c295bc7` with imports moved under `@/classic/`.
  `ClassicApp({ pathname })` renders the 2.0 navigation bar, dashboard,
  prepare, and mock screens for the learner routes: `/dashboard`,
  `/practice` and `/prepare` (classic prepare), `/mock`, `/progress`
  (classic dashboard), and `/settings` (classic dashboard with its settings
  dialog). Public pages (`/`, `/question-catalogue`, `/pruefstellen`,
  `/privacy-policy`) stay modern in both modes. The modern design itself
  does not change.
- The shared shell (`components/shell/app-shell.tsx`) picks the design,
  shows a neutral loading state until the mode is known, and owns the prompt
  (`components/shell/ui-mode-prompt.tsx`): a non-dismissable dialog "A new
  design is available" with "Try the new design" (stores `"modern"`, opens
  the modern Home) and "Keep the classic design" (stores `"classic"`); the
  Android Back button counts as keep.
- Both designs offer a Settings button to switch: a new "Design" section in
  the modern Settings and a row in the 2.0 settings dialog. Switching writes
  only `lid:ui-mode`, loses nothing, and lands on Home.
- Adaptations of the restored code: all reads and writes go through
  `utils/user-store.ts`; the 2.0 dashboard no longer schedules the 08:00
  reminder (id 65241) and shows no update or review prompt of its own - the
  shell plans reminders (`utils/notification-planner.ts`) and shows those
  prompts in both modes; a state change keeps progress (`changeUserState`)
  instead of wiping it; "start over" resets the same way as in the modern
  design. Everything else keeps the 2.0 look and behaviour.

## Consequences

- Two user interfaces exist for a while. The classic design is frozen at 2.0
  behaviour plus the adaptations above; new features land in the modern
  design only.
- In classic mode the shell still plans reminders, shows update and review
  prompts, and routes notification taps, so an upgraded learner gets the 2.1
  notifications (FEAT-001, FEAT-007) on the 2.0 screens. A question card's
  deep link (`/prepare?action=…&start=…`) opens the classic prepare screen,
  which ignores the `start` question - a known limitation.
- Classic writes keep every 2.1 field, so a learner can switch back and
  forth without losing streaks, preferences, review schedule, or inbox.
- The Android bundle grows by the classic screens and icons. The size impact
  is unknown until the bundle is built (open question, see Follow-Up).
- Website users with an old record see the same prompt once; the website
  has no separate rule.
- Nothing changes for new learners, for the public pages, or for the record
  schema; older builds ignore `lid:ui-mode`.

## Follow-Up

- [ ] Owner switch to retire the classic design later, for example a flag in
      `notices.json` over the ADR-006 channel that resolves every learner to
      modern (open; needs an owner decision).
- [ ] Make the classic prepare screen honour the `start` question of
      notification deep links, or plan question cards without `start` in
      classic mode (open).
- [x] Measure the Android bundle growth after `make build-sync` and record
      it in [`PLAN-011`](../plans/PLAN-011-classic-ui-choice.md): debug APK
      18.03 MB, static assets 3.6 MB; growth below 0.1 MB.
- [ ] Remove the classic design in a future major version once adoption of
      the modern design is high. The app collects no analytics, so adoption
      cannot be read from the repository; the trigger is an owner decision
      (open).
- Implementation: [`PLAN-011`](../plans/PLAN-011-classic-ui-choice.md),
  [`FEAT-008`](../features/008-classic-ui-choice.md).
