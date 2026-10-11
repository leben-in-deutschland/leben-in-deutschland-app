---
id: PLAN-010
title: Rich Android Notifications - Question Cards and Encouragement
status: Done
date: 2026-10-11
tags: [android, notifications, engagement]
---

# PLAN-010: Rich Android Notifications - Question Cards and Encouragement

Spec: [`FEAT-007`](../features/007-rich-notifications.md).
Decision: [`ADR-003`](../decisions/ADR-003-local-first-notifications.md)
(local-first, no push server) stays in force.

## Context

The owner reports: "I got only one notification and it was similar to the
old one", and asks for rich notifications that sometimes ask a question and
sometimes encourage.

What the code does today (`utils/notification-planner.ts`,
`services/notifications.ts`):

- Plans one-shot Android notifications on every app start and whenever the
  inputs change: daily reminders for today and the next two days (ids
  2000-2002), come-back reminders after 3/5/7/14 days away (2100-2103),
  streak-at-risk this evening and tomorrow (3000-3001), a weekly summary on
  Sunday 18:00 (4000), exam countdowns (5000-5005), and a mock-exam nudge
  (6000). All `schedule.at` one-shots with `allowWhileIdle`.
- Every text is a fixed translation string. The daily reminder rotates six
  generic variants ("Zeit zum Üben", "Deine Fragen für heute warten", ...).
  No text contains a question, a number, or the learner's name. `largeBody`
  just repeats `body`; no `summaryText`, `inboxList`, or action buttons.
- The owner's phone received the new build on 2026-10-10. With the default
  times (daily 18:00, streak 20:30) only one or two reminders were due before
  this report, so delivery worked as designed; the complaint is about the
  content, which indeed looks like the old single 08:00 reminder.
- `@capacitor/local-notifications` 7.0.6 supports `largeBody` (BigText),
  `summaryText`, `inboxList` (InboxStyle), `actionTypeId` with
  `registerActionTypes`, `extra`, and `iconColor`. Action types persist in
  the plugin's storage, so buttons render even when the app process is gone.
- Practice sessions start from `/prepare?action=<mode>&category=&size=`;
  nothing can open one specific question yet.

No push server is added: everything is planned on the device from the
learner's own record (ADR-003), so the privacy promises ("no account, no
tracking") hold.

## Steps

- [x] `utils/notification-content.ts` (new, pure): picks a deterministic
      "question of the day" per calendar day from the learner's catalogue
      (due reviews first, then wrong answers, then unanswered, then all;
      never image questions), renders question cards (title with topic,
      question as body, A-D options in `largeBody`, number + topic as
      `summaryText`) and encouragement cards from real numbers (streak,
      due reviews, readiness status, known/total, days to exam, last mock
      result) with a rotating template pool so consecutive days differ;
      weekly InboxStyle lines from facts that cannot go stale (known/total,
      readiness, answers this week). Falls back to the existing generic texts
      when no data applies. Translations de/en with `{placeholders}`.
- [x] `utils/study-modes.ts` + `app/prepare/page.tsx` +
      `components/practice/practice-session.tsx`: optional `start=<num>`
      parameter that moves (or prepends) one catalogue question to the front
      of the session; `modeHref(mode, category, start)`; session key includes
      it.
- [x] `utils/notification-planner.ts`: `PlannedNotification` gains optional
      `largeBody`, `summaryText`, `inboxList`, `actionTypeId`,
      `questionNum`; daily reminders alternate question/encouragement cards
      by day parity; come-back 3 and 7 days ask "Weißt du es noch?" with a
      question, 5 and 14 encourage with numbers; streak-at-risk today carries
      the streak length and remaining questions; exam and mock cards carry
      readiness or the last mock result; weekly uses `inboxList`. Ids,
      channels, times, and gating unchanged.
- [x] `services/notifications.ts`: maps the new fields into the plugin
      schema, registers action types (`question` → "Antworten", `practice`
      → "Jetzt üben", `mock` → "Probeprüfung", `progress` → "Fortschritt";
      all `foreground: true`) once per session and language; routes button
      taps like body taps; the test notification becomes today's question
      card so the learner sees the rich format at once.
- [x] `capacitor.config.ts`: `LocalNotifications.iconColor` = brand primary
      `#A83A50`; `cd src && make build-sync` copies it to the Android assets.
- [x] Settings hint for the daily reminder mentions question and
      encouragement cards (de/en).
- [x] Default daily reminder time moves from 18:00 to 07:00 (owner request
      "change the time to 7"): the question of the day arrives in the morning,
      the streak check stays at 20:30. Only the default changes; a time the
      learner set stays. The revamp is unreleased, so no stored record carries
      the old default except the owner's test phone, which is updated there.
- [x] Tests: content engine (determinism, pools, fallbacks, no image
      questions, placeholders filled, lengths), planner (card kinds per day,
      fields present, ids unchanged), service (schema mapping, action types
      registered once, button taps route), study modes (`start`), prepare
      page param parsing.
- [ ] Verification on the owner's phone (`<device-serial>`): debug APK, storage
      backed up and restored, test notification expanded in the shade shows
      question + options + button, tap opens that question, pending list
      shows the mixed plan.
- [x] Docs: FEAT-007, this plan Done with evidence, memory lesson, index
      rows, usage log.

## Acceptance Criteria

- Over any three consecutive days with the daily reminder on, at least one
  question card and one encouragement card are planned, and no two
  consecutive daily cards have the same title.
- A question card never uses a question with an image; its `largeBody`
  lists all four options; tapping it (body or button) opens
  `/prepare?action=<mode>&start=<num>` with that question first.
- Encouragement cards only state numbers that come from the record at
  planning time and cannot be wrong later (no "today" counts in cards that
  fire tomorrow).
- Notification ids, channels, preferences, and the gating rules
  (onboarding, master switch, rest days, goal met) are unchanged, so existing
  users keep their settings and nothing is scheduled twice.
- No change to the user record schema; older records plan correctly.
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

## Evidence

- `cd src/web && npx vitest run`: 45 files, 1099 tests pass (47 new content
  tests, 85 planner, 110 service, 23 new study-mode cases, 5 prepare-page
  cases); `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run build`
  exit 0; `cd src && make build-sync` exit 0 (`iconColor` present in
  `src/android/app/src/main/assets/capacitor.config.json`);
  `npm run build:android` exit 0; `./gradlew assembleDebug` (Homebrew JDK 21)
  exit 0, 18 MB debug APK.
- Device (`<device-serial>`, record backed up first): the rich build installed
  with `adb install -r`; the plugin trace showed
  `checkPermissions → createChannel×4 → registerActionTypes → getPending →
  cancel → schedule`; `getPending` returned the mixed plan: 2000 "Question of
  the day: History & Geography" (`/prepare?action=review&start=25`), 2001
  "9% exam readiness", 2002 question (Constitution), 2100 "Do you still know
  this one?", 2102 come-back question (BE-7), 2103 "13 of 310 questions
  already stick", 3000 "2-day streak at risk — 1 more question and today
  counts.", 4000 weekly. The record stayed unchanged apart from app stamps.
- Device follow-up (2026-10-11 08:41, with the PLAN-011 build, which carries
  the 07:00 default): installed on the owner's phone; the owner had already
  set the reminder time to 07:05 in Settings, so the stored value was left
  alone; `getPending` lists the daily cards at 07:05 (2001–2103), the
  weekly review at 18:00, 8 in total. The expanded-card screenshot and the
  tap-through to `start=<num>` were not repeated in that session.
- Files changed: `utils/notification-content.ts` (new), `utils/
  notification-planner.ts`, `services/notifications.ts`, `utils/
  study-modes.ts`, `utils/user-defaults.ts`, `app/prepare/page.tsx`,
  `components/practice/practice-session.tsx`, `components/preferences/
  notifications-section.tsx`, `components/shell/use-app-effects.ts`,
  `capacitor.config.ts`, `data/translations/areas/common.{de,en}.json`,
  `data/translations/areas/settings.{de,en}.json`, tests under
  `__tests__/` (`notification-content`, `notification-planner`,
  `notifications-service`, `prepare-page`, `study-modes`, `settings-native`,
  `notification-sync`, `user-defaults`).

## Rollback

- **Baseline:** uncommitted branch `feat/ui-ux-revamp` at `c295bc7` with the
  prior tasks' changes (store assets included); phone record backed up to the
  session folder before any device run.
- **Trigger:** failing tests/lint/build, a notification that shows wrong
  numbers or a missing question, duplicate or missing schedules on the
  device, or the owner rejecting the card style.
- **Reversal:** `git checkout -- ` is not available (the branch is
  uncommitted), so revert by hand: delete `utils/notification-content.ts`
  and its test, remove the new fields from the planner and service, remove
  the `start` option, the `iconColor` line, and the new translation keys;
  re-run `make build-sync`. The files changed are listed in Evidence.
- **State safety:** no schema or dependency change; ids unchanged, so an
  older build cancels and replaces the same notifications; the phone record
  is restored from the backup and compared byte for byte.
- **Recovery verification:** `npm test` and `npm run build` pass; pending
  notifications on the phone equal the pre-change plan.
