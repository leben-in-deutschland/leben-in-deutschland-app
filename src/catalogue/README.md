# BAMF question catalogue

Watches the official *Gesamtfragenkatalog zum Test „Leben in Deutschland“
und zum „Einbürgerungstest“* that the Bundesamt für Migration und
Flüchtlinge (BAMF) publishes as a PDF, downloads it only when it changed,
extracts all 460 questions (300 general + 10 for each of the 16 states) with
their answers and pictures, and compares them with the app's question file.
The result is a review report and a proposed merged file. `apply.mjs` then
carries the **safe part** of the proposal into `src/web/data/question.json`
(texts whose solution follows an exact answer-text match); everything that
needs a judgement call is held back and listed in `output/review.md`. The
weekly workflow pushes the applied data to `main`, which starts the web
deploy and the Android release, and opens a GitHub issue for the held-back
questions (owner decision of 2026-10-12, see ADR-009).

## What this is

A small, self-contained pipeline in plain Node 22 ESM scripts, in the style
of `src/store/`. It adds no npm dependency: it reuses `pdfjs-dist` from
`src/web/node_modules` (a dev dependency of the web app) and otherwise only
Node built-ins (`fetch`, `node:crypto`, `node:zlib`).

```text
src/catalogue/
  check.mjs                 Step 1+2: reads the "last updated" signals, downloads the PDF when it changed
  extract.mjs               Step 3: PDF -> data/bamf-catalogue.json + output/images/*.png, validates the result
  compare.mjs               Step 4: compares with src/web/data/question.json -> output/report.md + output/question.proposed.json
  apply.mjs                 Step 5: writes the safe part of the proposal into src/web/data/question.json, held-back list -> output/review.md
  sync.mjs                  check -> (when changed or --force) extract -> compare -> (--apply) apply, prints a summary
  lib/http.mjs              fetch helpers: User-Agent, timeout, one retry, conditional GET, redirect = failure
  lib/pdf.mjs               pdf.js loading, line reconstruction, picture extraction with position tracking
  lib/png.mjs               Minimal PNG encoder (RGB, RGBA, 1-bit grey) without dependencies
  lib/text.mjs              Text normalisation and matching helpers shared by extract and compare
  state.json                COMMITTED: the signals of the last download (dates, ETag, sha256, page count)
  data/bamf-catalogue.json  COMMITTED: the extracted catalogue
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
node src/catalogue/sync.mjs            # check; extract + compare only when the PDF changed
node src/catalogue/sync.mjs --force    # always download, extract, and compare
node src/catalogue/sync.mjs --apply    # … and write the safe part into src/web/data/question.json
node src/catalogue/check.mjs [--force]
node src/catalogue/extract.mjs [--pdf <path>]
node src/catalogue/compare.mjs
node src/catalogue/apply.mjs [--dry-run]
```

After `apply.mjs` wrote the question file, regenerate the split data and
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

When `GITHUB_OUTPUT` is set (GitHub Actions), `changed=true|false` and
`stand=<dd.mm.yyyy>` are appended to that file.

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
  answer text; when the four answers merely changed places, the `a`–`d` of
  every translation move along. If the correct answer text is not among the
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
- **new** official questions are not added (no solution, translations, or
  explanation yet) and **removed** ones are kept.

`output/review.md` lists everything that was held back, in a form a person
can act on (official text, current app text, proposed solution, reason).
`--dry-run` only reports. With `GITHUB_OUTPUT` set it appends `applied`
(changed questions) and `heldBack` (held back + new + removed). Exit `1` on
a missing input, an invalid applied entry (empty text, solution outside
`a`–`d`, changed `num`/`id`), or duplicate numbers before or after; nothing
is written in those cases. Applying the same proposal twice changes nothing.

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
- `report.md`, `review.md`, `question.proposed.json`, `issue-body.md`

Applied by `apply.mjs` (committed by the workflow together with the files
above): `src/web/data/question.json`, and – after `split-questions.js` –
`src/web/data/questions-core.json` and `src/web/public/data/`.

## GitHub Actions

`.github/workflows/sync-catalogue.yml` runs every Monday at 04:00 UTC and
on demand (`workflow_dispatch` with the boolean input `force`). It installs
`src/web` with `npm ci`, runs `check.mjs`, and – only when
`changed == 'true'` –

1. runs `extract.mjs`, `compare.mjs`, and `apply.mjs`, and uploads
   `report.md`, `review.md`, and `question.proposed.json` as the artifact
   `catalogue-review`;
2. when at least one question was applied, runs
   `node scripts/split-questions.js` and `npm test` in `src/web` – a red
   test suite stops the run and nothing is pushed;
3. stages `src/catalogue/state.json`, `src/catalogue/data/`,
   `src/web/data/question.json`, `src/web/data/questions-core.json`, and
   `src/web/public/data/`. When app data changed it bumps the patch
   version (`npm version patch --no-git-tag-version`, the Android
   `versionName`) and commits
   `catalogue: BAMF Gesamtfragenkatalog Stand <stand> (<n> questions aligned)`;
   when only the bookkeeping changed it commits
   `catalogue: record BAMF Gesamtfragenkatalog Stand <stand> [skip ci]` so
   that no release starts;
4. pushes to the branch the run was started on (`main` for the schedule)
   with the `PAT` secret (`actions/checkout` runs with
   `persist-credentials: false`; three attempts, rebasing on the latest
   branch in between). A push made with the repository's own
   `GITHUB_TOKEN` never starts other workflows, so without the `PAT`
   secret the commit lands but `vercel-deploy.yml` and
   `android-release.yml` do not run – the step prints a warning in that
   case. The committer comes from the `GIT_USER_NAME` / `GIT_USER_EMAIL`
   secrets, falling back to `github-actions[bot]`;
5. when questions were held back, opens one GitHub issue per `Stand`
   (title `catalogue: <n> question(s) from the BAMF Gesamtfragenkatalog
   Stand <stand> need a human`) with `review.md` as its body, cut at 60,000
   characters when needed. An open issue for the same `Stand` is not
   duplicated.

Secrets are passed through `env:` only and never printed. The workflow
needs `contents: write` and `issues: write`.

## Rules

- **Only `apply.mjs` writes into `src/web/`, and only the safe part.**
  `check`, `extract`, and `compare` write under `output/` and
  `src/catalogue/`; a question whose solution needs a judgement call keeps
  its app version until a person decides it in
  `src/web/data/question.json`.
- **Never invent solutions.** The PDF has no answer key. New questions get
  `solution: ""` and `needsReview: true` and are not added to the app.
- **Never renumber.** Learner progress is keyed by `num`; renumbering is an
  owner decision documented in the report, not a side effect. `apply.mjs`
  refuses duplicate numbers.
- **`question.json` is the single source of the shipped data.** Do not
  edit `questions-core.json` or `public/data/` by hand; regenerate them
  with `split-questions.js` and keep all three in the same commit. The
  retired scraper sync (`sync-question.yml`, manual only) overwrites
  `question.json` with a file that currently has duplicate numbers – do
  not run it.
- **GET only, no cookies.** The site is behind a WAF that rejects `HEAD`
  and sets session cookies. The scripts use plain and conditional `GET`
  with a descriptive User-Agent, a 60 s timeout and one retry, treat any
  redirect as a failure, and never store or print cookies or the landing
  page HTML.
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
  clients, or during maintenance). Retry later; if it persists from
  GitHub-hosted runners, run `sync.mjs` locally and open the pull request
  by hand.
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
- The workflow's test step is red – the applied data broke a test. Download
  the `catalogue-review` artifact, fix the data or the test on a branch,
  and re-run the workflow with `force`. Nothing was pushed.
- The push step warns `The PAT secret is missing` – the commit landed, but
  the deploy workflows did not start. Add the `PAT` secret (a token that
  may push to `main`) and run `vercel-deploy.yml` / `android-release.yml`
  by hand once.
- The issue body ends with "Cut here" – expected for long lists; download
  the `catalogue-review` artifact for the full `review.md`.
