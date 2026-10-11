---
id: FEAT-008
title: Classic Design Opt-In for Upgraded Learners
status: Done
date: 2026-10-11
tags: [feature, web, android, ui, migration]
---

# FEAT-008: Classic Design Opt-In for Upgraded Learners

Decision: [`ADR-007`](../decisions/ADR-007-classic-ui-opt-in.md).
Plan: [`PLAN-011`](../plans/PLAN-011-classic-ui-choice.md).

## Problem

Version 2.1 gives every learner screen a new design
([`FEAT-001`](001-ui-ux-revamp.md)). A learner who has used the app since
2.0 would open the update and find nothing where it used to be. The owner
asked that existing learners are asked first, can stay on the design they
know, and can switch in Settings at any time, in both directions. New
learners should see only the new design.

## Behaviour

- **Two designs, one app.** The "modern" design is the 2.1 interface. The
  "classic" design is the 2.0 learner interface, kept under
  `src/web/classic/` and rendered by the shared shell
  (`components/shell/app-shell.tsx`) through `ClassicApp({ pathname })` for
  the learner routes. Both designs read and write the same record through
  `utils/user-store.ts`, so nothing is converted when switching.
- **Which design opens.** The choice is stored under `lid:ui-mode`
  (`"classic"` or `"modern"`), apart from the record. `resolveUiMode` in
  `utils/ui-mode.ts` applies this table:

  | Record | Stored choice | Design | Prompt |
  | --- | --- | --- | --- |
  | none | none | modern (onboarding) | no |
  | no federal state, or onboarding not finished | none | modern (onboarding) | no |
  | finished (state set, onboarding done) | none | classic | once |
  | any | `modern` | modern | no |
  | any | `classic` | classic | no |

  A finished record without a choice is a learner who upgraded from 2.0: a
  2.0 record has no `onboardingCompleted` field, and normalization sets it
  from the federal state. Onboarding stores `"modern"` when it finishes, so
  a new learner never sees the prompt. Deleting the record clears the
  choice, so the next learner on the device starts modern. Until the mode
  is known after hydration the shell shows a neutral loading state instead
  of flashing one design.
- **The prompt.** An upgraded learner sees the classic design and, over it,
  one dialog titled "A new design is available" that cannot be dismissed
  (`components/shell/ui-mode-prompt.tsx`). "Try the new design" stores
  `"modern"` and opens the modern Home; "Keep the classic design" stores
  `"classic"` and keeps the classic Home. The Android Back button counts as
  keep. After either answer the prompt never returns.
- **Switching in Settings.** The modern Settings page gets a "Design"
  section showing the current design and "Switch to the classic design";
  the 2.0 settings dialog gets a "Design" row with "Switch to the new
  design". Either button writes only
  `lid:ui-mode`, loses nothing, and lands on Home in the other design.
- **What the shell still does in classic mode.** The shared shell keeps
  everything that is not a screen: it reads and normalizes the record, runs
  its effects (`components/shell/use-app-effects.ts`: `lastOpenedAt`,
  `runEngagement` for the in-app inbox, Android reminder planning through
  `utils/notification-planner.ts`), shows the update and review prompts
  (`components/shell/native-prompts.tsx`), and routes notification taps.
  The restored 2.0 dashboard no longer schedules the 08:00 reminder
  (id 65241) and has no prompts of its own. A state change in classic keeps
  progress (`changeUserState`), unlike 2.0; "start over" resets like the
  modern design.
  The in-app toasts for goals, streaks, and achievements point at modern
  pages, so they are not shown while the classic design is active; the
  inbox items are still stored and appear after a switch. Classic writes keep every 2.1 field (`schemaVersion`,
  `preferences`, `streak`, `reviewSchedule`, `inbox`, ...), and the schema
  stays at version 2.
- **Routes.**

  | Route | Modern | Classic |
  | --- | --- | --- |
  | `/dashboard` | Home | 2.0 dashboard |
  | `/practice` | study modes | 2.0 prepare screen |
  | `/prepare` | practice session | 2.0 prepare screen |
  | `/mock` | mock exam | 2.0 mock test |
  | `/progress` | progress page | 2.0 dashboard (its statistics) |
  | `/settings` | settings page | 2.0 dashboard with the settings dialog |
  | `/`, `/question-catalogue`, `/pruefstellen`, `/privacy-policy` | public pages | the same public pages |

  Notification deep links keep their routes. A question card
  (`/prepare?action=…&start=…`, [`FEAT-007`](007-rich-notifications.md))
  opens the classic prepare screen in classic mode; the `start` question is
  ignored there (known limitation, ADR-007 follow-up).
- **Look.** Classic mode shows the 2.0 look with the same HeroUI components
  and dependencies; the 100 translation keys the 2.0 screens use are still
  present and the 43 icon components are restored. The modern design does
  not change. Prompt, buttons, and the Settings section exist in German and
  English (`common.{de,en}.json`).

## Out of Scope

- Restyling or extending the classic design; it stays at 2.0 behaviour plus
  the adaptations above, and new features land in the modern design only.
- A classic version of the public pages (landing, catalogue, exam centers,
  privacy); they are modern in both modes.
- iOS (no project yet).
- An owner-side switch that moves every learner to the modern design, and
  removing the classic design (ADR-007 follow-up).

## Acceptance

- [x] A learner whose record has a federal state and finished onboarding but
      no stored choice sees the classic design plus one prompt; "Try the new
      design" opens the modern Home, "Keep the classic design" keeps the
      classic Home, Android Back counts as keep; the prompt never returns
      after either choice.
- [x] A learner without a record sees the modern onboarding and the modern
      design afterwards, with `lid:ui-mode` set to `"modern"`; no prompt.
- [x] Both designs offer a Settings button that switches to the other design
      without losing any data; switching lands on Home; deleting the record
      clears `lid:ui-mode`.
- [x] In classic mode the shared shell still plans reminders, shows the
      update and review prompts, and routes notification taps; classic
      writes keep every 2.1 field of the record (`schemaVersion`,
      `preferences`, `streak`, ...), and the schema stays at version 2.
- [x] Changing the federal state in classic mode keeps progress.
- [x] Tests cover the resolver rules, the hook, shell switching, the prompt
      choices, both settings buttons, the onboarding write, the restored 2.0
      logic (`__tests__/classic/`), and a real 2.0 record
      (`__tests__/fixtures/legacy-user-2.0-device.json`) rendering the
      classic dashboard.
- [x] `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`
      pass; `make build-sync` succeeds (export, Capacitor sync, debug APK).
- [x] The device check in PLAN-011 passes on the owner's phone with the
      current upgraded record; the true 2.0 record was verified in the
      headless browser run (PLAN-011 Evidence).
