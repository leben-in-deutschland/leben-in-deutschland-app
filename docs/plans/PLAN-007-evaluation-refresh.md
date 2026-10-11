---
id: PLAN-007
title: Refresh the BAMF Evaluation Status From the Phone
status: Done
date: 2026-10-10
tags: [plan, android, data, privacy]
---

# Plan: Refresh the BAMF Evaluation Status From the Phone

## Goal

Android users see a new BAMF evaluation date without installing a new app
version. The app downloads the small public status file at most once a day
through Capacitor's native HTTP client, keeps it in its own storage key, and
falls back to the bundled copy when offline. The website keeps its current
build-time value, which is already refreshed by the daily workflow.

## Context

- [`ADR-005`](../decisions/ADR-005-evaluation-status-refresh.md) chose this
  approach; the owner approved "the native HTTP approach" on 2026-10-10.
- The intended source (`lebenindeutschland.org`) is currently behind
  Vercel's security challenge: every non-browser request, including
  Capacitor's native client on the owner's phone, receives a 429 challenge
  page. The scraper repository's published file on `raw.githubusercontent.com`
  answers 200 and is the same URL the daily workflow already downloads, so it
  becomes the source. The URL is one exported constant and can move back to
  the website once a firewall bypass exists.
- `CapacitorHttp` ships inside `@capacitor/core` 7.6.8 and is registered
  natively by default; calling it directly does not patch `fetch`. No new
  package is needed.
- Baseline: branch `feat/ui-ux-revamp`, uncommitted; last commit `c295bc7`.
  Snapshot of files this plan edits:
  session `files/pre-evaluation/`.

## Steps

- [x] `utils/evaluation-store.ts`: key `lid:evaluation` holding
      `{ data, fetchedAt, attemptedAt }`; tolerant read with shape check;
      memoised snapshot and subscribe for `useSyncExternalStore`;
      `newestEvaluation(bundled, cached)` picks the later `lastSyncAt`;
      `shouldRefresh(cache, now)` = no data or older than one day, and no
      failed attempt within the last hour.
- [x] `services/evaluation.ts`: `EVALUATION_URL`, `refreshEvaluation(now)`
      - Android only, `CapacitorHttp.get` with `responseType: "json"` and
      ten-second timeouts, accepts object or string bodies, validates, writes
      the cache, never throws, records failed attempts.
- [x] `components/home/home-screen.tsx`: read cached-or-bundled data through
      the store and trigger one refresh on mount (`use-evaluation.ts`);
      `EvaluationStatus` stays a pure component.
- [x] Privacy policy: one paragraph about the daily status download from
      GitHub (owner's legal wording to review).
- [x] Tests: store, service (web no-op, fresh cache no-op, stale fetch,
      string body, non-200, invalid shape, exception, backoff), home screen
      shows the newer cached date.
- [x] Build: `npm test`, `npm run lint`, `npx tsc --noEmit`,
      `npm run build`, `npm run build:android`, `./gradlew assembleDebug`
      and `assembleRelease`.
- [x] Device: install over the owner's record, open Home, confirm
      `lid:evaluation` is written from the live file and the card renders;
      simulate a newer cached value and see the card change; clear the
      cache key; record unchanged.
- [x] Docs: ADR-005 Accepted with the source amendment, FEAT-003, stack and
      architecture lines, PLAN-005 network-audit note, memory lesson, index
      files, usage log.

## Rollback Plan

- **Baseline:** branch `feat/ui-ux-revamp` at `c295bc7` plus the
  uncommitted revamp work; snapshot in session `files/pre-evaluation/`.
- **Trigger:** a failing test, lint, type check, or build; the home screen
  crashing or showing a wrong date; any write to the learner record; the
  device fetch misbehaving (looping, blocking rendering, or firing more
  than once a day).
- **Reversal:** delete `src/web/utils/evaluation-store.ts`,
  `src/web/services/evaluation.ts`, and the three new test files; restore
  `src/web/components/home/home-screen.tsx` and
  `src/web/app/privacy-policy/page.tsx` from the snapshot; restore the
  touched docs from the snapshot and delete `PLAN-007` and `FEAT-003`.
- **State safety:** no dependency, schema, workflow, Android, or deployment
  change; the only new device state is the `lid:evaluation` key, which old
  versions ignore and which `localStorage.removeItem` clears.
- **Recovery verification:** `cd src/web && npm test && npm run lint &&
  npx tsc --noEmit` green; `git status --short` shows only the revamp files.

## Acceptance Criteria

- [x] On Android the home card shows the newer of bundled and cached data;
      the first visit after install fetches once, later visits within a day
      do not fetch.
- [x] Offline, blocked, or malformed responses leave the bundled value in
      place without errors in the UI.
- [x] The website behaviour is unchanged (no request, bundled value).
- [x] The learner record is not touched; the cache lives in `lid:evaluation`.
- [x] Tests, lint, type check, web build, and both Android builds pass.

## Verification

```bash
cd src/web && npx vitest run __tests__/evaluation-store.test.ts __tests__/evaluation-service.test.ts __tests__/home-evaluation.test.tsx
cd src/web && npm test && npm run lint && npx tsc --noEmit && npm run build
cd src/web && npm run build:android && cd ../android && ./gradlew assembleDebug assembleRelease
adb logcat -d | grep "Capacitor/Plugin: To native" | grep "pluginId: CapacitorHttp"
```

## Evidence (2026-10-10)

- Source check from the owner's phone through `Capacitor.Plugins.CapacitorHttp.get`:
  `lebenindeutschland.org/data/translations/de.json` → `429`,
  `x-vercel-mitigated: challenge`; the scraper's file on
  `raw.githubusercontent.com` → `200`, parsed JSON, `cache-control: max-age=300`.
- `npx vitest run`: 38 files, 945 tests (+3 files, +30 tests);
  `npx eslint .` and `npx tsc --noEmit` clean; `npm run build` 77 pages;
  `npm run build:android` synced; `./gradlew assembleDebug` and
  `assembleRelease` pass (JDK 21 at `JAVA_HOME`); R8 `seeds.txt` keeps
  `com.getcapacitor.plugin.CapacitorHttp.get/request`.
- Debug build installed with `adb install -r` over the owner's record (BE, 54
  answers, 1 mock, schema 2 - unchanged throughout). First home open:
  one `CapacitorHttp get` in the plugin trace, `lid:evaluation` written with
  live data whose `lastSyncAt` (09.10.2026) is newer than the bundled file
  (08.10.2026); the card switched to "Zuletzt geprüft am 9. Okt. 2026".
  Settings → Home again: no second request.
- Simulated newer cache (21.07.2026 / 15.10.2026): card shows
  "21. Juli 2026". Cache cleared, Wi-Fi and data off, reload: one failed
  attempt in about 50 ms, `attemptedAt` stamped, card shows the bundled
  14. Juli / 8. Okt. Wi-Fi on, reload within the hour: no request. Cache
  cleared, reload: fresh download again, phone left in that normal state.
- Observation unrelated to this change: a `theme=light` key appeared on the
  phone at some point during the morning's tests although the owner uses the
  system theme; dashboard, settings, and index visits do not write it. Key
  removed again. Not reproduced.
- Release APK was not installed on the device this time: the cache was fresh,
  so no request would have been observable without DevTools; the R8 seeds
  and the debug-device run cover the risk.

