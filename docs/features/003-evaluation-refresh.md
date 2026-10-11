---
id: FEAT-003
title: Daily Refresh of the BAMF Evaluation Status on Android
status: Done
date: 2026-10-10
tags: [feature, android, data, privacy]
---

# FEAT-003: Daily Refresh of the BAMF Evaluation Status on Android

Decision: [`ADR-005`](../decisions/ADR-005-evaluation-status-refresh.md).
Plan: [`PLAN-007`](../plans/PLAN-007-evaluation-refresh.md).

## Problem

The home card "BAMF Auswertungsstatus" showed the value from the day the
installed app was built. A new date reached Android users only through a
new Play release.

## Behaviour

- On Android, when the home screen opens and the cached status is missing or
  older than 24 hours, the app downloads the public status file (about 3 KB)
  from the scraper repository on GitHub through Capacitor's native HTTP
  client, with ten-second timeouts.
- The card shows the newer of the bundled file and the cached download,
  compared by `lastSyncAt`; a stale cache never hides a newer app bundle.
- A download that fails, is blocked, is not `200`, or has an unexpected
  shape changes nothing visible; the app waits an hour before trying again.
- The website never downloads; its bundled value is rebuilt by the daily
  workflow.
- The cache lives under `lid:evaluation` as
  `{ data, fetchedAt, attemptedAt }`. The learner record is not written.
- The privacy policy names GitHub as the host of the public file and states
  that only the IP address travels with the request.

## Out of Scope

- Changing the daily sync workflow or the Play release trigger.
- Serving the file from the project's own domain (blocked by Vercel's
  challenge; see ADR-005 Follow-Up).
- Notifying the learner when the date changes.

## Acceptance

- [x] First home visit after install writes `lid:evaluation` from the live
      file; later visits within a day make no request (device, 2026-10-10).
- [x] A newer cached value renders on the card; an older one is ignored
      (unit tests; newer value simulated on the device).
- [x] Offline: no error, bundled value shown, attempt stamp written, no
      retry within an hour (device).
- [x] Learner record unchanged before and after (device).
- [x] `npm test` (38 files, 945 tests), `npm run lint`, `npx tsc --noEmit`,
      `npm run build`, `npm run build:android`, `assembleDebug`,
      `assembleRelease` (R8 keeps `CapacitorHttp.get/request`).
- [ ] Owner reviews the privacy-policy wording.
