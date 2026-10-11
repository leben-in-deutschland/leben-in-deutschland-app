---
id: ADR-003
title: Use Local-First Notifications Without a Server
status: Accepted
date: 2026-10-09
areas: [web, android, notifications]
tags: [adr, notifications, privacy, streaks]
---

# ADR-003: Use Local-First Notifications Without a Server

## Context

The owner asked for more notifications. The app has no backend and promises
that learner data never leaves the device. Android already had one daily
reminder at 08:00 (id `65241`), and it asked for permission on every dashboard
visit after a refusal.

## Options Considered

### Push notifications through a server (for example Firebase)

- Can send messages based on live data.
- Needs a backend, accounts or device tokens, and a privacy policy change.
  This breaks the "no data leaves your device" promise.

### Browser notifications on the web

- Works only while the page is open, unless a service worker and push server
  are added. Not reliable for daily reminders.

### Local-first: in-app notification center plus Android local notifications

- In-app notifications are created on the device from the learner's own data
  and work on web and Android.
- Android notifications are scheduled with `@capacitor/local-notifications`
  (already installed). Every app start re-plans the next days, so reminders
  adapt to what the learner did, and come-back reminders only fire when the
  learner stays away.
- Messages cannot react to events after scheduling, so texts avoid numbers
  that could become stale.

## Decision

Use the local-first approach. A pure planner
(`src/web/utils/notification-planner.ts`) decides what to schedule and is unit
tested; a thin service (`src/web/services/notifications.ts`) talks to the
plugin, creates Android channels, cancels the old id `65241`, and opens the
right screen when a notification is tapped. Permission is requested only after
the learner taps a button.

## Consequences

### Positive

- No server, no tracking, and the privacy promise stays true.
- Each reminder type can be switched off on its own.

### Negative

- Web users get in-app notifications only, not system notifications.
- Android must reschedule on app start; if the app is never opened again the
  last planned come-back reminder is the final one, which is intended.

## Follow-Up

- [x] Document the planner and service in `docs/architecture/overview.md`.
- [x] Verify notification taps and channels on a real Android device before
      release (verified on the owner's phone during PLAN-005 and PLAN-010).
- [x] Richer cards without a server: FEAT-007 / PLAN-010 add question-of-the-
      day and encouragement content, action buttons, and deep links, all
      planned on the device from the record. The decision stands: still no
      push server, no account, no network for notifications.
