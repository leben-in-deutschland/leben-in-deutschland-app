---
name: bamf-catalogue-sync
description: Keep the app's questions in step with the official BAMF "Gesamtfragenkatalog" PDF for the Leben in Deutschland and Einbürgerungstest - read the last-updated signals on bamf.de, download the PDF only when it changed, extract all 460 questions with answers and pictures, compare them with the app's question file, and hand the owner a report plus a reviewed proposal; read-only public GETs, no credentials, never writes src/web/data/question.json. Use when asked to check whether BAMF updated the question catalogue, download the PDF if it changed, extract all questions, compare with the app's questions, or review the catalogue report or proposal.
---

# BAMF Catalogue Sync

Ask the official source, not a third-party website. The scripts under
`src/catalogue/` read the public catalogue PDF from bamf.de, turn it into
JSON, and compare it with the app's `question.json`. They only ever write a
report and a proposal; a human decides what reaches the app. The rules are
decided in ADR-009.

## Boundary

- **Read-only, public, no credentials.** The scripts send plain `GET`
  requests to `bamf.de` and nothing else. There is no login, token, key, or
  secret anywhere in this procedure; never ask for one.
- **Never `HEAD`.** bamf.de sits behind a web application firewall that
  answers `HEAD` with a redirect to an error page. Checking for a new file
  means a conditional `GET` with `If-None-Match` and `If-Modified-Since`; a
  `304` is the normal "nothing new" answer and has no body.
- **Never store or print cookies.** The firewall may set cookies; the
  scripts drop them, and `state.json` holds only the public file facts
  (page date, link version, `Last-Modified`, `ETag`, checksum, size, page
  count, "Stand").
- **Never write `src/web/data/question.json`** and never renumber. The
  pipeline writes under `src/catalogue/` only. Learner progress is keyed by
  the question number (`num`), and the official numbering does not match the
  app's, so renumbering is an owner decision, not a script step.
- **The PDF has no answer key.** A solution is carried over only when the
  answer texts match an existing question; otherwise the entry is marked
  `needsReview: true` with an empty solution. Never invent, guess, or
  "research" a correct answer.
- **The proposal is reviewed by the owner.** The output of this skill is
  `src/catalogue/output/report.md` and
  `src/catalogue/output/question.proposed.json`; both are suggestions.
- **Public repository.** The committed state and the report contain no
  machine names, home paths, e-mail addresses, or other identifiers; Actions
  logs are public too (`docs/memory/public-repository-privacy.md`).
- **Images carry credits.** Pictures extracted from the PDF stay in the
  git-ignored `src/catalogue/output/images/`. Publishing them in the app is
  a separate decision (ADR-009 follow-up).

## Procedure

1. Print the sandbox line, then read `src/catalogue/README.md`, ADR-009,
   and MEM-009 (`docs/memory/bamf-catalogue-source.md`). Note the current
   SHA and `git status` as the rollback baseline.
2. Preconditions (no network yet):
   - `node --version` is 22 or newer.
   - `src/web/node_modules` exists and contains `pdfjs-dist`
     (`test -d src/web/node_modules/pdfjs-dist`). If not,
     `cd src/web && npm install`. It is the pipeline's only dependency, a
     devDependency of `src/web/package.json`, loaded from there the same way
     `src/store` borrows `sharp`.
3. Check the official source:

   ```bash
   node src/catalogue/check.mjs
   ```

   Read the four signals it prints next to the stored values: the landing
   page's `Datum` (page date), the `v=` number of the PDF link (link
   version), and the PDF's `Last-Modified` and `ETag`. The last line is
   `changed=true` or `changed=false`.
   - `changed=false`: stop here. Report the stored `stand` (the "Stand"
     date from the PDF title), the page date, and `Last-Modified`. Nothing
     was downloaded; `state.json` is unchanged.
   - `changed=true`: the script already saved the new PDF to
     `src/catalogue/output/gesamtfragenkatalog.pdf` and rewrote
     `src/catalogue/state.json`. Continue with step 4. A new page date or
     link version counts as changed even when the PDF answered `304`; the
     script then downloads the file anyway.
   - Exit code 1 means an error (network, firewall redirect, a body that
     is not a PDF). Report it as it is. Do not retry in a loop, do not try
     `HEAD`, do not fetch through another site.
   - `--force` downloads regardless of the signals; use it only when the
     owner asks for a fresh extraction.
4. Extract the questions (only after a change or `--force`):

   ```bash
   node src/catalogue/extract.mjs
   ```

   Check the counts in the output: 460 questions = 300 general
   (`Teil I`) + 160 state (`Teil II`, 16 states x 10), four answers for
   every question, and 4 or 1 picture for every image question. Exit code 1
   means the PDF layout changed and the parser needs work; stop and report.
   Never hand-edit `src/catalogue/data/bamf-catalogue.json`.
5. Compare with the app:

   ```bash
   node src/catalogue/compare.mjs
   ```

   Read `src/catalogue/output/report.md`. Summarise for the owner: how many
   questions are identical, reworded, new, and removed; the numbering table
   (official number to app number) and the caveat that the two numberings
   differ; which proposal entries carry `needsReview: true` and why (new
   question without solution, or a reworded question whose solution could
   not be matched by answer text).
   `node src/catalogue/sync.mjs [--force]` runs steps 3 to 5 in one go and
   skips 4 and 5 when nothing changed.
6. Hand the proposal to the owner: `src/catalogue/output/question.proposed.json`
   has the same shape as `src/web/data/question.json`. Matched questions keep
   their `num`, `id`, `solution`, `image`, `translation`, `context`, and
   `category` and receive the official texts; new questions are appended with
   an empty solution; removed questions are only listed in the report.
7. Only when the owner explicitly asks to take the texts over: copy the
   approved entries into `src/web/data/question.json` (never the whole
   proposal blindly, never a `needsReview` entry without its solution), then

   ```bash
   cd src/web && node scripts/split-questions.js && npm test
   ```

   and let the owner review the diff. A new question still needs its
   solution, translations, and explanation from a human before it can ship.
8. Without a laptop: Actions → **Sync Catalogue** → *Run workflow*
   (input `force`). The workflow runs the same check weekly and, only when
   something changed, extracts, compares, uploads the report as an artifact,
   commits `state.json` and `data/` to a branch
   `catalogue/bamf-<stand>-<run id>`, and opens a pull request with the
   report as its body. It never pushes to `main`. The owner must once allow
   "Allow GitHub Actions to create and approve pull requests" in the
   repository settings, otherwise the pull-request step fails.
9. Record: add the usage-log row (`docs/usage/usage-log.md`), and write
   memory only for a durable lesson such as a changed page layout or a new
   firewall behaviour.

## Rollback

- Pipeline state: `git restore src/catalogue/state.json src/catalogue/data/`
  brings back the committed catalogue facts; delete `src/catalogue/output/`
  (git-ignored: PDF, images, text dump, report, proposal). Re-running
  `check.mjs` recreates everything from the public source.
- App data, only if step 7 was done: `git restore src/web/data/question.json
  src/web/data/questions-core.json src/web/public/data/` restores the
  bundled catalogue and its split files.
- Nothing external changes: bamf.de only answered `GET` requests, and a
  workflow run leaves at most a branch and a pull request that can be closed
  and deleted.

## Output

Plain-language summary: which signals were read and whether the catalogue
changed, the counts from extraction, the identical/reworded/new/removed
numbers, the numbering caveat, where the report and the proposal are, the
exact next step for the owner, and the Work Accounting footer required by
`AGENTS.md`.

## References

- `src/catalogue/README.md` (scripts, state file, troubleshooting)
- `docs/decisions/ADR-009-official-bamf-catalogue-source.md`
- `docs/memory/bamf-catalogue-source.md` (MEM-009)
- `docs/plans/PLAN-013-official-catalogue-and-musterbogen.md`,
  `docs/features/010-official-catalogue-pipeline.md`
- `docs/memory/public-repository-privacy.md` (MEM-008)
- `.github/workflows/sync-catalogue.yml` (weekly schedule, manual dispatch,
  pull request instead of a push to `main`)
