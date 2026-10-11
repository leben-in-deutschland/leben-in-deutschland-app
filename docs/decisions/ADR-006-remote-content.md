---
id: ADR-006
title: Deliver Notices, Owner Switches, and the Question Catalogue Over the Daily Refresh Channel
status: Accepted
date: 2026-10-10
areas: [android, web, product]
tags: [adr, data, android, privacy, home, questions]
---

# ADR-006: Deliver Notices, Owner Switches, and the Question Catalogue Over the Daily Refresh Channel

## Context

[`ADR-005`](ADR-005-evaluation-status-refresh.md) gave the Android app one
safe way to learn something new without a Play release: download a small
public file once a day through Capacitor's native HTTP client
(`CapacitorHttp`), keep it under its own storage key, show the newest of
bundled and downloaded, fall back to the bundle when offline. Its Follow-Up
listed four candidate extensions. On 2026-10-10 the owner asked to
"implement what we can do without breaking our promise": no personal data
leaves the phone, the app works offline, and a learner's progress is never
touched.

Facts found while scoping:

- The Android app is a plain Capacitor wrapper around a static export.
  There is no Expo or over-the-air bundle update. `android-release.yml`
  builds and signs an AAB and publishes a GitHub Release on every push to
  `main` (no path filter), including the data-sync commits; uploading to
  Google Play is a manual owner step. The GitHub release version therefore
  does not tell a phone whether a newer Play version exists.
- Test-centre pages (`/pruefstellen`) are in `WEB_ONLY_PREFIXES`
  (`utils/navigation.ts`), are removed from the Android bundle by
  `scripts/prepare-android.sh`, and open the website. Refreshing
  `prüfstellen.json` inside the app would change nothing visible.
- Every reader of the question catalogue goes through
  `utils/question-bank.ts` (`getQuestionBank()`, a lazy singleton per page
  load) and `utils/question-loader.ts` (per-question explanations and
  translations fetched from the bundle). The sync workflow commits the
  split catalogue `src/web/data/questions-core.json` (about 160 KB, 460
  questions) to the public app repository. Progress is keyed by question
  number (`num`), never by text.
- `raw.githubusercontent.com` serves these files with an `ETag` and answers
  `304 Not Modified` with an empty body to `If-None-Match`; verified with
  `curl` and on the owner's phone through `CapacitorHttp`. The project's own
  domain still blocks non-browser clients (Vercel challenge, ADR-005).

## Options Considered

### Option 1: One shared remote-file layer, three files (chosen)

Factor the ADR-005 cache and download into `utils/remote-cache.ts` and
`services/remote-file.ts`, move the evaluation refresh onto them unchanged,
and add two more files on the same rules:

1. `notices.json` - a hand-edited owner file with a list of notices
   (localized title and body, optional link, tone, date window, platform,
   `minVersion`/`maxVersion`) and a `flags` object (`tipJar`). Shown as cards
   at the top of Home; "Got it" hides a notice for good on this phone. An
   "update available" message becomes an ordinary notice with `maxVersion`,
   written by the owner when a Play version is actually live.
2. `questions-core.json` from the app repository's `main` branch - checked
   once a day with `If-None-Match`; a changed file replaces the bundled
   catalogue at the next catalogue load only after a strict check (300
   general questions, every state present, unique numbers, well-formed
   answers), is stamped with the app version so a newer build's bundle wins,
   and a question whose text changed shows no bundled explanation or
   translation (they would describe the old wording).

Pros: one code path to test; everything is a small public file; identical
privacy posture; the owner can speak to users and switch the tip jar off
without a release; the catalogue follows BAMF changes within a day.
Cons: more storage keys to reason about; the catalogue change can confuse a
learner mid-review (handled: progress stays keyed by `num`, explanations hide
instead of lying); the owner must maintain a tiny JSON file.

### Option 2: Add an "update available" nudge from the GitHub release version

Fetch `https://api.github.com/repos/.../releases/latest` and compare with
`package.json`. Rejected: the release workflow publishes a release for every
data-sync commit while Play uploads are manual, so the nudge would tell
users to update to a version that is not in the store. Version-targeted
notices give the owner the same message at the right moment.

### Option 3: Refresh the test-centre list too

Low risk, but it changes nothing the Android app shows (the pages open the
website, which the sync workflow rebuilds). Dropped.

### Option 4: A hosted remote-config or push service

Firebase Remote Config, OneSignal, and similar would deliver the same files
plus true push, but add a vendor SDK, device identifiers, and a privacy
dialogue. Rejected for the same reasons as in ADR-003 and ADR-005.

## Decision

Option 1. Concretely:

- `utils/remote-cache.ts` - `createRemoteStore()` with one cache shape
  `{data, fetchedAt, attemptedAt, etag, appVersion}`, 24-hour max age,
  1-hour retry after a failed attempt, optional app-version stamp, memoised
  reads for `useSyncExternalStore`.
- `services/remote-file.ts` - `refreshRemoteFile()`: native-only gate, one
  in-flight request per store, `If-None-Match`, `304` keeps data, `404` can
  mean "empty file" (notices), every failure logs one warning and backs off.
- `utils/evaluation-store.ts` / `services/evaluation.ts` keep their exports
  and behaviour on top of the shared pieces.
- Notices: `utils/notice-store.ts`, `services/notices.ts`,
  `components/home/use-notices.ts`, `components/home/notice-card.tsx`;
  `SupportSection` treats `flags.tipJar === false` as "not supported".
  The file lives on a `content` branch of the app repository
  (`NOTICES_URL`), because a push to `main` would start the release and
  deploy workflows. Until the owner creates it, the app receives `404`,
  stores "nothing", and checks again the next day without warning.
- Questions: `utils/question-store.ts`, `services/questions.ts`;
  `question-bank.ts` prefers a valid downloaded catalogue from this app
  version at first use; `question-loader.ts` returns nothing for changed
  questions. A download identical to the bundle is stored as empty with its
  ETag so the daily check stays a `304`.
- Storage keys: `lid:notices`, `lid:notices-dismissed`, `lid:questions`
  next to `lid:evaluation`; old versions ignore them; export/import of the
  learner record is unaffected.

## Consequences

- The Android app now downloads up to three small public files a day
  (evaluation status, notices, question catalogue), all without cookies,
  identifiers, or query strings. The privacy policy names them.
- Learners keep their progress through a catalogue change; a renumbered or
  reworded question keeps its history under its number, and its explanation
  and translation disappear until the next app release ships new ones.
- The owner gains a Home notice board and a tip-jar switch at the cost of
  maintaining `notices.json` on the `content` branch.
- The daily cost for an unchanged catalogue is one `304` with no body.
- Nothing changes on the website build or for users who stay offline.

## Follow-Up

- Owner creates the `content` branch with `notices.json` (example in
  [`FEAT-004`](../features/004-notice-board.md)); until then Home shows no
  notices and the tip jar stays on.
- Owner reviews the privacy-policy wording.
- Owner decides whether the sync workflows should keep bumping the version
  for data-only changes (ADR-005 follow-up, now more pressing since
  question changes also reach phones without a release).
- Later: ship refreshed explanations and translations for changed questions
  with the next release, or add them to the daily channel if size allows.
- Implementation: [`PLAN-008`](../plans/PLAN-008-remote-content.md),
  [`FEAT-004`](../features/004-notice-board.md),
  [`FEAT-005`](../features/005-question-refresh.md).
