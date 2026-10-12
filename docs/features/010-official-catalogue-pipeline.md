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
says, with a cheap check that runs by itself and a human deciding what
reaches the app.

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
- **Sync.** `node src/catalogue/sync.mjs [--force]` runs the check and,
  only when something changed or `--force` is given, extract and compare.
- **What is committed.** `src/catalogue/state.json` (`landingUrl`,
  `pdfUrl`, `pageDate`, `version`, `lastModified`, `etag`, `sha256`,
  `bytes`, `pages`, `stand`, `downloadedAt`; no `checkedAt`, so an
  unchanged check changes no file),
  `src/catalogue/data/bamf-catalogue.json`, and `src/catalogue/README.md`.
  `src/catalogue/output/` is git-ignored.
- **Workflow.** `.github/workflows/sync-catalogue.yml` runs once a week and
  on manual dispatch (input `force`). It runs the check and stops when
  nothing changed. When something changed it extracts, compares, uploads
  the report as an artifact, commits `state.json` and `data/` to a branch
  `catalogue/bamf-<stand>-<run id>`, and opens a pull request whose body is
  the report, using the plain `GITHUB_TOKEN`. It never pushes to `main`
  (every push to `main` builds a release and deploys). The owner enables
  "Allow GitHub Actions to create and approve pull requests" once.
- **Dependency.** The only dependency is `pdfjs-dist`, a devDependency of
  `src/web/package.json`, loaded from `src/web/node_modules`. The app
  itself makes no request to bamf.de and ships nothing from this folder.

## Out of Scope

- Writing `src/web/data/question.json`, renumbering questions, or migrating
  learner progress; the owner merges approved entries by hand and runs
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
      and runs them with `--force`.
- [ ] The workflow validates, runs weekly and by hand, opens a pull request
      from `catalogue/bamf-<stand>-<run id>` with the report, and never
      pushes to `main` (YAML validated; the first live run is still to come).
- [x] `state.json`, `bamf-catalogue.json`, the report, and the workflow logs
      contain no identifiers, cookies, or credentials.
- [x] `src/catalogue/README.md` documents the scripts, the state file, and
      the owner steps.
