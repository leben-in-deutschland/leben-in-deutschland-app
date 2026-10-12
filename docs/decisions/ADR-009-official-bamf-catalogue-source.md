---
id: ADR-009
title: Take Question Texts From the Official BAMF Catalogue PDF, Apply the Safe Part Automatically
status: Accepted
date: 2026-10-12
updated: 2026-10-12
areas: [data, web, automation]
tags: [adr, data, questions, bamf, automation, privacy]
---

# ADR-009: Take Question Texts From the Official BAMF Catalogue PDF, Apply the Safe Part Automatically

> **Amendment (2026-10-12, same day):** the owner asked that a new
> catalogue reaches learners without waiting for a pull request review
> ("if anything new then push to main so new data will be automatically
> shown"). The review gate now applies only to questions whose solution
> cannot be carried over by an exact answer-text match; everything else is
> applied and pushed to `main` by the workflow. See *Decision* and
> *Amendment* below.

## Context

Today every question in the app comes from a separate scraper repository
(`leben-in-deutschland/leben-in-deutschland-scrapper`). That scraper reads
a third-party website, not the official source: the question images even
point at a third-party domain, and the translations and explanations come
from Microsoft Translator and an AI model. The `Sync Questions` workflow
downloads the scraper's `question.json`, splits it
(`src/web/scripts/split-questions.js`), and commits it to `main`, which in
turn builds a release and a deployment.

The owner does not want the app to depend on another website and asked for
a skill that goes to the official source instead: the BAMF
"Gesamtfragenkatalog zum Test 'Leben in Deutschland' und zum
'Einbürgerungstest'" PDF.

Facts found while scoping (2026-10-12):

- The landing page
  `https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.pdf`
  is HTML. It shows `Datum: 26.05.2025`, `Format: Katalog`, the sentence
  "Insgesamt ... 300 bundesweiten und 160 bundeslandspezifischen Fragen",
  and the link to the file with `?__blob=publicationFile&v=23`; `v` is
  BAMF's own version counter.
- The PDF (same URL with `?__blob=publicationFile`) is 8.97 MB and 191
  pages; its title ends in `Stand: 07.05.2025`; the server sends
  `Last-Modified: Wed, 03 Sep 2025 11:46:29 GMT` and an `ETag`.
- bamf.de is behind an Airlock web application firewall. `HEAD` is
  rejected (a `303` to an error page). `GET` works, and a conditional `GET`
  with `If-None-Match` / `If-Modified-Since` answers `304` with no body. So
  "read the last-updated date" means: `GET` the landing page for `Datum`
  and the link version, and a conditional `GET` of the PDF for
  `Last-Modified` / `ETag`.
- The PDF has `Teil I` (Aufgabe 1-300) and sixteen times
  `Teil II - Fragen für das Bundesland <Name>` (Aufgabe 1-10 each). Every
  question has exactly four answers, each marked with a checkbox glyph.
  About 43 questions use pictures ("Bild 1-4", or one picture, map, or
  ballot).
- **The PDF contains no answer key.**
- The PDF's numbering does not match the app's: only 4 of the 300 general
  questions share a number. The app keys learner progress by `num`
  (ADR-006), so renumbering would cut learners off from their history.
- About 384 of the 460 question stems match the app's current texts
  exactly; the rest differ in wording.

## Options Considered

### Option 1: Keep the scraper as the only source

- Pros: nothing to build; translations, explanations, and solutions keep
  arriving.
- Cons: the app's content depends on a third-party website that can change
  or vanish; images are hot-linked from that domain; nobody checks the
  texts against the official catalogue.

### Option 2: Replace the scraper with the PDF pipeline right away

- Pros: one source, the official one.
- Cons: the PDF has no answer key and no translations or explanations, so
  the app would lose solutions for new or reworded questions and every
  translation; the numbering mismatch would reset learner progress; nobody
  would review the change before it ships.

### Option 3: Add the official PDF pipeline as the source of truth for question texts, behind a review gate (chosen)

- Pros: the official text wins where it differs; everything the PDF cannot
  give (solutions, translations, explanations) is carried over from the
  current data by matching answer texts, or marked for a human; nothing
  reaches the app without the owner; the check is cheap (one `304` a week)
  and needs no credentials.
- Cons: two sources for a while; the owner reviews a report; a reworded
  question whose answers also changed needs a human to confirm the
  solution.

### Option 4: A hosted PDF or AI extraction service

- Pros: less parsing code.
- Cons: sends a public file to a vendor for no gain, adds an account and
  a key, and makes the result less reproducible. Rejected; `pdfjs-dist`
  reads the PDF locally and deterministically.

## Decision

Option 3. Concretely, a small pipeline in plain Node 22 ESM scripts under
`src/catalogue/`, whose only dependency is `pdfjs-dist` (a devDependency of
`src/web/package.json`, loaded from `src/web/node_modules` the way
`src/store` borrows `sharp`):

- `node src/catalogue/check.mjs [--force]` - `GET` the landing page and
  parse `Datum` (`pageDate`) and the `v=` number (`version`); conditional
  `GET` of the PDF with the stored `etag` and `lastModified`; print each of
  the four signals next to the stored value and end with
  `changed=true|false`. On a new file it writes
  `src/catalogue/output/gesamtfragenkatalog.pdf`, reads the PDF title for
  `stand` and the page count, and rewrites `src/catalogue/state.json`. A
  changed page date or link version with a `304` counts as changed and
  forces the download. With `GITHUB_OUTPUT` set it appends `changed=` and
  `stand=`. Exit 0 either way; exit 1 only on errors (network, firewall
  redirect, non-PDF body). Cookies are never printed or stored.
- `node src/catalogue/extract.mjs [--pdf <path>]` - PDF to
  `src/catalogue/data/bamf-catalogue.json`: a `source` block (`stand`,
  `lastModified`, `etag`, `sha256`, `pages`, `extractedAt`), counts, and 460
  questions `{num ("1"... or "BW-1"...), part, state, stateCode, page,
  question, answers[4], images?, credit?}`; pictures as PNG under
  `src/catalogue/output/images/`; a text dump under `output/`. It validates
  300 + 160, 16 x 10, four answers each, 4 or 1 images, and exits 1 when a
  check fails.
- `node src/catalogue/compare.mjs` - compares with
  `src/web/data/question.json` by normalised text (exact first, then fuzzy,
  one-to-one, within the same state scope) into identical / reworded / new /
  removed. Writes `src/catalogue/output/report.md` (counts, numbering table
  official to app, diffs, next steps) and
  `src/catalogue/output/question.proposed.json` with the schema of
  `question.json`: matched entries keep `num`, `id`, `solution`, `image`,
  `translation`, `context`, `category` and get the official texts; the
  solution letter is re-mapped by answer text or the entry gets
  `needsReview: true`; new questions are appended with an empty solution
  and `needsReview: true`; removed ones are only listed. It never writes
  into `src/web/`.
- `node src/catalogue/apply.mjs [--dry-run]` - writes the safe part of the
  proposal into `src/web/data/question.json`: matched entries whose
  solution follows an exact answer-text match take the official stem,
  answers (official order), and solution letter; `num` and `id` never
  change; helper fields are stripped. Entries with `needsReview`, new
  questions (no solution), and removed questions are held back and listed
  in `src/catalogue/output/review.md`. It refuses to run on a question file
  with duplicate numbers and refuses to write one. Afterwards
  `src/web/scripts/split-questions.js` regenerates `questions-core.json`
  and `public/data/`.
- `node src/catalogue/sync.mjs [--force] [--apply]` - check, then (if
  changed or forced) extract and compare, and with `--apply` apply.
- Committed: `src/catalogue/state.json` (`landingUrl`, `pdfUrl`,
  `pageDate`, `version`, `lastModified`, `etag`, `sha256`, `bytes`,
  `pages`, `stand`, `downloadedAt`; no `checkedAt`, so an unchanged check
  creates no commit
  noise), `src/catalogue/data/bamf-catalogue.json`, and
  `src/catalogue/README.md`. Git-ignored: `src/catalogue/output/`.
- `.github/workflows/sync-catalogue.yml` - weekly schedule plus manual
  dispatch (input `force`). It runs the check and, only when something
  changed, extracts, compares, applies, uploads `report.md`, `review.md`,
  and the proposal as the artifact `catalogue-review`, regenerates the
  split data and runs `npm test` when something was applied (red tests
  stop the run; nothing is pushed), then commits `state.json`, `data/`,
  and the app data. App-data changes bump the patch version and are pushed
  to `main` with the `PAT` secret so that `vercel-deploy.yml` and
  `android-release.yml` start (pushes made with `GITHUB_TOKEN` never
  trigger workflows); bookkeeping-only changes are committed with
  `[skip ci]`. Held-back questions become one GitHub issue per `Stand`
  with `review.md` as the body.
- The procedure for agents is the project skill
  `docs/skills/bamf-catalogue-sync/SKILL.md`.
- `src/web/data/question.json` stays the single source of the shipped
  data and keeps supplying translations, explanations, and the solutions
  of held-back questions. The scraper sync (`sync-question.yml`) stays
  manual-only and is retired in practice: its output currently carries
  duplicate numbers.

### Amendment: automatic application (2026-10-12)

The first version of this decision opened a pull request and never touched
`src/web/`. The owner then asked for new data to be shown automatically.
The pipeline therefore splits every new catalogue in two:

- **Safe** - a matched question whose correct answer text appears verbatim
  among the official answers. Adopting the official stem, answer order, and
  the letter that follows the answer text cannot change which answer is
  correct, so these are applied, tested, pushed, and released without a
  person.
- **Held back** - approximate or eliminated solution matches, unmapped
  letters, new questions (no answer key), removed questions. These keep
  their app version and are listed in a GitHub issue for the owner.

The release still has two gates: `npm test` in the workflow and the
duplicate-number check in `apply.mjs`. The first run of the pipeline on
the repaired data aligned 346 of 460 questions (240 answer orders, 303
solution letters, 106 answer texts, 35 stems) and held back 54.

**Data repair that made this possible.** The committed `question.json` had
68 duplicate numbers: the scraper commit `227846e` ("Sync questions &
bump version", authored 2025-12-26) landed on `main` after the Next.js 16
upgrade `ed7efbe` and overwrote the file, while the generated
`questions-core.json` and `public/data/` (created in `ed7efbe`) stayed
correct. The file was restored from `ed7efbe`, whose `split-questions.js`
output equals the shipped files byte for byte; only then were the official
texts applied. Renumbering to the official order was rejected again:
learner progress, review schedules, explanations, and translations are all
keyed by `num`.

## Consequences

### Positive

- The official catalogue, not a third-party website, is the reference for
  what a question says; a weekly check notices a new edition within days.
- No credentials, no new runtime request from the app, no vendor; the
  weekly cost of an unchanged catalogue is two `GET`s and a `304`.
- A new edition reaches learners within a week without a person in the
  loop for the safe part; the risky part arrives as a readable GitHub issue.
- Every workflow commit carries the full comparison as an artifact and a
  `catalogue:` commit message, so a bad alignment is one revert away.

### Negative

- There is no answer key, so solutions are carried over only by matching
  answer texts; everything else is a human decision (`needsReview`) and
  can lag behind the official text until the issue is worked off.
- A direct push to `main` relies on the `PAT`, `GIT_USER_NAME`, and
  `GIT_USER_EMAIL` secrets; without the PAT the data lands but is not
  released until a deploy workflow is started by hand.
- Automatically adopted official wording can disagree with a stored
  explanation (`context`) that quotes the old wording; no explanation
  references an answer letter, so reordering is safe, but phrasing can
  drift.
- The numbering mismatch means the app keeps its own `num` values;
  renumbering, and any progress migration it needs, is deferred.
- The pictures from the PDF are extracted into a git-ignored folder only;
  publishing them in the app is a separate decision because they carry
  credits such as "© Deutscher Bundestag/Achim Melde".
- Dependabot alerts on `src/web/package-lock.json` now also cover
  `pdfjs-dist`.
- Two data sources coexist until the owner decides how translations and
  explanations are produced for official texts.

## Follow-Up

- [ ] Owner: keep the `PAT` secret valid (a token allowed to push to
      `main`) so a catalogue push starts the deploy workflows.
- [ ] Owner: work off the first held-back list (54 questions) from the
      GitHub issue the first live run opens, or from
      `src/catalogue/output/review.md` after `node src/catalogue/apply.mjs`.
- [ ] Owner: decide whether and how the app follows the official numbering
      (needs a progress migration keyed by `num`).
- [ ] Owner: decide whether the PDF pictures replace the third-party image
      links, including how credits are shown.
- [ ] Later: wire translations and explanations for official texts into the
      flow, so a new question can ship without the scraper.
- [x] Control-plane records: [`PLAN-013`](../plans/PLAN-013-official-catalogue-and-musterbogen.md),
      [`FEAT-010`](../features/010-official-catalogue-pipeline.md),
      [`MEM-009`](../memory/bamf-catalogue-source.md), context and
      architecture updated.
