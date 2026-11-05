# BAMF question catalogue

Watches the official *Gesamtfragenkatalog zum Test „Leben in Deutschland“
und zum „Einbürgerungstest“* that the Bundesamt für Migration und
Flüchtlinge (BAMF) publishes as a PDF, downloads it only when it changed,
extracts all 460 questions (300 general + 10 for each of the 16 states) with
their answers and pictures, and compares them with the app's question file.
The result is a review report and a proposed merged file. `apply.mjs` then
carries the **safe part** of the proposal into `src/web/data/question.json`
(texts whose solution follows an exact answer-text match); everything that
needs a judgement call is held back and listed in `output/review.md`. A
question that is **new** in the official catalogue goes through `add.mjs`:
the agent job prepares the complete entry (explanation, category, the seven
translations, a proposed solution with its justification) in
`data/pending-questions.json`, and it ships only after the owner confirmed
the answer letter. A daily PULSE watch
(`.pulse/automations/bamf-catalogue-sync.yaml`) looks for a new catalogue
without a model; when one appears, the agent job it queues applies the safe
part, lands it on `main` (which deploys the web; the apps refresh the
catalogue over the air), prepares the new questions and hands the owner the
held-back questions (owner decision of 2026-10-12, see ADR-009; the GitHub
workflow that did this until 2026-11-01 is gone).

## What this is

A small, self-contained pipeline in plain Node 22 ESM scripts, in the style
of `src/store/`. It adds no npm dependency: it reuses `pdfjs-dist` from
`src/web/node_modules` (a dev dependency of the web app) and otherwise only
Node built-ins (`fetch`, `node:crypto`, `node:zlib`).

```text
src/catalogue/
  watch.mjs                 The PULSE watch: prints the changed signals, or nothing; writes nothing, needs no pdfjs
  check.mjs                 Step 1+2: reads the "last updated" signals, downloads the PDF when it changed
  extract.mjs               Step 3: PDF -> data/bamf-catalogue.json + output/images/*.png, validates the result
  compare.mjs               Step 4: compares with src/web/data/question.json -> output/report.md + output/question.proposed.json
  apply.mjs                 Step 5: writes the safe part of the proposal into src/web/data/question.json and the pictures into src/web/public/questions/, held-back list -> output/review.md
  add.mjs                   Step 6: new official questions - validates data/pending-questions.json (--check), ships confirmed entries (--confirm), drops rejected ones (--remove)
  sync.mjs                  check -> (when changed or --force) extract -> compare -> (--apply) apply, prints a summary
  lib/http.mjs              fetch helpers: User-Agent, timeout, one retry, conditional GET, redirect = failure
  lib/pdf.mjs               pdf.js loading, line reconstruction, picture extraction with position tracking
  lib/png.mjs               Minimal PNG encoder (RGB, RGBA, 1-bit grey) without dependencies
  lib/text.mjs              Text normalisation and matching helpers shared by extract and compare
  state.json                COMMITTED: the signals of the last download (dates, ETag, sha256, page count)
  data/bamf-catalogue.json  COMMITTED: the extracted catalogue
  data/pending-questions.json  COMMITTED: new official questions prepared by the agent, waiting for the owner's confirmation ([] when none)
  output/                   IGNORED: the PDF, pictures, text dump, report, proposal
```

## Prerequisites

- Node 22 (the scripts use `fetch`, `AbortSignal.timeout`, and ESM).
- `pdfjs-dist` installed in `src/web/node_modules`: run `npm ci` in
  `src/web` once.
- Network access to `www.bamf.de` for `check.mjs` (public, read-only; no
  login, no cookies kept). `extract.mjs`, `compare.mjs`, and `apply.mjs`
  work offline.

## Commands

Run everything from the repository root.

```bash
node src/catalogue/watch.mjs           # did anything change? prints the changed signals, or nothing (the daily watch)
node src/catalogue/sync.mjs            # check; extract + compare only when the PDF changed
node src/catalogue/sync.mjs --force    # always download, extract, and compare
node src/catalogue/sync.mjs --apply    # … and write the safe part into src/web/data/question.json
node src/catalogue/check.mjs [--force]
node src/catalogue/extract.mjs [--pdf <path>]
node src/catalogue/compare.mjs
node src/catalogue/apply.mjs [--dry-run]
node src/catalogue/add.mjs --check
node src/catalogue/add.mjs --template <officialNum>[,…]
node src/catalogue/add.mjs --confirm <num>[,…]|all [--solution <num>=<letter>] [--dry-run]
node src/catalogue/add.mjs --remove <num>[,…]
```

After `apply.mjs` or `add.mjs --confirm` wrote the question file, regenerate the split data and
run the tests: `cd src/web && node scripts/split-questions.js && npm test`.

### `check.mjs` – did the catalogue change?

1. GETs the landing page and reads two signals: the page date (`dd.mm.yyyy`
   after "Datum:") and the version counter `v=` of the download link.
2. GETs the PDF conditionally with `If-None-Match` / `If-Modified-Since`
   from `state.json` (plain GET without conditions when `--force` is given
   or no state exists yet).
3. Prints one line per signal (page date, link version, Last-Modified, ETag,
   sha256, "Stand" from the PDF title) with the stored value underneath,
   then `changed=true` or `changed=false`.

On `200 OK` it writes `output/gesamtfragenkatalog.pdf`, computes the
sha256, reads the PDF title (`Stand: dd.mm.yyyy`) and the page count, and
rewrites `state.json`. A download whose bytes equal the stored sha256
counts as `changed=false` (unless `--force`, which always reports
`changed=true` so the next steps run). On `304 Not Modified` nothing is
written; if the landing page shows a new date or version anyway, a warning
is printed and the PDF is downloaded unconditionally.

When `GITHUB_OUTPUT` is set, `changed=true|false` and `stand=<dd.mm.yyyy>`
are appended to that file (a leftover of the retired GitHub workflow;
nothing in the repository sets it any more).

Exit codes: `0` whether or not something changed; `1` on errors (network,
WAF redirect to an error page, a body that is not a PDF, unparsable landing
page).

### `extract.mjs` – PDF to JSON and PNG

Reads `output/gesamtfragenkatalog.pdf` (or `--pdf <path>`) and writes:

- `data/bamf-catalogue.json` – all questions, see the shape below;
- `output/images/<num>-<n>.png` – the pictures of picture questions, `n` =
  1..4 from left to right (`Bild 1` .. `Bild 4`);
- `output/gesamtfragenkatalog.txt` – the reconstructed text, one line per
  PDF text line, for debugging the parser.

How the parser reads the PDF: text items are grouped into lines by their
y position and sorted left to right; `Aufgabe N` starts a question; a line
beginning with the checkbox glyph (U+F0A3 or `□`) starts an answer;
other lines continue the stem or the current answer; `Teil II` / `Fragen
für das Bundesland <Name>` switches to that state (names and codes come from
`src/web/data/states.json`); the footer `Seite N von 191`, the `Teil I`
headings, the `Bild 1 Bild 2 Bild 3 Bild 4` caption line, and the repeated
BAMF logo are dropped. Credit lines (`© …`) and notes printed under a
picture go into `credit`, not into the question text. Pictures are assigned
to the `Aufgabe` heading above them on the same page.

Validation: exactly 300 general + 160 state questions, 16 states × 10,
contiguous numbering, 4 answers each, no empty text, no picture captions in
a stem, picture questions have 4 (`Bild 1` .. `Bild 4` answers) or 1
picture(s). On a validation problem the JSON is still written (so the
problem can be inspected) and the exit code is `1`.

### `compare.mjs` – what differs from the app?

Reads `data/bamf-catalogue.json` and `src/web/data/question.json` and
writes `output/report.md` and `output/question.proposed.json`. Exit `0`
(the report is the result), `1` only when an input file is missing.

Matching is one-to-one and stays within the same scope (general ↔ general,
state ↔ same state code): first an exact match of the normalised stem
(NFKC, lower case, unified quotes/dashes/ellipsis, punctuation stripped,
whitespace collapsed), then a fuzzy fallback (token Jaccard of the stems
≥ 0.8, or stem Jaccard ≥ 0.6 with at least 3 of 4 identical answers, or one
normalised stem starting with the other with at least 3 shared answers).
Categories:

| Category | Meaning |
| --- | --- |
| `identical` | stem and all four answers identical after normalisation; the answers may be in another order (the report says how many) |
| `reworded` | matched, but the stem or an answer differs |
| `new` | official question without a counterpart in the app |
| `removed` | app question without a counterpart in the official catalogue |

The proposal has the app's schema (`num, question, a, b, c, d, solution,
image, translation, category, context, id`) plus helper fields:

- Matched questions keep every existing field and take the official stem
  and answers in the official order. The solution letter follows its
  answer text, and the `a`–`d` of every translation move with the answer
  they translate: an answer is placed by its exact text, the correct
  answer by its solution, the others by the closest remaining official
  answer (similarity ≥ 0.75), and the last one by elimination. An entry
  with translations whose four answers cannot all be placed is flagged
  `needsReview` (its translations could no longer line up with the
  answers). If the correct answer text is not among the
  official answers, it is matched approximately (similarity ≥ 0.75, digits
  must agree) or, when the three wrong answers are all present, by
  elimination – both set `needsReview: true` with a `reviewReason`. If
  nothing fits, the old letter is kept and flagged. `officialNum` records
  the official number.
- New questions are appended with `solution: ""` (the PDF has no answer
  key; never invent one), `image` = first official picture path or `"-"`,
  `translation`, `category`, `context` = `null`, `needsReview: true`, an
  `id` derived from the official text, and a `num` that does not collide
  (`officialNum` when free, else `NEW-<officialNum>`).
- Removed questions stay in the proposal with `notInOfficialCatalogue: true`
  and are listed in the report.

Numbering: the app's numbers come from a third-party source and do not
follow the official PDF (143 of 460 matched questions share their number).
The app keys learner progress, explanations, and translations by `num`, so
the proposal **never renumbers**; the report contains the table
`official → app` for the owner's decision. `src/web/data/question.json`
must keep 460 unique numbers – `questions-core.json` and `public/data/`
are generated from it by `src/web/scripts/split-questions.js`.

### `apply.mjs` – carry the safe part into the app

Reads `output/question.proposed.json` and `src/web/data/question.json`,
refuses to start when the app file has duplicate numbers, and writes a new
`question.json` (2-space JSON like the original) in which

- **safe** matched questions take the official stem, answers (in the
  official order), and the solution letter that follows the answer text –
  `num` and `id` never change, translations keep their permuted `a`–`d`,
  and the helper fields `officialNum`, `needsReview`, `reviewReason`,
  `notInOfficialCatalogue` are stripped;
- **held back** questions (`needsReview`: approximate or eliminated
  solution, unmapped letter) keep their current app version;
- **new** official questions are not added here (they go through
  `add.mjs`, see "New questions" below) and **removed** ones are kept.

`output/review.md` lists everything that was held back, in a form a person
can act on (official text, current app text, proposed solution, reason),
and points to `add.mjs` for the new questions.
`--dry-run` only reports. With `GITHUB_OUTPUT` set it appends `applied`
(changed questions) and `heldBack` (held back + new + removed). Exit `1` on
a missing input, an invalid applied entry (empty text, solution outside
`a`–`d`, changed `num`/`id`), or duplicate numbers before or after; nothing
is written in those cases. Applying the same proposal twice changes nothing.

**Pictures.** The app ships the official pictures, so picture questions work
offline and load nothing from another host. For every app question whose
matched official question has pictures (43 in Stand 07.05.2025), `apply.mjs`
renders `output/images/<officialNum>-<n>.png` into
`src/web/public/questions/<num>.webp` (`lib/picture.mjs`: a single picture
at most 1200 x 900 px; four pictures as a 2 x 2 grid captioned "Bild 1" ..
"Bild 4" in reading order; a credit or source note from the PDF printed
underneath; WebP quality 80, about 2.5 MB for all 43) and sets the
question's `image` to `/questions/<num>.webp`. The file is named by the
app's `num`, not the official number. This happens for held-back questions
too - a picture needs no answer key - and a file no question uses any more
is removed. Unchanged bytes are not rewritten. sharp comes from
`src/web/node_modules`, like pdf.js.

`split-questions.js` writes those pictures into `questions-core.json` as
URLs on the public website (`https://www.lebenindeutschland.org/questions/<num>.webp`,
the origin from `siteConfig.links.website`): apps up to 2.1.25 bundle no
pictures but download that file every day, so they load the picture from
the site. Builds from 2.1.26 on map every such URL they bundle back to the
local file (`src/web/utils/question-pictures.ts`), offline and without a
request.

### `add.mjs` – new questions

The PDF has no answer key, so a question that is new in the official
catalogue cannot be applied automatically, and since the third-party
scraper (and its paid translator) is gone, nobody else writes the
explanation and the translations. The agent job does, and the owner only
confirms the answer letter:

1. `node src/catalogue/add.mjs --template <officialNum>[,…]` appends a
   skeleton for each official question listed under "New in the official
   catalogue" in `output/review.md` to `data/pending-questions.json`: the
   official stem and answers, the next free `num` of its scope, the `id`,
   `officialNum`, `preparedOn` (today), `confirmed: false`, and empty
   `solution`, `justification`, `category`, `context`, and translations.
2. The agent fills every empty field by hand (see the skill
   `bamf-catalogue-sync`, step 7, for the style rules), then runs
   `node src/catalogue/add.mjs --check`, which validates every pending entry
   and prints the summary to post to the owner: each question with its
   four answers, the proposed letter, the justification, and the confirm
   command. Exit `1` on any problem.
3. The pending file is committed in the same `catalogue:` commit as the
   rest of the sync; nothing under `src/web/` changes for a new question yet.
4. The owner answers. `node src/catalogue/add.mjs --confirm <num>[,…]` (or
   `--confirm all`) is the yes: the entries are validated once more, moved
   into `src/web/data/question.json` (a general question after the last
   general one, a state question after the last one of its state; 2-space
   JSON exactly as `apply.mjs` writes it) and removed from the pending file.
   `--solution <num>=<letter>` confirms with another letter; the explanation
   must already name that answer, otherwise the command refuses and the
   agent rewrites `context` and the translated contexts first. `--dry-run`
   only reports. `node src/catalogue/add.mjs --remove <num>` is the no.
   Then `node scripts/split-questions.js && npm test` in `src/web`, the
   version bump, one `catalogue:` commit, landing.

What `--check` requires of an entry: the twelve question fields plus
`officialNum`, `justification`, `preparedOn` (ISO date) and `confirmed`
(boolean), and nothing else; non-empty stem and answers; `solution` in
`a`–`d`; `category` from `src/web/types/question.ts`; `image` `"-"` or an
https URL (new picture questions keep `"-"` until the owner publishes
pictures); `context` German prose of at least 200 characters that names
the correct answer (its text, or its letter next to Antwort/Option/Lösung,
or quoted as `"d: …"`) and asserts no other letter, without mentioning a
model; `translation` with exactly `en, tr, ru, fr, ar, uk, hi`, each with
non-empty `question, a, b, c, d, context`, none equal to its German source
except a text of at most 4 characters or without letters (`EU`, `1949`,
`3%`) and, in `en`, `tr`, `fr` only, an answer that is a proper name of up
to four capitalised words (`Konrad Adenauer`, `Frankfurt/Oder`); `id` =
sha256 of `JSON.stringify([officialNum, question, [a, b, c, d]])` (the
scheme of `compare.mjs`; the app only needs the id to be unique); `num`
matching the app's `NUM` pattern (`"1"`..`"999"` or `"<STATE>-<1..99>"`),
unused in the app file and the other pending entries, above the highest
shipped number of its scope (a removed question's number is never reused),
and of the same scope as `officialNum`. Outside the error list `--check`
prints style notes: an explanation shorter than 450 or longer than 750
characters, first person, a justification longer than a sentence.

Numbering of new questions: the next integer above the highest number the
app file or the pending file uses in the scope (`301` for the first new
general question after `1`..`300`, `BW-11` for a new Baden-Württemberg
question). The app treats every `/^\d+$/` number as a general question and
`<CODE>-n` as that state's, orders nothing by number, and keys learner
progress by `num`, so a higher number costs nothing and a reused one would
inherit a stranger's progress.

## Outputs

Committed (reviewable diffs on `main`, `catalogue:` commits):

- `state.json` – no personal data, no paths, no cookies:

  ```json
  {
    "landingUrl": "https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.pdf",
    "pdfUrl": "https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.pdf?__blob=publicationFile",
    "pageDate": "26.05.2025",
    "version": "23",
    "lastModified": "Wed, 03 Sep 2025 11:46:29 GMT",
    "etag": "\"d46ab013b2f264b1dd2ba14220944309\"",
    "sha256": "<hex>",
    "bytes": 8970190,
    "pages": 191,
    "stand": "07.05.2025",
    "downloadedAt": "<ISO 8601 UTC>"
  }
  ```

  `downloadedAt` only changes when the bytes change; there is no
  `checkedAt` (it would create a commit on every run).

- `data/bamf-catalogue.json`:

  ```json
  {
    "source": { "pdfUrl": "…", "stand": "07.05.2025", "lastModified": "…", "etag": "…", "sha256": "…", "pages": 191, "extractedAt": "<ISO>" },
    "counts": { "general": 300, "state": 160, "withImages": 43 },
    "questions": [
      { "num": "1", "part": "general", "page": 2, "question": "…", "answers": ["…", "…", "…", "…"] },
      { "num": "BW-1", "part": "state", "state": "Baden-Württemberg", "stateCode": "BW", "page": 173,
        "question": "…", "answers": ["Bild 1", "Bild 2", "Bild 3", "Bild 4"],
        "images": ["images/BW-1-1.png", "…"], "credit": null }
    ]
  }
  ```

  Picture paths are relative to `src/catalogue/output/`. `extractedAt` is
  kept from the previous file while the PDF and the questions are unchanged.

Ignored (`src/catalogue/output/`, see `.gitignore`):

- `gesamtfragenkatalog.pdf` (about 9 MB), `gesamtfragenkatalog.txt`
- `images/*.png` (about 100 files, 36 MB)
- `report.md`, `review.md`, `question.proposed.json`

Applied by `apply.mjs` and `add.mjs --confirm` (committed by the automation job together with the
files above): `src/web/data/question.json`, `src/web/public/questions/*.webp` (`apply.mjs`), and – after `split-questions.js` –
`src/web/data/questions-core.json` and `src/web/public/data/`.

### `watch.mjs` – the daily watch

Reads the landing page's two signals and asks the PDF conditionally, like
`check.mjs`, but writes nothing: no download to `output/`, no `state.json`
rewrite, and the PDF is never opened, so it runs without `src/web/node_modules`.
Diagnostics go to stderr; stdout carries only the change (`landing page
date … -> …`, `download link version … -> …`, `PDF bytes changed: …`) or
nothing. Exit `1` on the same errors as `check.mjs`.
`.pulse/automations/bamf-catalogue-sync.sh` wraps it for PULSE.

## PULSE automation

`.pulse/automations/bamf-catalogue-sync.yaml` is a PULSE **watch**: every
day at 06:00 UTC the daemon runs `.pulse/automations/bamf-catalogue-sync.sh`
in a fresh worktree of `main`, with no model. While the watcher prints nothing, nothing
happens. When it prints the changed signals, the daemon queues one agent job
whose brief is the `bamf-catalogue-sync` skill (`.pulse/skills/bamf-catalogue-sync/SKILL.md`):

1. `cd src/web && npm ci`, then `node src/catalogue/check.mjs`,
   `extract.mjs`, `compare.mjs`, `apply.mjs`; for every new official
   question `add.mjs --template`, the agent's explanation, category,
   translations and proposed solution, `add.mjs --check`;
2. `node scripts/split-questions.js` and `npm test` in `src/web` – a red
   test suite stops the job and nothing is committed;
3. one commit holding `src/catalogue/state.json`, `src/catalogue/data/`
   (including `pending-questions.json`),
   `src/web/data/question.json`, `src/web/data/questions-core.json` and
   `src/web/public/data/`, with the patch version bumped in
   `src/web/package.json` and `package-lock.json` when app data changed
   (`catalogue: BAMF Gesamtfragenkatalog Stand <stand> (<n> questions
   aligned)`, or `catalogue: record BAMF Gesamtfragenkatalog Stand <stand>`
   for bookkeeping only);
4. the runner lands the commit on `main` after `scripts/check.sh`, and the
   daemon pushes it; the push starts `vercel-deploy.yml`. The apps need no
   build: they download `questions-core.json` over the air, and the
   Android and iOS releases are started by hand;
5. held-back questions reach the owner as a `question` post on the board
   with the summary of `review.md`; new questions as the summary of
   `add.mjs --check` (question, answers, proposed letter, justification,
   confirm command). After the owner's yes a follow-up runs
   `add.mjs --confirm`, the split script and the tests, bumps the version,
   and lands one more `catalogue:` commit.

`pulse schedule list --project leben-in-deutschland` shows the schedule,
`pulse schedule log SCHED-NNN` the watcher's last output, `pulse schedule run
SCHED-NNN` runs it now. A watcher that exits `1` three runs in a row (firewall,
layout change) queues a job to fix the watcher. No secrets are involved: the
watcher and the pipeline only `GET` public files, and the landing uses the
daemon's own push credential.

## Rules

- **Only `apply.mjs` and `add.mjs --confirm` write into `src/web/`.**
  `check`, `extract`, and `compare` write under `output/` and
  `src/catalogue/`; a question whose solution needs a judgement call keeps
  its app version until a person decides it in
  `src/web/data/question.json`.
- **A proposed solution never reaches `question.json` without the owner's
  confirmation.** The PDF has no answer key. New questions are prepared by
  the agent in `data/pending-questions.json` with a proposed letter and a
  justification; only `add.mjs --confirm`, run on the owner's yes, ships
  them. The explanation and the translations are the agent's work and are
  reviewed by reading.
- **Never renumber.** Learner progress is keyed by `num`; renumbering is an
  owner decision documented in the report, not a side effect. `apply.mjs`
  and `add.mjs` refuse duplicate numbers, and a new question takes the next
  number above the highest one of its scope - never a removed question's.
- **`question.json` is the single source of the shipped data.** Do not
  edit `questions-core.json` or `public/data/` by hand; regenerate them
  with `split-questions.js` and keep all three in the same commit. The
  scraper's `question.json` has duplicate numbers and must never be copied
  into the app again (the workflow that did, `sync-question.yml`, was
  removed on 2026-11-01; the official PDF is the only source).
- **GET only, no cookies.** The site is behind a WAF that rejects `HEAD`
  and sets session cookies. The scripts use plain and conditional `GET`
  with a descriptive User-Agent, a 60 s timeout and one retry, treat any
  redirect as a failure, and never store or print cookies or the landing
  page HTML. The retry notice (`! GET … failed: ECONNRESET; retrying in
  3 s`) goes to stderr: the PULSE watches queue a job for anything on
  stdout, and a recovered retry is not a change on bamf.de.
- **Public repository.** Committed files and printed output contain no
  home paths (paths are printed relative to the repository root), e-mail
  addresses, device names, or cookies.
- **No new dependencies.** Node built-ins and the existing `pdfjs-dist`
  only; PNGs are encoded by `lib/png.mjs`.

## Troubleshooting

- `pdfjs-dist is not installed; run npm ci in src/web` – the web app's
  dev dependencies are missing. Run `npm ci` in `src/web`.
- `GET … was redirected (303, /error_path/400.html); the site's WAF may
  have blocked the request` or `the download is not a PDF` – the WAF
  answered with an error page (it does this for `HEAD`, for some automated
  clients, or during maintenance). Retry later; if it persists on the
  machine the PULSE daemon runs on, run `sync.mjs` on another one and land
  the branch by hand.
- `GET … failed: fetch failed` or `… timed out` – network problem; one
  retry is built in, run again.
- `! the response carried no validators; the stored ones were kept because
  the bytes are identical` – the site answered `200` without `ETag` /
  `Last-Modified`. Nothing to do; the next run is conditional again. If
  the bytes had changed, both fields would be `null` and the next run
  downloads the file in full once.
- `the landing page changed its layout: no "Datum:" date, no download link
  with a version number found` – BAMF changed the page markup. Adjust `parseLandingPage` in
  `check.mjs`; the conditional GET of the PDF itself does not depend on
  these signals.
- `src/catalogue/output/gesamtfragenkatalog.pdf is missing - run node
  src/catalogue/check.mjs first` – run `check.mjs` first (or pass
  `--pdf <path>`).
- `extract.mjs` reports problems (`<num>: 3 answers, expected 4`,
  `general numbering breaks at Aufgabe N`, `<num>: 2 images, expected 4`,
  `picture captions ended up in the question text`) – open
  `output/gesamtfragenkatalog.txt` at that question; BAMF probably changed
  the layout (a new glyph before answers, a different heading, a picture
  painted above its `Aufgabe` line). The JSON is written anyway so the diff
  shows what went wrong. Pictures are assigned to the heading above them on
  the same page, so a different placement needs a rule change in
  `extract.mjs`.
- `page N: an image (WxH) belongs to no question` – a picture appears
  before the first `Aufgabe` of a page, or BAMF changed the logo: check the
  page and `isHeaderImage` in `extract.mjs`.
- `src/web/data/question.json has N duplicate question number(s)` – the
  app file was overwritten by a source with broken numbering (this happened
  in December 2025 through the scraper sync). Restore it from the last
  commit whose `split-questions.js` output equals the shipped
  `questions-core.json`, then run `compare.mjs` and `apply.mjs` again.
- `app question <num> (<id>) has no entry in the proposal; re-run
  compare.mjs` – the proposal is older than the question file.
- `npm test` is red after `apply.mjs` or `add.mjs --confirm` – the applied data broke a test.
  Read `output/report.md` and `output/review.md`, fix the test (one that
  hard-codes a catalogue fact) or the data on a branch, and run the
  pipeline again with `--force`. Nothing was committed.
- `context does not name the correct answer (…)` or `context asserts c as
  the right answer, but the solution is d` from `add.mjs` – the explanation
  and the proposed (or owner-corrected) letter disagree. Rewrite `context`
  and the seven translated contexts so they end by naming the right
  answer; never change the letter to fit the text.
- `translation.<lang>.<field> equals the German text` from `add.mjs` – a
  field was copied instead of translated. Only numbers, abbreviations of
  up to 4 characters, and (in en, tr, fr) proper-name answers may stay.
- `num 301 lies below the highest shipped number of its scope` or `num … is
  already in the app's question file` from `add.mjs` – take the number the
  message proposes; `--template` chooses it.
- The watch keeps printing the same change – the job it queued did not
  land (`pulse schedule show SCHED-NNN` names the job). Finish or fix that
  job; the next run of the watcher compares against the landed
  `state.json`.
- The issue body ends with "Cut here" – expected for long lists; download
  the `catalogue-review` artifact for the full `review.md`.
