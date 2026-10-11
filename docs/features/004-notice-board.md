---
id: FEAT-004
title: Owner Notice Board and Remote Switches on Home
status: Done
date: 2026-10-10
tags: [feature, android, home, privacy]
---

# FEAT-004: Owner Notice Board and Remote Switches on Home

Decision: [`ADR-006`](../decisions/ADR-006-remote-content.md).
Plan: [`PLAN-008`](../plans/PLAN-008-remote-content.md).

## Problem

The owner had no way to tell Android users anything ("results for the
October exams are out", "a new version with X is in the store", "the tip jar
is paused") without a Play release, and no way to switch an optional feature
off once shipped. The daily refresh channel from FEAT-003 can carry a tiny
hand-edited file that does both.

## Behaviour

- Once a day (and at most once an hour after a failure) the Android app
  downloads `notices.json` from the app repository's `content` branch with
  Capacitor's native HTTP client. A missing file (`404`) means "no notices"
  and is not an error. The web build never downloads it.
- The file has this shape; every entry is checked and bad entries are
  dropped one by one:

  ```json
  {
    "notices": [
      {
        "id": "results-2026-10",
        "title": { "de": "Ergebnisse sind da", "en": "Results are out" },
        "body": { "de": "BAMF hat die Prüfungen bis 1.10. ausgewertet.", "en": "BAMF has evaluated exams up to 1 Oct." },
        "url": "https://www.bamf.de/...",
        "linkLabel": { "de": "Zur BAMF-Seite", "en": "Open BAMF page" },
        "tone": "success",
        "from": "2026-10-10",
        "until": "2026-10-31",
        "platform": "android",
        "minVersion": "2.0.100",
        "maxVersion": "2.0.145"
      }
    ],
    "flags": { "tipJar": true }
  }
  ```

  `id` and a localized `title` are required. `tone` is `info` (default),
  `success`, or `warning`. `from`/`until` are inclusive `YYYY-MM-DD` dates
  in the phone's local day. `platform` is `android`, `web`, or `all`.
  `minVersion`/`maxVersion` compare numerically with the app's
  `package.json` version, so "please update" reaches only older builds.
  `url` must be `http(s)`.
- Home shows every active notice as a card above the pass card in the
  learner's app language (falls back to English, then German, then any
  language given), with an optional link that opens in the browser and a
  "Got it" button that hides that notice for good on this phone. Dismissed
  ids live under `lid:notices-dismissed` (last 50).
- `flags.tipJar: false` hides the tip jar in Settings and stops asking
  Google Play for products; a missing or malformed flag keeps the tip jar
  on. More switches can be added to the same object with fail-safe defaults.
- Nothing in this feature reads or writes the learner record. Cache under
  `lid:notices`; offline or blocked phones simply keep what they have.

## Out of Scope

- Push notifications while the app is closed (ADR-003).
- Per-user targeting, counting views, or any upload.
- An automatic "update available" nudge from the GitHub release version
  (rejected in ADR-006; use a notice with `maxVersion` instead).
- Showing notices on the website.

## Owner Steps

1. Create a `content` branch in `leben-in-deutschland-app` from any commit
   and add `notices.json` at its root (pushes to `content` run no workflow).
2. Edit the file whenever needed; phones pick it up within a day. Remove or
   date-limit entries instead of leaving them forever.
3. To pause the tip jar, set `"flags": { "tipJar": false }`.

## Acceptance

- [x] A valid file renders the right notices for today, this platform, and
      this version in the learner's language; "Got it" hides for good.
- [x] A `404` is stored as "nothing", shown nowhere, and checked daily.
- [x] `flags.tipJar: false` hides the tip jar without a Play call; absence
      keeps it.
- [x] Learner record untouched; new keys only (`lid:notices`,
      `lid:notices-dismissed`).
- [x] Verified on the owner's phone with a simulated file (card, link,
      dismiss, switch on/off) and with the real `404`.
