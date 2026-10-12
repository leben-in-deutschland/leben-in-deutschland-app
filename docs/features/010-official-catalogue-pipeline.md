---
id: FEAT-010
title: Official Question Catalogue Pipeline From the BAMF PDF
status: Done
date: 2026-10-12
tags: [feature, data, questions, bamf, automation]
---

# FEAT-010: Official Question Catalogue Pipeline From the BAMF PDF

Decision: [`ADR-009`](../decisions/ADR-009-official-bamf-catalogue-source.md).
Plan: [`PLAN-013`](../plans/PLAN-013-official-catalogue-and-musterbogen.md).
Procedure: [`bamf-catalogue-sync`](../skills/bamf-catalogue-sync/SKILL.md).
Source facts: [`MEM-009`](../memory/bamf-catalogue-source.md).

## Problem

The app's questions come from a scraper that reads a third-party website.
Nobody checks them against the official BAMF catalogue, and the app would
not notice a new edition of the catalogue unless that website followed it.
The owner wants the official PDF to be the reference for what a question
says, with a cheap check that runs by itself, the safe part of a new
edition reaching learners automatically, and a human deciding only what
cannot be decided by text matching (owner instruction of 2026-10-12: "if
anything new then push to main so new data will be automatically shown").

## Behaviour

- **Check.** `node src/catalogue/check.mjs [--force]` reads the landing
  page of the catalogue on bamf.de with a plain `GET` and takes two hints
  from it: the `Datum` (page date) and the `v=` number of the PDF link
  (link version). It then asks for the PDF with a conditional `GET`
  carrying the stored `ETag` and `Last-Modified`. It prints the four
  signals next to the stored values and ends with `changed=true` or
  `changed=false`. A `304` with unchanged hints means nothing to download.
  A new file, or a new page date or link version even with a `304`, is
  downloaded to `src/catalogue/output/gesamtfragenkatalog.pdf`; the script
  reads the "Stand" date from the PDF title and the page count and rewrites
  `src/catalogue/state.json`. With `GITHUB_OUTPUT` set it appends
  `changed=` and `stand=`. It exits 0 whether or not something changed and
  1 only on an error: network failure, a firewall redirect, or a body that
  is not a PDF. It never sends `HEAD` and never prints or stores cookies.
- **Extract.** `node src/catalogue/extract.mjs [--pdf <path>]` turns the
  PDF into `src/catalogue/data/bamf-catalogue.json`: a `source` block
  (`stand`, `lastModified`, `etag`, `sha256`, `pages`, `extractedAt`),
  counts, and 460 questions, each `{num, part, state, stateCode, page,
  question, answers[4], images?, credit?}` with `num` like `"1"` for
  `Teil I` and `"BW-1"` for a state question. Pictures are written as PNG
  under `src/catalogue/output/images/` and a plain-text dump under
  `src/catalogue/output/`. The script checks 300 general + 160 state
  questions, 16 states x 10, four answers for every question, and 4 or 1
  pictures for every image question, and exits 1 when a check fails.
- **Compare.** `node src/catalogue/compare.mjs` matches the official
  questions against `src/web/data/question.json` by normalised text: exact
  first, then fuzzy, one-to-one, and only within the same scope (general
  with general, a state with the same state). Every official question ends
  up as identical, reworded, or new; every app question not matched is
  removed. It writes `src/catalogue/output/report.md` (counts, the
  numbering table official to app, the text differences, next steps) and
  `src/catalogue/output/question.proposed.json` in the shape of
  `question.json`: matched entries keep `num`, `id`, `solution`, `image`,
  `translation`, `context`, and `category` and receive the official
  question and answer texts; the solution letter is re-mapped by answer
  text, or the entry gets `needsReview: true`; new questions are appended
  with an empty solution and `needsReview: true`; removed questions are only
  listed in the report. The script never writes into `src/web/`.
- **Apply.** `node src/catalogue/apply.mjs [--dry-run]` writes the safe
  part of the proposal into `src/web/data/question.json`: a matched
  question whose correct answer text appears verbatim among the official
  answers takes the official stem, the official answer order, and the
  solution letter that follows the text; `num` and `id` never change, the
  translations' `a`–`d` move along, and the helper fields are stripped.
  Questions marked `needsReview`, new questions (no solution), and removed
  questions keep their app version and are listed in
  `src/catalogue/output/review.md` with the official text, the current app
  text, and the reason. The script refuses a question file with duplicate
  numbers, refuses to write one, refuses a proposal that changes `num` or
  `id`, and does nothing on a second run with the same proposal. With
  `GITHUB_OUTPUT` set it appends `applied=` and `heldBack=`.
- **Sync.** `node src/catalogue/sync.mjs [--force] [--apply]` runs the
  check and, only when something changed or `--force` is given, extract
  and compare, and with `--apply` the apply step (skipped when extraction
  reported problems).
- **What is committed.** `src/catalogue/state.json` (`landingUrl`,
  `pdfUrl`, `pageDate`, `version`, `lastModified`, `etag`, `sha256`,
  `bytes`, `pages`, `stand`, `downloadedAt`; no `checkedAt`, so an
  unchanged check changes no file),
  `src/catalogue/data/bamf-catalogue.json`, and `src/catalogue/README.md`.
  `src/catalogue/output/` is git-ignored.
- **Workflow.** `.github/workflows/sync-catalogue.yml` runs once a week and
  on manual dispatch (input `force`). It runs the check and stops when
  nothing changed. When something changed it extracts, compares, applies,
  uploads `report.md`, `review.md`, and the proposal as the artifact
  `catalogue-review`, and – when at least one question was applied – runs
  `node scripts/split-questions.js` and `npm test` in `src/web`; a red
  suite stops the run before anything is pushed. It then commits
  `state.json`, `data/`, `question.json`, `questions-core.json`, and
  `public/data/`. If app data changed it bumps the patch version and
  pushes to `main` with the `PAT` secret, which starts `vercel-deploy.yml`
  and `android-release.yml`; if only the bookkeeping changed it commits
  with `[skip ci]`. The committer comes from `GIT_USER_NAME` /
  `GIT_USER_EMAIL`, falling back to `github-actions[bot]`. Without the
  `PAT` the push still lands (with `GITHUB_TOKEN`) but the step warns that
  no deploy starts. When questions were held back it opens one GitHub
  issue per `Stand` with `review.md` as the body (not duplicated while an
  issue for the same `Stand` is open).
- **Dependency.** The only dependency is `pdfjs-dist`, a devDependency of
  `src/web/package.json`, loaded from `src/web/node_modules`. The app
  itself makes no request to bamf.de and ships nothing from this folder.

## Out of Scope

- Renumbering questions or migrating learner progress; the app keeps its
  `num` values.
- Applying held-back questions; the owner decides them by hand in
  `src/web/data/question.json` and runs
  `cd src/web && node scripts/split-questions.js && npm test`.
- Producing solutions, translations, or explanations for new questions;
  the PDF has no answer key.
- Publishing the extracted pictures in the app (credits; ADR-009
  follow-up).
- Retiring the scraper workflow.

## Acceptance

- [x] `check.mjs` prints page date, link version, `Last-Modified`, and
      `ETag` next to the stored values, ends with `changed=true|false`,
      exits 0 in both cases, and leaves `state.json` untouched when nothing
      changed; a changed page date or link version with a `304` still
      downloads; errors exit 1 with a clear message; no `HEAD`, no cookies.
- [x] `extract.mjs` yields 460 questions (300 + 160, 16 x 10), four answers
      each, 4 or 1 images per picture question, PNGs under `output/images/`,
      and exits 1 on any failed check.
- [x] `compare.mjs` writes `output/report.md` and
      `output/question.proposed.json`, keeps the listed fields for matched
      entries, marks unmatched solutions and new questions with
      `needsReview: true`, lists removed questions, and changes nothing under
      `src/web/`.
- [x] `sync.mjs` skips extract and compare when the check reports no change
      and runs them with `--force`; `--apply` adds the apply step.
- [x] `apply.mjs` applies only safe entries, keeps `num` and `id`, holds
      back `needsReview`, new, and removed questions into `review.md`,
      refuses duplicate numbers (checked against the corrupted file from
      commit `227846e`), and is idempotent; after
      `split-questions.js` the web test suite passes (1291 tests).
- [ ] The workflow validates, runs weekly and by hand, applies the safe
      part, runs the tests, pushes to `main` with the `PAT`, and opens an
      issue for held-back questions (YAML validated and the commit logic
      rehearsed in a scratch clone; the first live run is still to come).
- [x] `state.json`, `bamf-catalogue.json`, the report, and the workflow logs
      contain no identifiers, cookies, or credentials.
- [x] `src/catalogue/README.md` documents the scripts, the state file, and
      the owner steps.
