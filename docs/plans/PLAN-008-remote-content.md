---
id: PLAN-008
title: Notices, Owner Switches, and Question Catalogue Over the Daily Refresh Channel
status: Done
date: 2026-10-10
tags: [android, data, privacy, home, questions]
---

# PLAN-008: Notices, Owner Switches, and Question Catalogue Over the Daily Refresh Channel

Decision: [`ADR-006`](../decisions/ADR-006-remote-content.md).
Specs: [`FEAT-004`](../features/004-notice-board.md),
[`FEAT-005`](../features/005-question-refresh.md).
Builds on [`PLAN-007`](PLAN-007-evaluation-refresh.md).

## Context

ADR-005 gave the Android app one safe way to learn something new without a
Play release: download a small public file once a day through Capacitor's
native HTTP client, keep it under its own storage key, fall back to the
bundled copy. The owner asked to extend that to everything that keeps the
product promise - no personal data leaves the phone, the app works offline,
and a learner's progress is never touched.

Findings that shape the scope:

- Test-centre pages are removed from the Android bundle
  (`utils/navigation.ts` `WEB_ONLY_PREFIXES`) and open the website, which the
  sync workflow rebuilds; refreshing `prüfstellen.json` in the app would
  change nothing. Dropped.
- An "update available" nudge from the GitHub version would misfire: the
  release workflow publishes a GitHub Release on every data sync while Play
  uploads are manual. Replaced by version-targeted notices.
- The question catalogue is loaded through one module
  (`utils/question-bank.ts`, lazy singleton) from `questions-core.json`
  (160 KB), which the sync workflow commits to the public app repository.
  `raw.githubusercontent.com` answers `304 Not Modified` to `If-None-Match`,
  so a daily check costs nothing while the file is unchanged.

## Steps

- [x] `utils/remote-cache.ts`: one store factory (key, validator, max age,
      retry, optional app-version stamp, ETag) with the memoised
      `useSyncExternalStore`-friendly read used by every remote file.
- [x] `services/remote-file.ts`: one native download with conditional GET
      (`If-None-Match` → `304` keeps data), shape validation, warn-and-back-off
      on every failure, one in-flight request per store.
- [x] Move `evaluation-store.ts` / `services/evaluation.ts` onto the shared
      pieces without changing their exports or behaviour.
- [x] Notices: `utils/notice-store.ts` (schema, date/version/platform
      targeting, language pick, dismissed ids under `lid:notices-dismissed`),
      `services/notices.ts` (`404` = no notices), `components/home/use-notices.ts`,
      `components/home/notice-card.tsx` on Home; `flags.tipJar === false`
      hides `SupportSection`.
- [x] Questions: `utils/question-store.ts` (strict validator: 300 general
      numbers, every state present, unique numbers, answer letters), cache
      under `lid:questions` stamped with the app version, "same as bundled"
      stored as empty; `services/questions.ts`; `question-bank.ts` prefers a
      valid cache at first use; `question-loader.ts` hides bundled
      explanations and translations for questions whose text changed.
- [x] Translations (`home.en.json`, `home.de.json`), privacy-policy paragraph.
- [x] Tests for every module above; existing evaluation tests adjusted.
- [x] `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`,
      `npm run build:android`, debug APK on the owner's phone, release APK.
- [x] Docs: ADR-006, FEAT-004, FEAT-005, indexes, architecture, stack,
      memory, usage log.

## Acceptance Criteria

- [x] No module writes the learner record (`user`); all caches live under
      `lid:*` keys that old versions ignore.
- [x] Home shows a notice only when it is active for today, this platform,
      and this app version, in the learner's language; "Got it" hides it for
      good; a missing notice file shows nothing and is checked once a day.
- [x] `flags.tipJar: false` hides the tip jar; absence keeps it.
- [x] A downloaded catalogue is used only when it passes the strict check and
      was fetched by this app version; otherwise the bundled catalogue stays.
- [x] A question whose text changed shows no stale explanation or translation.
- [x] Unchanged remote files cost one `304` per day and no storage.
- [x] Offline or blocked: nothing visible changes; retry after an hour.

## Verification

```bash
cd src/web && npx vitest run
cd src/web && npx eslint . && npx tsc --noEmit
cd src/web && npm run build && npm run build:android
cd src/android && JAVA_HOME=/tmp/jdk21/jdk-21.0.12.1+1/Contents/Home ./gradlew assembleDebug assembleRelease
```

On the phone: plugin trace shows the three downloads on first Home open and
none on the second; `lid:notices`, `lid:questions`, `lid:evaluation` present;
a simulated notice renders and dismisses; `flags.tipJar=false` hides the tip
jar; a simulated changed question 1 renders in practice without its old
explanation; cache from another app version is ignored; learner record
byte-identical before and after.

## Rollback Plan

- **Baseline:** uncommitted branch `feat/ui-ux-revamp` on `c295bc7` with
  PLAN-007 applied; the owner's phone holds a real `lid:evaluation` cache
  and an intact record.
- **Trigger:** a failing check above, a learner-record write, a wrong
  question shown in practice, or the bundled catalogue not restoring when
  the cache is invalid.
- **Reversal:** restore the 13 touched files from the session snapshot
  `files/pre-remote/`; delete `utils/remote-cache.ts`,
  `services/remote-file.ts`, `utils/notice-store.ts`, `services/notices.ts`,
  `components/home/use-notices.ts`, `components/home/notice-card.tsx`,
  `utils/question-store.ts`, `services/questions.ts`, their tests, and the
  new docs; rebuild and reinstall; delete `lid:notices`,
  `lid:notices-dismissed`, `lid:questions` on the phone.
- **State safety:** no dependency, workflow, schema, or Android native
  change; new storage keys only; secrets untouched.
- **Recovery verification:** `npx vitest run` back to 38 files / 945 tests,
  debug APK installs, Home renders the evaluation card, record unchanged.

## Evidence

- `npx vitest run`: 43 files, 995 tests (new: `remote-cache` 11,
  `remote-file` 11, `notice-store` 18 with `home-notices`, `question-refresh`
  10). `npx eslint .` and `npx tsc --noEmit` clean. `npm run build`,
  `npm run build:android`, `assembleDebug` (18 MB) and `assembleRelease`
  (4 MB, `CapacitorHttp` kept in `seeds.txt`) succeeded.
- Owner's phone (Samsung S20 FE, debug APK over the existing install):
  first Home open made exactly two native requests (notices, questions; the
  evaluation cache from the morning was still fresh) and stored
  `lid:questions` as "same as bundled" with the GitHub ETag and
  `lid:notices` as "nothing" after the real `404`; a second open made none.
  With both caches aged 25 hours the trace showed `If-None-Match` with the
  weak ETag, a `304` with an empty body for the catalogue, and a `404` for
  the notices, both re-stamped fresh.
- Simulated notice file: card rendered above the pass card in German with
  link and "Verstanden"; dismissing wrote `["test-1"]` to
  `lid:notices-dismissed`, hid the card across reloads; a `maxVersion:
  "1.0.0"` entry stayed hidden. `flags.tipJar` on: Settings showed the tip
  jar (fake products) with one Play call; off: hidden, zero Play calls.
- Simulated catalogue with question 26 changed: marathon practice showed
  the new text, "Übersetzen" and "Erklärung" showed the "none yet" texts
  for it, and question 27 kept its explanation.
- Offline with all caches aged: three warnings, data kept, `attemptedAt`
  stamped, Home rendered; a reload within the hour made no request.
- Another-version cache is covered by unit tests (`question-refresh`), not
  repeated on the phone.
- All five storage keys restored from the pre-test backup and compared
  byte-identical, including the learner record; phone released.

