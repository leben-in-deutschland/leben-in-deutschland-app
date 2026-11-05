---
name: bamf-catalogue-sync
description: Keep the app's questions in step with the official BAMF "Gesamtfragenkatalog" PDF for the Leben in Deutschland and Einbürgerungstest - read the last-updated signals on bamf.de, download the PDF only when it changed, extract all 460 questions with answers and pictures, compare them with the app's question file, apply the safe part (exact answer-text matches) to src/web/data/question.json, prepare every new question yourself (German explanation, category, the seven translations, a proposed solution with its justification) in src/catalogue/data/pending-questions.json, and ship it only after the owner confirmed the answer; hand the owner the held-back questions; read-only public GETs, no credentials, never renumbers, a proposed solution never ships unconfirmed. Use when asked to check whether BAMF updated the question catalogue, download the PDF if it changed, extract all questions, compare with or apply to the app's questions, prepare or confirm new questions, review the held-back list, or run the daily catalogue watch.
---

# BAMF Catalogue Sync

Ask the official source, not a third-party website. The scripts under
`src/catalogue/` read the public catalogue PDF from bamf.de, turn it into
JSON, compare it with the app's `question.json`, and apply the part that
needs no judgement call. New questions are prepared by the agent that runs
this skill - explanation, category, translations, proposed answer - and
shipped only on the owner's confirmation; a human decides only the
held-back questions and the answer letters. The
rules below are the decision (ADR-009, amended 2026-10-12: apply the safe
part and push to `main` automatically); the facts behind them - the firewall,
the three "last updated" signals, the numbering and the release rule - are
in `catalogue-source.md` beside this file.

Since 2026-11-01 the standing check is a PULSE automation, not a GitHub
workflow: `.pulse/automations/bamf-catalogue-sync.yaml` runs
`.pulse/automations/bamf-catalogue-sync.sh` (`src/catalogue/watch.mjs`) every
day without a model; only when bamf.de shows a new page date, link version or PDF does the
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
- **Only `apply.mjs` and `add.mjs --confirm` write `src/web/data/question.json`.**
  `apply.mjs` writes the safe part; `add.mjs --confirm` the new questions
  the owner confirmed. Never renumber: learner progress, explanations, and
  translations are keyed by the question number (`num`), and the official
  numbering does not match the app's. `question.json` must keep unique
  numbers (460 today, plus every confirmed new question); both scripts
  refuse otherwise, and a new question takes the next number above the
  highest one of its scope (`301`, `BW-11`), never a removed question's.
  `questions-core.json` and
  `public/data/` are generated from it by `split-questions.js` – never
  edit them by hand, always commit all three together.
- **The PDF has no answer key.** For a matched question a solution is
  carried over only when the correct answer text appears verbatim among
  the official answers; otherwise the entry is marked `needsReview: true`
  and held back, and a held-back entry is never applied without the
  owner's explicit decision. For a new question the agent proposes the
  answer from its own knowledge of German law, history and civics, names
  the source in one sentence (`justification`, for example "Art. 20 Abs. 1
  GG"), and writes it into `src/catalogue/data/pending-questions.json` -
  a proposed solution never reaches `question.json` without the owner's
  confirmation (`add.mjs --confirm`). The explanation and the translations
  are the agent's work and are reviewed by reading.
- **The held-back list and the pending questions are reviewed by the
  owner.** The outputs of this
  skill are `src/catalogue/output/report.md` (full comparison),
  `question.proposed.json` (full proposal), `review.md` (what a human
  must decide), and the committed `src/catalogue/data/pending-questions.json`
  (new questions, complete, awaiting the answer confirmation); an
  automation job hands `review.md` and the summary of `add.mjs --check` to
  the owner as a `question` post on the board (and, in a hub conversation,
  as the reply).
- **Public repository.** The committed state and the report contain no
  machine names, home paths, e-mail addresses, or other identifiers (see
  the privacy rule in `AGENTS.md`).
- **Hard stops stay.** Landing on `main` goes through `pulse land`; the
  daemon pushes according to `landing.push`. Never `git push`, never `gh`.
- **Images carry credits.** Pictures extracted from the PDF land in the
  git-ignored `src/catalogue/output/images/`; `apply.mjs` renders each
  picture question's pictures, with the PDF's credit printed underneath,
  into the committed `src/web/public/questions/<num>.webp` and points
  `image` at `/questions/<num>.webp` (TASK-077), so the app shows them
  offline. Commit changed `.webp` files with the rest of the sync. A new
  picture question from `add.mjs` keeps `image: "-"` in the pending file;
  the next `apply.mjs` after `--confirm` gives it its picture.

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
     still open until the owner decides it, and the pending questions
     until the owner confirms them (`node src/catalogue/add.mjs --check`
     prints them with their commands): `compare.mjs` and
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
7. Hand the held-back list to the owner and prepare the new questions.
   - Held back (`## Kept at the current app version` in `review.md`):
     summarise them (how many, the reasons, the official text next to the
     app text). Only when the owner decides an entry explicitly, edit it in
     `src/web/data/question.json` by hand (never a solution the owner did
     not confirm), then rerun the command block of step 6 from
     `split-questions.js` on.
   - New (`## New in the official catalogue` in `review.md`): you write
     the complete entry yourself; nobody else does since the third-party
     scraper and its translator are gone. For each new question:

     ```bash
     node src/catalogue/add.mjs --template <officialNum>[,<officialNum>...]
     ```

     appends a skeleton to `src/catalogue/data/pending-questions.json`
     with the official stem and answers, the next free `num` of its scope
     (`301` after `1`..`300`, `BW-11` after `BW-10`; never a removed
     question's number), the `id`, `officialNum`, `preparedOn`, and
     `confirmed: false`. Before filling it, read two or three shipped
     entries of the same category in `src/web/data/question.json` (their
     `context` and `translation`) so the new one matches them. Then fill:
     - `solution`: the letter you hold to be right, and `justification`:
       one sentence (German or English) why, naming the source when there
       is one ("Art. 20 Abs. 1 GG", "Wahlgesetz § 1", "the Basic Law came
       into force on 23 May 1949"). When you are not sure, say so in the
       justification ("unsure between b and d: …") - the owner decides.
     - `category`: one of the twelve names in `src/web/types/question.ts`
       (`Rights & Freedoms`, `Education & Religion`, `Law & Governance`,
       `Democracy & Politics`, `Economy & Employment`, `History & Geography`,
       `Elections`, `Press Freedom`, `Assembly & Protests`, `Federal System`,
       `Constitution`, `General`), the one the shipped neighbours use.
     - `context`: the German explanation in the style of the shipped
       ones: 450-750 characters, neutral prose in the third person (no
       "ich"/"wir", no "laut KI", no mention of any model or of this
       procedure), states why the right answer is right and why each of
       the other three is wrong, and ends by naming the right answer with
       its text, for example `Daher ist die richtige Antwort "d: hier
       Meinungsfreiheit gilt."` (the letter form `Antwort d` is accepted
       too, but the text form survives a later reordering). Never assert
       another letter anywhere in the text.
     - `translation`: all seven languages `en, tr, ru, fr, ar, uk, hi`,
       each with `question, a, b, c, d, context` translated naturally,
       not word by word; the translated `context` says the same as the
       German one, including the closing sentence with the answer. Keep
       proper nouns, years, and numbers as they are; render German
       institutions as the shipped translations do (`Bundestag` stays
       `Bundestag` in en/tr/fr and is transliterated in ru/uk/ar/hi;
       `Grundgesetz` becomes `Constitution`, `Anayasa`, `Конституция`, ...).
       A field equal to its German source counts as not translated,
       except a text of at most 4 characters or without letters (`EU`,
       `1949`, `3%`) and, in en/tr/fr only, an answer that is a proper
       name (`Konrad Adenauer`). Picture answers `Bild 1`..`Bild 4` are
       translated as the shipped picture questions do (`1`..`4`).
     - `image`: keep `"-"`; `apply.mjs` sets the bundled picture after
       `--confirm` (see "Images carry credits").

     Then validate and read the summary it prints:

     ```bash
     node src/catalogue/add.mjs --check
     ```

     Exit 1 means an entry is incomplete or inconsistent (a copied
     translation, a letter the explanation does not name, a reused
     number, ...); fix the entry, never the check. Commit
     `src/catalogue/data/pending-questions.json` in the same `catalogue:`
     commit as the rest of the sync (step 8) - the pending file changes
     nothing under `src/web/`, so no version bump is needed for it alone.
     Post the printed summary to the owner as a `question` (on the board,
     or as the hub conversation's reply): every new question with its
     four answers, the proposed letter, the justification, and the exact
     commands `node src/catalogue/add.mjs --confirm <num>`,
     `--confirm <num> --solution <num>=<letter>` and `--remove <num>`.
   - Only after the owner's yes (in a later job or conversation):

     ```bash
     node src/catalogue/add.mjs --confirm <num>[,<num>...]   # or --confirm all
     cd src/web && node scripts/split-questions.js && npm test
     ```

     `--confirm` validates the entries once more, appends them to
     `src/web/data/question.json` (into the block of their scope, in the
     format `apply.mjs` writes) and removes them from the pending file.
     When the owner names another letter, pass `--solution <num>=<letter>`;
     the explanation must already name that answer, otherwise the command
     refuses - then rewrite `context` and the seven translated contexts for
     the owner's letter, run `--check` again, and confirm. A "no" is
     `node src/catalogue/add.mjs --remove <num>`. Then step 8 with the
     version bump, one `catalogue:` commit, landing.
8. Commit `src/catalogue/state.json`, `src/catalogue/data/` (including
   `pending-questions.json`),
   `src/web/data/question.json`, `src/web/data/questions-core.json`,
   `src/web/public/data/`, and `src/web/public/questions/` together as one commit with a `catalogue:`
   message (`catalogue: BAMF Gesamtfragenkatalog Stand <stand> (<n>
   questions aligned)`, `catalogue: add <n> confirmed question(s) from
   Stand <stand>` after `add.mjs --confirm`, or `catalogue: record BAMF
   Gesamtfragenkatalog Stand <stand>` when only the bookkeeping or the
   pending file changed). A push to `main`
   deploys the web, so when app data changed bump the patch version first:
   edit `"version"` in `src/web/package.json` and both `version` fields of
   `src/web/package-lock.json` by hand (npm 10 rewrites the lockfile; see
   the project memory) and add them to the same commit. Then hand the
   branch to landing: as a PULSE job, finish normally (the runner lands kept
   commits and `scripts/check.sh` runs); in a conversation,
   `pulse land --project leben-in-deutschland --branch <branch>`. The apps
   need no build: they download `questions-core.json` over the air.
9. The standing check: `.pulse/automations/bamf-catalogue-sync.yaml` is a
   daily watch of `.pulse/automations/bamf-catalogue-sync.sh`. The watcher
   prints nothing
   while the three signals equal `state.json` and prints the changed
   signals otherwise; the daemon then queues one job with this skill as its
   brief (`pulse schedule list --project leben-in-deutschland`,
   `pulse schedule log SCHED-NNN` for the last output, `pulse schedule run
   SCHED-NNN` to run it now). A watcher that exits 1 three runs in a row
   (firewall, layout change) queues a job to fix the watcher, not the data.
10. Record: reply on the owner's task or post a `finding` on the PULSE
    board; held-back questions go to the owner as a `question` post with
    the summary of `review.md`, new questions as the summary of
    `add.mjs --check` with the confirm commands. Write a `MEM-*` record only for a durable
    lesson such as a changed page layout or a new firewall behaviour, and
    update `catalogue-source.md` when one of its facts changed.

## Rollback

- Pipeline state: `git restore src/catalogue/state.json src/catalogue/data/`
  brings back the committed catalogue facts and the pending questions;
  delete `src/catalogue/output/`
  (git-ignored: PDF, images, text dump, report, proposal). Re-running
  `check.mjs` recreates everything from the public source; the pending
  entries are the agent's text and are written again by hand.
- App data, if step 6 or 7 was done: `git restore src/web/data/question.json
  src/web/data/questions-core.json src/web/public/data/` restores the
  bundled catalogue and its split files (a confirmed new question returns
  to the pending file with `git restore src/catalogue/data/`).
- A landed `catalogue:` commit on `main`: `git revert <sha>` (one commit
  holds data, split files, state, and version bump) and land the revert;
  the revert deploys the web again. Answer the owner's `question` post if
  the data it describes was reverted.
- Nothing else external changes: bamf.de only answered `GET` requests.

## Output

Plain-language summary: which signals were read and whether the catalogue
changed, the counts from extraction, the identical/reworded/new/removed
numbers, how many questions were applied and how many held back (and why),
how many new questions were prepared in the pending file with which
proposed letters, the numbering caveat, where the report, proposal, and
held-back list are, and the exact next step for the owner (the confirm
command for each new question).

## References

- `src/catalogue/README.md` (scripts, state file, troubleshooting)
- `src/catalogue/add.mjs` and `src/catalogue/data/pending-questions.json`
  (new questions: template, check, confirm, remove; the file the owner's
  confirmation acts on)
- `catalogue-source.md` beside this file (how the official PDF is read and
  what it cannot tell you: firewall, signals, numbering, releases, drift)
- `AGENTS.md` (public-repository privacy rule, verification commands)
- `.pulse/automations/bamf-catalogue-sync.yaml`,
  `.pulse/automations/bamf-catalogue-sync.sh`, `src/catalogue/watch.mjs` (the
  daily watch that queues this skill)
