---
id: FEAT-001
title: UI and UX Revamp with Study Modes, Streak Options, and Notifications
status: Done
date: 2026-10-09
priority: High
areas: [web, android, ui, notifications]
tags: [feature, ui, ux, streaks, notifications]
---

# Feature: UI and UX Revamp with Study Modes, Streak Options, and Notifications

## Summary

The app gets a new look and a calmer, clearer flow. The design borrows from the
thing every learner is working toward: the German passport. A deep burgundy
"pass" card with gold details shows how ready you are, your streak, and your
daily goal. Around it, the app adds more ways to practice (study modes), more
ways to keep a streak going, and reminders that help without nagging.

## User Story

As a person preparing for the Einbürgerungstest or the "Leben in Deutschland"
test, I want to see at a glance what to study next, practice in short focused
sessions, and get gentle reminders, so that I keep a daily habit and know when
I am ready for the real exam.

## Requirements

### Functional

- [x] **App shell:** a top bar with the brand, a notification bell, and
      settings; a bottom tab bar on phones (Home, Practice, Exam, Progress,
      Settings); tabs in the top bar on wide screens. Practice and exam
      sessions and onboarding hide the bars so the learner can focus.
- [x] **Android Back button:** closes an open dialog or sheet first; in a
      running mock exam asks before leaving; in onboarding goes one step
      back; on a tab root returns to Home; on Home minimizes the app. A
      practice session returns to the study modes.
- [x] **Onboarding:** three short steps on Android (state, daily goal,
      reminders) and two on the web. The language starts from the device
      language and can be switched inline on the first step; the exam date is
      set later in settings, and the home exam card links there while none
      is set. (Trimmed from six steps in
      [`PLAN-005`](../plans/PLAN-005-simplify-onboarding-settings-practice.md).)
- [x] **Home:** the pass card (readiness with "n of 310 questions known" as
      its explanation, streak, today's goal; no code strip or rosette), one
      clear "continue" action, this week's streak strip, study
      modes, mock exam summary, exam countdown, and the BAMF evaluation status.
- [x] **Study modes:** learn new questions, review due questions (spaced
      repetition), fix mistakes, flagged, skipped, your state's questions,
      practice by topic, quick round of 10, marathon through all questions in
      order, and questions you already know. The practice hub shows four
      primary modes (the recommended one, review due, mistakes, quick round)
      and folds the rest behind "More modes"; every mode keeps its deep link.
- [x] **Practice session:** large tappable answers, instant feedback (or
      confirm-before-check as a setting), explanation and translation inline,
      flag and skip, keyboard shortcuts, haptic feedback on Android, and a
      summary at the end with the mistakes from the session.
- [x] **Mock exam:** an intro screen (test type, timer on or off), an exam
      screen with a question map, flagged and unanswered warnings before
      submitting, and a full results page with a topic breakdown and answer
      review. Past exams can be reviewed again.
- [x] **Progress page:** readiness with its parts explained, estimated pass
      chance, an activity calendar, mastery by topic, answer breakdown, mock
      exam score trend and history, state questions, and achievements.
- [x] **Streak options:** daily goal (5, 10, 20, 33, or 50 questions); streak
      rule (any practice or daily goal reached); rest days that never break
      the streak; streak freezes earned every 7 days in a row (at most 2 saved)
      that cover a missed day automatically; best streak; milestones at 3, 7,
      14, 30, 60, and 100 days.
- [x] **In-app notifications (web and Android):** a notification center with
      unread badge for daily goal reached, streak milestones, achievements,
      exam countdown, BAMF evaluation updates, weekly tips, and a welcome note.
- [x] **Android notifications:** daily study reminder at a chosen time,
      streak-at-risk reminder in the evening, weekly summary on Sunday, exam
      countdown (30, 14, 7, 3, 1 days and exam day), mock exam nudge, and
      come-back reminders after 3, 5, 7, and 14 days away. Each type can be
      turned on or off. Tapping a notification opens the matching screen.
- [x] **Settings page:** state, language, theme, daily goal and streak
      options, notification types and times, exam date and test type, mock
      exam timer, practice preferences, larger question text, import and
      export, and start over. Advanced knobs are folded by default: the
      individual reminder types and times sit behind "Fine-tune" under the
      master reminders switch, and streak rule, rest days, and freezes sit
      behind "Advanced" with a one-line summary.
- [x] **Public pages:** landing page, question catalogue (with search and
      topic filter), exam centers, and privacy policy use the new design and
      keep their search-engine data.

### Non-Functional

- [x] Works offline in the Android app; no new network calls.
- [x] Static export keeps working; Android navigation uses `.html` paths.
- [x] Light and dark themes; respects reduced motion; visible keyboard focus;
      touch targets of at least 44 px; text contrast meets WCAG AA.
- [x] Every new text exists in German and English.

## Scope

### Area

- [x] `src/web/` application code, styles, translations, and tests.
- [x] `src/android/` is not changed. Notification channels are created at
      runtime by the existing plugin. Debug builds for device testing go to
      ignored build folders only.

## Interface Changes

- New routes: `/practice` (study modes), `/progress` (statistics and
  achievements), `/settings` (settings page).
- `/prepare?action=` accepts the new modes `review`, `category`, `quick`, and
  `marathon` in addition to the existing ones.
- `/mock?review=<datetime>` opens a past mock exam for review.
- The settings modal, the dashboard "show more" statistics, and the result
  modal are replaced by pages.

## Data Changes

The stored `user` record gains optional fields. Missing fields get defaults
when the record is read, and no existing field is removed or renamed:

- `preferences` (daily goal, streak rule, rest days, reminder switches and
  times, exam type, mock timer, practice options, text size)
- `streak` (best streak, saved freezes, days covered by a freeze)
- `reviewSchedule` (spaced-repetition box and due date per question)
- `achievements` (unlocked achievement ids and dates)
- `inbox` (in-app notifications with read state)
- `examDate`, `nickname`, `onboardingCompleted`, `lastSeenEvaluationDate`,
  `lastOpenedAt`
- Mock exams may store `passMark` and `examType`; older exams use 17.

Changing the federal state no longer erases progress.

## Decisions

- [`ADR-002`](../decisions/ADR-002-passport-design-system.md) - passport-inspired
  design system and app shell.
- [`ADR-003`](../decisions/ADR-003-local-first-notifications.md) - local-first
  notifications without a server.

## Edge Cases

- No stored record, or a record from an older version: defaults fill the gaps.
- Browser storage unavailable or full: the app keeps working for the session
  and shows a message instead of crashing.
- Notification permission denied on Android: settings explain how to allow
  it; nothing is requested again without a tap.
- Time zone or daylight-saving changes: streak days use local calendar days.
- Exam date in the past: countdown stops and offers to clear the date.
- A study mode with no questions shows an empty state with a next step.
- The mock exam timer runs out: the exam is submitted automatically.

## Rollback Strategy

See [`PLAN-004`](../plans/PLAN-004-ui-ux-revamp.md#rollback-plan).

- **Baseline:** `main` at `c295bc7`, tests, lint, and build recorded.
- **Trigger:** failing tests or build, extra lint errors, broken static export,
  Android navigation regression, or lost learner data.
- **Reversal:** stash the uncommitted branch work and switch back to `main`,
  or restore single files from `c295bc7`.
- **State safety:** additive data fields only; no dependency or Android
  project change; no deployment.
- **Recovery verification:** baseline tests, lint, and build results.

## Generated Prompts

- Not created. Implementation briefs live in the session workflow because they
  only apply to this change.

## Acceptance Criteria

- [x] All functional requirements above are visible in the app.
- [x] A learner record from version 2.0.145 loads with all answers and mock
      exams intact.
- [x] Unit tests cover streaks, goals, readiness, study modes, spaced review,
      achievements, in-app notifications, notification planning, and
      translation parity.
- [x] `npm test` and `npm run build` pass; lint has no more errors than the
      baseline.

## Verification Plan

- `cd src/web && npm test` (33 files, 871 tests)
- `cd src/web && npm run lint` (clean)
- `cd src/web && npm run build` (77 pages)
- Headless screenshots of landing, home, practice, mock exam, progress,
  settings, onboarding, and catalogue pages in light and dark mode at phone
  and desktop widths, using a seeded learner record.
- Device test on the owner's Samsung Galaxy S20 FE (Android 13), debug build
  installed over the released 2.0 app: the real record upgraded in place
  (schema 2, no onboarding, all answers and the mock exam kept); practice
  answer recorded; mock exam started, cancelled through the Back dialog, and
  a past exam reviewed; progress and settings pages; theme to light and
  language to English and back; test notification posted; exact alarms
  scheduled; export opened the Android share sheet; fresh install ran the
  six-step onboarding and scheduled eight reminders immediately; hardware
  Back verified on every screen type. The owner's record was restored
  afterwards.

## Device Findings Fixed

- Hardware Back during a mock exam used to step the WebView history and
  silently abandon the exam. Now the exit dialog opens.
- A new learner's reminders were not scheduled right after onboarding: the
  debounced Android sync dropped its timer when the record was written again
  within 800 ms with the same plan. Covered by
  `__tests__/notification-sync.test.tsx`.
- The mock exam intro always described the timer as off; the text now follows
  the switch.
- The English pass card label "Goal reached" overflowed at 360 px; it is now
  "Goal done".
- The pass card read as confusing: a fake machine-readable strip, a rosette
  behind the text, and "9 %" next to "13/310" looked like a contradiction.
  The strip and rosette are gone and the known count now explains the
  readiness ring (ADR-002 amendment).
- Onboarding showed the header and tab bar; it now runs in focus mode.
