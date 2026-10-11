---
id: FEAT-007
title: Rich Android Notifications - Question of the Day and Encouragement
status: Done
date: 2026-10-11
tags: [feature, android, notifications, engagement]
---

# FEAT-007: Rich Android Notifications - Question of the Day and Encouragement

Decision: [`ADR-003`](../decisions/ADR-003-local-first-notifications.md)
(local-first, no push server).
Plan: [`PLAN-010`](../plans/PLAN-010-rich-notifications.md).

## Problem

The reminders of FEAT-001 are scheduled correctly, but every one of them is a
fixed sentence such as "Zeit zum Üben". To the learner they look exactly like
the single 08:00 reminder of version 2.0. The owner asked for notifications
that sometimes ask a real quiz question and sometimes encourage with the
learner's own numbers.

"Push" here still means scheduled local notifications: the app plans them on
the device from the learner's record. There is no server and no account, so
nothing about the privacy promise changes.

## Behaviour

- **Question of the day.** On even days of the year the daily reminder is a
  question card: the title names the topic ("Frage des Tages: Rechte &
  Freiheiten"), the first line shows the German question, the expanded card
  lists the four answers A-D, and a small line gives the number and topic.
  The question is picked deterministically per day from the learner's own
  catalogue - due reviews first, then wrong answers, then unanswered, then
  anything - and never a question with a picture. The three daily slots and
  the two come-back question cards show five different questions. Tapping the
  card or its "Antworten" button opens the practice screen with exactly that
  question first (`/prepare?action=<mode>&start=<num>`).
- **Encouragement.** On odd days the daily reminder states a real fact and
  rotates through whichever facts apply: streak length and questions left
  for today's goal (only on a card that fires today), reviews waiting, exam
  readiness and its status line, known/total questions, the last mock
  result, and - as the small line - days left to the exam. The learner's
  nickname appears in some variants. A learner without any data keeps the
  six generic sentences of FEAT-001. Consecutive days never repeat a title.
- **Streak at risk** names the streak ("12-Tage-Serie in Gefahr"), how many
  questions still count today, and the best streak. Tomorrow's streak card
  stays number-free because tomorrow's facts are unknown.
- **Come-back** after 3 and 7 days asks "Weißt du es noch?" with a question;
  after 5 and 14 days it encourages with facts that cannot go stale.
- **Weekly summary** uses the Android inbox style with two to four lines:
  known/total, readiness, reviews waiting, days to the exam.
- **Exam countdown** and **mock nudge** keep their texts and add readiness
  and the last mock result to the expanded card plus "Prüfung am DD.MM.YYYY".
- **Buttons.** Question cards offer "Antworten", encouragement and streak
  cards "Jetzt üben", exam and mock cards "Probeprüfung starten", the weekly
  card "Fortschritt ansehen". Every button opens the app at the card's route.
- **Test notification** in Settings now sends today's question card (prefix
  "Test ·"), so the learner sees the real format after five seconds.
- **Icon colour** of the status-bar icon is the brand red `#A83A50`.
- **Default time.** The daily reminder defaults to 07:00 (was 18:00), so
  the question of the day is seen in the morning; the streak check stays at
  20:30. Times the learner set in Settings or onboarding are untouched.
- The English interface shows English titles and lines but keeps the question
  text in German, because the exam is in German.

## Out of Scope

- Push notifications from a server, A/B testing, delivery analytics.
- Answering inside the notification (reply actions); the button opens the app.
- iOS (no project yet); the plugin fields used here also work there later.
- Changing when reminders fire, their ids, or the settings switches.

## Acceptance

- Over any three consecutive days with the daily reminder on, the plan holds
  at least one question card and one encouragement card, and no two daily
  cards share a title.
- A question card never carries an image question; its expanded text lists
  all four options; its route opens that question first; the test card uses
  the same format.
- A card that fires on a later day contains no fact that today's practice
  could falsify (no streak or "left today" numbers after offset 0).
- Notification ids, channels, preferences, and gating are unchanged (only
  the default daily time moved to 07:00);
  the user record schema is unchanged; records from version 2.0 and 2.1 plan
  without errors.
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and
  `make build-sync` pass; on the owner's phone the test card expands to the
  question with its options and a button, and the button opens that question.
