---
id: ADR-005
title: Refresh the BAMF Evaluation Status Without an App Release
status: Accepted
date: 2026-10-10
areas: [android, web, product]
tags: [adr, data, android, privacy]
---

# ADR-005: Refresh the BAMF Evaluation Status Without an App Release

## Context

The home screen and landing page show how far BAMF has evaluated exams
("Auswertungsstatus"). The value comes from
`src/web/data/current-evaluation.json`, which is imported at build time
(`data/data.ts` → `evaluationData()`). A scheduled workflow
(`.github/workflows/sync-evaluation.yml`, daily 02:00 UTC) downloads the file
from the scraper repository `leben-in-deutschland/leben-in-deutschland-scrapper`
and, when it changed, bumps the patch version and pushes a commit. That push
redeploys the website and starts a Play release.

Consequences today:

- Every data change (roughly every one to two weeks according to the file's
  history) is a full Android release that passes Play review.
- Android users see a new date only after they update the app; the website
  is always current.
- The app makes no runtime network requests for its own data (ADR-003 and
  the network audit in PLAN-005). The owner has asked about internet use and
  cares about it.

The owner asked for an alternative on 2026-10-10 and approved "the native
HTTP approach" the same morning.

While preparing the change, the project's own domain turned out to be behind
Vercel's security challenge: `curl`, an Android user agent, and Capacitor's
native client on the owner's phone all received `429` with
`x-vercel-mitigated: challenge`, even for the home page. The scraper
repository's file on `raw.githubusercontent.com` - the exact URL the daily
workflow already downloads - answered `200` from the phone.

## Options Considered

### Option 1: The app fetches the file itself (recommended)

On Android, when the home screen opens and the last check is older than
one day, fetch `current-evaluation.json` (about 3 KB) from
`https://lebenindeutschland.org/...` through Capacitor's native HTTP
(`CapacitorHttp`, part of `@capacitor/core`; no CORS set-up, no new package).
Store the result under a new storage key (`lid:evaluation`), never inside the
learner record. Render the stored value when present, otherwise the bundled
one. A failed or offline check is silent.

- Pros: instant updates for everyone; no backend, account, SDK, or cost;
  bundled fallback keeps the app fully usable offline; old versions ignore
  the extra key (backward compatible); data-only commits could stop
  triggering Play releases.
- Cons: introduces the app's first runtime request for its own data (one
  anonymous GET per day to the project's own domain, which Vercel serves and
  therefore sees the IP address); the privacy policy needs one sentence;
  the file must be served from the website (copy into `public/data/` during
  the build, next to the translation files that `question-loader.ts`
  already loads).

### Option 2: Keep the current pipeline

Play auto-update delivers each patch release within one to two days for most
users; the existing in-app update prompt (`native-prompts.tsx`) nudges the
rest.

- Pros: nothing changes; zero runtime network use stays true.
- Cons: a store release per data change; users with auto-update off keep an
  old date indefinitely.

### Option 3: Remote config, push, or OTA bundle services

Firebase Remote Config or push messages, or a Capacitor live-update service.

- Pros: fast and flexible.
- Cons: third-party SDKs, tracking surface, accounts and possibly cost;
  contradicts ADR-003 (local-first, no server) and the privacy policy.

## Decision

Option 1, accepted by the owner on 2026-10-10, with one amendment: the
source is the scraper repository's published file on
`raw.githubusercontent.com`, not the project's own domain, because Vercel's
challenge blocks native clients. The URL is a single constant
(`EVALUATION_URL` in `services/evaluation.ts`) and can move back to the
website once a firewall bypass for that path exists.

Rules: Android only; fetch at most once per day, back off for an hour after
a failure, never block rendering, and show the newer of the bundled file and
the cached download. The cache lives under its own key (`lid:evaluation`)
and never touches the learner record. Keep the daily workflow so the website
and the bundled fallback stay fresh; whether data-only commits should still
trigger a Play release is a separate owner choice recorded in Follow-Up.

## Consequences

- `services/evaluation.ts` (download) and `utils/evaluation-store.ts`
  (cache, validation, refresh gate, newest-wins); the home screen reads
  cached-or-bundled through `components/home/use-evaluation.ts`.
- No file needs to be served from the website, so no build or workflow
  change.
- The privacy policy gains a paragraph naming GitHub as the host of the
  public file; `docs/context/stack.md` lists the request; the network audit
  note in PLAN-005 is updated.
- Tests cover the cache, the download (web no-op, fresh cache, string body,
  non-200, bad shape, exception, backoff, shared in-flight), and the card.
- Android users on an old build keep seeing their build-day value until
  they update once; after that the date refreshes daily.

## Follow-Up

- Owner decides whether the sync workflow should keep bumping the version
  for data-only changes now that the app refreshes itself.
- Owner may add a Vercel firewall bypass for
  `/data/current-evaluation.json` and switch `EVALUATION_URL` back to the
  website; the daily sync would then also have to publish the file there.
- Owner reviews the privacy-policy wording.
- Implementation: [`PLAN-007`](../plans/PLAN-007-evaluation-refresh.md),
  [`FEAT-003`](../features/003-evaluation-refresh.md).
- Candidate extensions of the same channel, each still "one small public
  file, bundled default, own cache key, newest wins, offline fallback"; none
  is decided, and each needs its own ADR or plan before code:
  1. A hand-edited notice file for a Home announcement card and an
     "update available" nudge read from the app's published version.
  2. Refreshing the scraper's `prüfstellen.json` (test centres, about
     200 KB, re-scraped every 15 days); no learner data depends on it.
  3. Refreshing the scraper's `question.json` (about 2.5 MB): download only
     on change and keep answered-history valid because progress is tied to
     question identifiers; the riskiest and most valuable option.
  4. Owner-controlled switches (for example tip jar on/off) with bundled
     defaults that fail safe.
  Out of reach for this channel: anything per user (sync, leaderboards),
  anything while the app is closed (real push), and analytics, which would
  break the "no data collected" promise.
