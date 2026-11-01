---
name: bamf-catalogue-sync
description: Keep the app's questions in step with the official BAMF "Gesamtfragenkatalog" PDF for the Leben in Deutschland and Einbürgerungstest - read the last-updated signals on bamf.de, download the PDF only when it changed, extract all 460 questions with answers and pictures, compare them with the app's question file, apply the safe part (exact answer-text matches) to src/web/data/question.json, and hand the owner the held-back questions; read-only public GETs, no credentials, never renumbers, never invents a solution. Use when asked to check whether BAMF updated the question catalogue, download the PDF if it changed, extract all questions, compare with or apply to the app's questions, review the held-back list, or run the weekly catalogue workflow.
---

# BAMF Catalogue Sync

Ask the official source, not a third-party website. The scripts under
`src/catalogue/` read the public catalogue PDF from bamf.de, turn it into
JSON, compare it with the app's `question.json`, and apply the part that
needs no judgement call. A human decides only the held-back questions. The
rules below are the decision (ADR-009, amended 2026-10-12: apply the safe
part and push to `main` automatically); the facts behind them - the firewall,
the three "last updated" signals, the numbering and the release rule - are
in `catalogue-source.md` beside this file.

Since 2026-11-01 the standing check is a PULSE automation, not a GitHub
workflow: `.pulse/automations/bamf-catalogue-sync.yaml` runs
`scripts/watch-catalogue.sh` (`src/catalogue/watch.mjs`) every day without a
model; only when bamf.de shows a new page date, link version or PDF does the
daemon queue one agent job whose brief is this skill.

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
- **Only `apply.mjs` writes `src/web/data/question.json`, and only the
  safe part.** Never renumber: learner progress, explanations, and
  translations are keyed by the question number (`num`), and the official
  numbering does not match the app's. `question.json` must keep 460 unique
  numbers; `apply.mjs` refuses otherwise. `questions-core.json` and
  `public/data/` are generated from it by `split-questions.js` – never
  edit them by hand, always commit all three together.
- **The PDF has no answer key.** A solution is carried over only when the
  correct answer text appears verbatim among the official answers;
  otherwise the entry is marked `needsReview: true` and held back. Never
  invent, guess, or "research" a correct answer, and never apply a
  held-back entry without the owner's explicit decision.
- **The held-back list is reviewed by the owner.** The outputs of this
  skill are `src/catalogue/output/report.md` (full comparison),
  `question.proposed.json` (full proposal), and `review.md` (what a human
  must decide); an automation job hands `review.md` to the owner as a
  `question` post on the board (and, in a hub conversation, as an artifact).
- **Public repository.** The committed state and the report contain no
  machine names, home paths, e-mail addresses, or other identifiers (see
  the privacy rule in `AGENTS.md`).
- **Hard stops stay.** Landing on `main` goes through `pulse land`; the
  daemon pushes according to `landing.push`. Never `git push`, never `gh`.
- **Images carry credits.** Pictures extracted from the PDF stay in the
  git-ignored `src/catalogue/output/images/`. Publishing them in the app is
  a separate decision (a new ADR record in the PULSE store first).

## Procedure

1. Read `src/catalogue/README.md` and
   `catalogue-source.md` beside this file. Note the current SHA and
   `git status` as the rollback baseline.
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
   - `changed=false`: nothing was downloaded and `state.json` is
     unchanged. Report the stored `stand` (the "Stand" date from the PDF
     title), the page date, and `Last-Modified`. The held-back list is
     still open until the owner decides it: `compare.mjs` and
     `apply.mjs --dry-run` work offline on the committed
     `data/bamf-catalogue.json` and rebuild `review.md` without a
     download (step 5 and the first line of step 6). The daily watch
     queues a job only on a changed catalogue, so the board thread is
     where the owner finds the list - post it once and point to that post
     afterwards instead of reposting it.
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
   `node src/catalogue/sync.mjs [--force] [--apply]` runs steps 3 to 5 (and
   with `--apply` step 6) in one go and skips everything after the check
   when nothing changed.
6. Apply the safe part:

   ```bash
   node src/catalogue/apply.mjs --dry-run   # what would change
   node src/catalogue/apply.mjs             # write src/web/data/question.json
   cd src/web && node scripts/split-questions.js && npm test
   ```

   Safe = a matched question whose correct answer text appears verbatim
   among the official answers; it takes the official stem, answer order,
   and the letter that follows the text, keeping `num` and `id`. Everything
   with `needsReview`, new questions, and removed questions are held back
   and listed in `src/catalogue/output/review.md`. A red test suite means
   stop: restore the data (see Rollback) and report. Expected first-run
   figures on the repaired data: 346 applied, 60 unchanged, 54 held back.
   Check the translations too: their `a`–`d` must move with the German
   answers they translate (the translation panel shows them by letter).
   Until 2026-11-01 `compare.mjs` moved them only when all four answers
   matched verbatim, which left 44 questions with translations in the old
   order; an explanation that names a letter ("Option b") is text and is
   not rewritten - list those for the owner.
7. Hand the held-back list to the owner: summarise `review.md` (how many,
   the reasons, the official text next to the app text). Only when the
   owner decides an entry explicitly, edit it in `src/web/data/question.json`
   by hand (never a solution the owner did not confirm), then rerun the
   command block of step 6 from `split-questions.js` on. A new question
   still needs its solution, translations, and explanation from a human
   before it can ship.
8. Commit `src/catalogue/state.json`, `src/catalogue/data/`,
   `src/web/data/question.json`, `src/web/data/questions-core.json`, and
   `src/web/public/data/` together as one commit with a `catalogue:`
   message (`catalogue: BAMF Gesamtfragenkatalog Stand <stand> (<n>
   questions aligned)`, or `catalogue: record BAMF Gesamtfragenkatalog
   Stand <stand>` when only the bookkeeping changed). A push to `main`
   deploys the web, so when app data changed bump the patch version first:
   edit `"version"` in `src/web/package.json` and both `version` fields of
   `src/web/package-lock.json` by hand (npm 10 rewrites the lockfile; see
   the project memory) and add them to the same commit. Then hand the
   branch to landing: as a PULSE job, finish normally (the runner lands kept
   commits and `scripts/check.sh` runs); in a conversation,
   `pulse land --project leben-in-deutschland --branch <branch>`. The apps
   need no build: they download `questions-core.json` over the air.
9. The standing check: `.pulse/automations/bamf-catalogue-sync.yaml` is a
   daily watch of `scripts/watch-catalogue.sh`. The watcher prints nothing
   while the three signals equal `state.json` and prints the changed
   signals otherwise; the daemon then queues one job with this skill as its
   brief (`pulse schedule list --project leben-in-deutschland`,
   `pulse schedule log SCHED-NNN` for the last output, `pulse schedule run
   SCHED-NNN` to run it now). A watcher that exits 1 three runs in a row
   (firewall, layout change) queues a job to fix the watcher, not the data.
10. Record: reply on the owner's task or post a `finding` on the PULSE
    board; held-back questions go to the owner as a `question` post with
    the summary of `review.md`. Write a `MEM-*` record only for a durable
    lesson such as a changed page layout or a new firewall behaviour, and
    update `catalogue-source.md` when one of its facts changed.

## Rollback

- Pipeline state: `git restore src/catalogue/state.json src/catalogue/data/`
  brings back the committed catalogue facts; delete `src/catalogue/output/`
  (git-ignored: PDF, images, text dump, report, proposal). Re-running
  `check.mjs` recreates everything from the public source.
- App data, if step 6 or 7 was done: `git restore src/web/data/question.json
  src/web/data/questions-core.json src/web/public/data/` restores the
  bundled catalogue and its split files.
- A landed `catalogue:` commit on `main`: `git revert <sha>` (one commit
  holds data, split files, state, and version bump) and land the revert;
  the revert deploys the web again. Answer the owner's `question` post if
  the data it describes was reverted.
- Nothing else external changes: bamf.de only answered `GET` requests.

## Output

Plain-language summary: which signals were read and whether the catalogue
changed, the counts from extraction, the identical/reworded/new/removed
numbers, how many questions were applied and how many held back (and why),
the numbering caveat, where the report, proposal, and held-back list are,
and the exact next step for the owner.

## References

- `src/catalogue/README.md` (scripts, state file, troubleshooting)
- `catalogue-source.md` beside this file (how the official PDF is read and
  what it cannot tell you: firewall, signals, numbering, releases, drift)
- `AGENTS.md` (public-repository privacy rule, verification commands)
- `.pulse/automations/bamf-catalogue-sync.yaml`, `scripts/watch-catalogue.sh`,
  `src/catalogue/watch.mjs` (the daily watch that queues this skill)
