---
id: FEAT-005
title: Daily Refresh of the Question Catalogue on Android
status: Done
date: 2026-10-10
tags: [feature, android, data, questions]
---

# FEAT-005: Daily Refresh of the Question Catalogue on Android

Decision: [`ADR-006`](../decisions/ADR-006-remote-content.md).
Plan: [`PLAN-008`](../plans/PLAN-008-remote-content.md).

## Problem

BAMF changes the official question catalogue a few times a year. The sync
workflow commits the new `questions-core.json` to the app repository and
the website rebuilds, but Android users keep the old catalogue until they
install a new Play version, which the owner uploads by hand.

## Behaviour

- Once a day the Android app asks
  `raw.githubusercontent.com/.../main/src/web/data/questions-core.json`
  for the catalogue with `If-None-Match`. While nothing changed the answer
  is a `304` with no body. The web build never does this.
- A downloaded catalogue is kept only when it passes a strict check: an
  array of 300 to 1000 well-formed questions (number `1..999` or `XX-n`,
  text, four answers, solution letter, image field), unique numbers, at
  least 300 general questions, and at least three questions for every state
  in `states.json`. A download identical to the bundle is stored as "same as
  bundled" with its ETag, so no duplicate 160 KB sits in storage.
- The cache under `lid:questions` is stamped with the app version that
  fetched it. A newer app build ignores an older download until it has
  fetched again, so a release can never be shadowed by stale data.
- The catalogue is swapped at the next catalogue load, which is the next
  page load on Android (each screen is its own `.html`); a running practice
  or mock session is never changed underneath the learner.
- Progress is keyed by question number, so answered history, flags, review
  schedule, and mock results stay valid. A question whose text or answers
  changed shows no bundled explanation or translation (they would describe
  the old wording); the practice screen shows its usual "none yet" text.
- Offline or blocked phones keep the bundled or last downloaded catalogue
  and retry after an hour. Nothing in this feature writes the learner record.

## Out of Scope

- Refreshing explanations and translations (bundled per language, several
  MB); they follow with the next release.
- Refreshing the test-centre list (web-only pages, ADR-006).
- Migrating or rewriting progress when BAMF renumbers questions.

## Acceptance

- [x] The bundled catalogue passes the check; truncated, malformed,
      duplicate-number, missing-state, or bad-solution files are refused.
- [x] A valid download from this app version is used at the next catalogue
      load; other versions and invalid caches fall back to the bundle.
- [x] A changed question shows its new text and no stale explanation or
      translation; unchanged questions keep theirs.
- [x] An unchanged file costs one `304` per day and stores nothing.
- [x] Learner record byte-identical before and after on the owner's phone.
