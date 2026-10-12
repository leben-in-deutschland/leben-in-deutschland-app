---
id: PLAN-013
title: Official BAMF Catalogue Pipeline and a Mock Exam Shaped Like the Official Test Sheet
status: Done
date: 2026-10-12
tags: [plan, data, questions, bamf, automation, mock, web, android]
---

# PLAN-013: Official BAMF Catalogue Pipeline and a Mock Exam Shaped Like the Official Test Sheet

Decision: [`ADR-009`](../decisions/ADR-009-official-bamf-catalogue-source.md).
Specs: [`FEAT-009`](../features/009-mock-exam-official-sheet.md),
[`FEAT-010`](../features/010-official-catalogue-pipeline.md).
Skill: [`bamf-catalogue-sync`](../skills/bamf-catalogue-sync/SKILL.md).
Memory: [`MEM-009`](../memory/bamf-catalogue-source.md).

## Goal

Two things, one branch:

1. The app can learn about a new edition of the official BAMF question
   catalogue from the official PDF instead of a third-party website: a
   check that costs almost nothing while nothing changed, an extraction of
   all 460 questions when it did, a comparison with the app's questions, and
   a pull request with a report for the owner. Nothing is written into the
   app's data without the owner.
2. The mock exam looks and behaves like the official sample test sheet
   (Musterfragebogen): a cover and instruction page before the clock starts,
   "Frage 1" to "Frage 33" with checkbox marks, the state questions mixed
   in, and links to the two official sample sheets.

## Context

- Today's question source is the scraper repository
  (`leben-in-deutschland/leben-in-deutschland-scrapper`), pulled by
  `.github/workflows/sync-question.yml` and split by
  `src/web/scripts/split-questions.js` into `questions-core.json`, context,
  and translation files. The app keys learner progress by question number
  (`num`, ADR-006).
- The official source and its quirks are recorded in ADR-009 and MEM-009:
  landing page with `Datum` and a `v=` link version, PDF with a "Stand" in
  its title, a firewall that rejects `HEAD` but answers conditional `GET`
  with `304`, no answer key, a numbering that differs from the app's, and
  about 384 of 460 question stems already identical.
- The official sample sheets
  (`musterbogen_einbuergerungstest.html` and
  `musterbogen_lebenindeutschland.html` under
  `https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/`)
  are 14-15-page PDFs: a cover ("Testfragebogen", exam and sheet numbers,
  Bundesland, date), an "Anleitung" page (33 questions, four options,
  exactly one correct, cross the box in front of the answer, 60 minutes,
  examples of marking and correcting), "Frage 1"-"Frage 33" with checkboxes
  and no letters, the 3 state questions mixed among the 30 general ones,
  and a signature page.
- The mock exam today: `src/web/components/mock/` (`mock-intro.tsx`,
  `mock-exam.tsx`, `mock-results.tsx`, `exam-logic.ts`), 30 general plus 3
  state questions (`EXAM_GENERAL_COUNT`, `EXAM_STATE_COUNT`), 60 minutes
  (`EXAM_DURATION_SECONDS`), pass marks 17 (Einbürgerungstest) and 15
  (Leben in Deutschland) in `utils/user-defaults.ts`; `pickExamQuestions`
  puts the state questions last; answers show A-D letters and keys 1-4 or
  a-d pick them.
- Any push to `main` builds a release (`android-release.yml`) and deploys
  (`vercel-deploy.yml`), so the new workflow must open a pull request
  instead.
- `pdfjs-dist` is the single new dependency, added as a devDependency of
  `src/web/package.json`; the scripts load it from `src/web/node_modules`
  like `src/store` loads `sharp`.
- The repository is public: no identifiers in state files, reports,
  workflow logs, or docs (MEM-008).

## Steps

### Part A: catalogue pipeline and skill

- [x] `src/catalogue/check.mjs`: `GET` landing page (parse `Datum`, `v=`),
      conditional `GET` of the PDF (`If-None-Match`, `If-Modified-Since`),
      print the four signals next to the stored values, `changed=true|false`,
      download on change (also when page date or version changed with a
      `304`), read `stand` and page count from the PDF, rewrite
      `state.json`; `GITHUB_OUTPUT` support; exit 1 only on errors; no
      cookies stored or printed.
- [x] `src/catalogue/extract.mjs`: PDF to `data/bamf-catalogue.json`
      (source block, counts, 460 questions with `num`, `part`, `state`,
      `stateCode`, `page`, `question`, `answers[4]`, `images?`, `credit?`),
      PNG images and a text dump under `output/`; validation 300 + 160,
      16 x 10, four answers each, images 4 or 1; exit 1 on failure.
- [x] `src/catalogue/compare.mjs`: match against `src/web/data/question.json`
      by normalised text (exact, then fuzzy, one-to-one, same state scope);
      `output/report.md` and `output/question.proposed.json` as specified in
      ADR-009; never writes into `src/web/`.
- [x] `src/catalogue/sync.mjs [--force]`: check, then extract and compare
      when changed or forced.
- [x] Committed files: `src/catalogue/state.json`,
      `src/catalogue/data/bamf-catalogue.json`, `src/catalogue/README.md`;
      `src/catalogue/output/` git-ignored.
- [x] `.github/workflows/sync-catalogue.yml`: weekly schedule and manual
      dispatch with input `force`; check, and only when changed: extract,
      compare, upload the report as an artifact, commit `state.json` and
      `data/` to `catalogue/bamf-<stand>-<run id>`, open a pull request with
      the report as body using `GITHUB_TOKEN`; never a push to `main`.
- [x] Skill `docs/skills/bamf-catalogue-sync/SKILL.md`, registered in
      `docs/skills/README.md` and routed from `AGENTS.md`.

### Part B: mock exam after the Musterfragebogen

- [x] Intro: a section with the two official sample-sheet links that open
      bamf.de in a new tab (and in the system browser inside the Android
      app).
- [x] Cover and instruction screen after "Start": title by test type,
      "Testfragebogen", Bundesland, 33 questions, 60 minutes or timer off,
      pass mark, date, instructions in the app's own words, the example
      "Wie viele Tage hat die Woche?" with 7 marked, the note that a tap
      moves the cross; the clock starts only on "Begin test".
- [x] Running exam: "Frage N" headings without catalogue number or topic
      chips, checkbox markers instead of A-D letters (keys 1-4 still pick an
      answer), the test type name in the header, the 3 state questions mixed
      in among the 30 general ones.
- [x] Results, review, and practice unchanged; the classic design untouched.
- [x] Translations in German and English for every new text.
- [x] Tests: cover screen and clock start, `Frage N` headings, mixed order
      with a seeded random, links present, keyboard shortcuts.

### Part C: control plane

- [x] ADR-009, PLAN-013, FEAT-009, FEAT-010, MEM-009; `docs/context/`,
      `docs/architecture/overview.md`, the index READMEs, `AGENTS.md`
      routing row.
- [x] Usage-log row (`docs/usage/usage-log.md`).

## Rollback Plan

- **Baseline:** branch `feat/bamf-catalogue-musterbogen` created from
  `622970e` on `main` with a clean tree; `src/web/package.json` and
  `package-lock.json` without `pdfjs-dist`; no `src/catalogue/`, no
  `sync-catalogue.yml`; the mock exam as described under Context.
- **Trigger:** `cd src/web && npm run lint`, `npm test`, or `npm run build`
  failing; `extract.mjs` reporting anything other than 460 questions
  (300 + 160, 16 x 10, four answers each); the workflow file failing
  validation or pushing to `main`; a personal identifier, cookie, or
  credential in a committed file, report, or log; the pipeline writing
  under `src/web/`.
- **Reversal:** before merge, delete the branch; after merge,
  `git revert` the merge commit on `main` (one authorized revert, no
  history rewrite). Inside the branch, narrow steps: `git restore` the
  touched files under `src/web/components/mock/`, `src/web/__tests__/`, and
  the translation files; delete `src/catalogue/` and
  `.github/workflows/sync-catalogue.yml`; `cd src/web && npm uninstall
  pdfjs-dist` restores `package.json` and the lockfile; delete the new docs
  and restore the edited ones (`AGENTS.md`, `docs/skills/README.md`,
  `docs/context/`, `docs/architecture/overview.md`, the index READMEs).
- **State safety:** the pipeline never writes `src/web/data/`;
  `src/catalogue/output/` is git-ignored; no secret, no credential, no
  storage key, no schema change, no deployment, no Android native change;
  the only external artefacts a workflow run can leave are a branch and a
  pull request, which can be closed and deleted; bamf.de only receives
  `GET` requests.
- **Recovery verification:** on `main`, `cd src/web && npm run lint && npm
  test && npm run build` green; `git ls-files src/catalogue` empty;
  `grep pdfjs-dist src/web/package.json` empty; the mock exam starts its
  clock on "Start" again with A-D letters and the state questions last;
  `git status` shows no unrelated change.

## Acceptance Criteria

- [x] `node src/catalogue/check.mjs` prints page date, link version,
      `Last-Modified`, and `ETag` next to the stored values and ends with
      `changed=true|false`; an unchanged catalogue leaves `state.json`
      untouched; it never sends `HEAD` and never stores a cookie.
- [x] `node src/catalogue/extract.mjs` produces exactly 460 questions
      (300 general, 160 state, 16 states x 10), four answers each, 4 or 1
      images for picture questions, and fails loudly otherwise.
- [x] `node src/catalogue/compare.mjs` writes `output/report.md` and
      `output/question.proposed.json` without touching `src/web/`;
      matched entries keep `num`, `id`, `solution`, `image`, `translation`,
      `context`, `category`; unmatched solutions and new questions carry
      `needsReview: true`.
- [ ] The workflow opens a pull request from `catalogue/bamf-<stand>-<run id>`
      with the report and never pushes to `main`; an unchanged check
      creates no commit (YAML validated and the scripts run locally; the
      pull-request step runs for the first time when BAMF publishes a
      change or the owner dispatches it with `force`).
- [x] Committed files, report, and logs contain no identifiers, cookies, or
      credentials.
- [x] Mock exam: the sample-sheet links open bamf.de; "Start" shows the
      cover and the clock starts only on "Begin test"; questions read
      "Frage N" with checkbox markers; keys 1-4 still work; the 3 state
      questions are mixed in; results, review, and practice behave as
      before; the classic design is unchanged.
- [x] Relevant control-plane files are updated and the usage-log row exists.
- [x] `cd src/web && npm run lint && npm test && npm run build` pass.

## Verification

```bash
cd src/web && npm run lint && npm test && npm run build
node src/catalogue/sync.mjs --force
node src/catalogue/check.mjs
```

Manual: read `src/catalogue/output/report.md` after the forced run (counts,
numbering table, `needsReview` entries); in the web export, open the mock
exam, follow one sample-sheet link, start an exam, confirm the cover, press
"Begin test", confirm "Frage 1" with checkboxes and that the clock only now
runs; on Android (`cd src && make build-sync`), confirm the links open the
system browser.

## Evidence

Coordinator run on 2026-10-12, branch `feat/bamf-catalogue-musterbogen`:

- `cd src/web && npm run lint && npm test && npm run build`: lint clean,
  62 test files / 1291 tests passed, static export built.
- `node src/catalogue/check.mjs`: landing page `Datum` 26.05.2025, link
  `v=23`, conditional GET answered `304 Not Modified`, `changed=false`,
  `state.json` unchanged. One run saw a `200` without `ETag` /
  `Last-Modified`; `check.mjs` now keeps the stored validators when the
  bytes are identical (reproduced with a loader hook, `state.json` stayed
  unchanged).
- `node src/catalogue/extract.mjs`: 460 questions (300 general + 160
  state), 4 answers each, 43 picture questions (19 x 4, 24 x 1), 100 PNGs,
  logo skipped on 191/191 pages; a second run produced byte-identical JSON
  apart from `extractedAt`.
- `node src/catalogue/compare.mjs`: 350 identical, 110 reworded (52 fuzzy),
  0 new, 0 removed; solutions 103 kept / 304 moved / 53 approximate /
  0 unmapped; 53 proposal entries `needsReview`; only 35 of 460 share the
  official number. Report and proposal written under
  `src/catalogue/output/`, nothing under `src/web/` changed.
- Privacy scan of every changed and new file: no home paths, cookies,
  e-mail addresses, or identifiers.

Open: the Android system-browser check for the sample-sheet links and the
first live run of `sync-catalogue.yml` (needs "Allow GitHub Actions to
create and approve pull requests").
