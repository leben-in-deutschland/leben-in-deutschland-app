---
name: bamf-data-sync
description: Keep the app's two bundled BAMF data files - the evaluation status (src/web/data/current-evaluation.json, exam date and last check) and the exam centres (src/web/data/prüfstellen.json) - in step with bamf.de; scripts/bamf-data-sync.mjs reads the Einbürgerung page and the 16 state .xlsx files, validates, writes, bumps the patch version; then run the web tests and commit one data commit. Public GETs to bamf.de only, no credentials, never edits the data by hand. Use when a PULSE watch (evaluation-sync, pruefstellen-sync) reports a change, when asked to sync the evaluation status or the Prüfstellen, or when the home page's "last checked" date is stale.
---

# BAMF data sync

Two small JSON files the app ships come straight from bamf.de:
`scripts/bamf-data-sync.mjs` reads the public pages, turns them into the
app's shape, validates, writes and bumps the version. This skill is the
procedure around that script. Until 2026-11-02 a separate scraper
repository collected the same two files and the app downloaded its copies;
that repository is archived, and the script here reads the same sources it
read.

| Source | Bundled file | Read from | Changes |
| --- | --- | --- | --- |
| `evaluation` | `src/web/data/current-evaluation.json` | The Einbürgerung page: "Aktuell wertet das Bundesamt Tests bis Prüfungsdatum **dd.mm.yyyy** aus." | Daily: `lastSyncAt` is the time of the check; `examDate` and `history` move every few weeks when BAMF reaches a later exam date |
| `pruefstellen` | `src/web/data/prüfstellen.json` | One `Pruefstellen-XX.xlsx` per state (16 landing pages, 16 workbooks) | A few times a year; the whole list is read again every time |

The home page shows `examDate` ("BAMF is evaluating tests taken on ...") and
`lastSyncAt` ("last checked"); the landing page's JSON-LD uses `lastSyncAt`
as `dateModified`. A stale bundled file makes the web site - which is static
- show an old "last checked" date; the Android app refreshes the evaluation
file itself once a day from the app repository's `main`
(`services/evaluation.ts`), the web and iOS do not. The daily evaluation job
therefore runs every day the check reports a change, and the check reports a
change whenever the bundled "last checked" date is not today - that is the
owner's decision of 2026-11-02 (the former GitHub Action committed daily
too).

## Boundary

- **Read-only, public, no credentials.** The script sends plain `GET`
  requests to `www.bamf.de` and nothing else. No token, no login; never ask
  for one. bamf.de sits behind a web application firewall: never `HEAD`,
  never follow a redirect (the script treats a 3xx as failure), never print
  cookies or whole pages. The `User-Agent` names the project.
- **bamf.de is the truth; never edit the data by hand.** When the result
  looks wrong (an empty state, an impossible date, a shifted column) the fix
  belongs in `scripts/bamf-data-sync.mjs` and its tests, not in the JSON.
  Report it; do not patch the data.
- **The script validates before it writes.** The evaluation file must have
  the shape `isEvaluationData` in `src/web/utils/evaluation-store.ts`
  accepts; the centres file must hold 16 states with two-letter codes, every
  state at least one centre, and may not shrink by more than half (a
  half-empty scrape is a failed scrape). The exam date is accepted only
  inside a `c-service-box__container` next to the word "Prüfungsdatum"; a
  missing date is an error, never a guess. Columns of the workbooks are
  mapped by header text, not by position. A validation error is a reason to
  stop and report, not to bypass.
- **One data change is one patch release.** The web deploys from `main`;
  the apps read `package.json`'s version as `APP_VERSION` for their caches,
  and the Android and iOS releases take their `versionName` from it. The
  script bumps the patch version in `src/web/package.json` and
  `src/web/package-lock.json` together, without npm (npm 10 rewrites the
  lockfile in its own dialect; see the project memory).
- **Hard stops stay.** Landing on `main` goes through `pulse land`; the
  daemon pushes according to `landing.push`. Never `git push`, never `gh`.
- **Public repository.** Commit messages and posts carry no e-mail
  addresses, home paths or device names; the GitHub noreply address is the
  committer. The centres file holds the public contact data of institutions
  as bamf.de publishes it, nothing else.

## Procedure

1. Note the current SHA and `git status` as the rollback baseline. Node 22
   or newer; no `npm install` is needed for the check or the write (the
   script and its `.xlsx` reader use Node built-ins only),
   `src/web/node_modules` only for the tests.
2. See what changed without writing anything:

   ```bash
   node scripts/bamf-data-sync.mjs evaluation --check
   node scripts/bamf-data-sync.mjs pruefstellen --check     # 32 sequential GETs, about half a minute
   ```

   Nothing printed and exit 0 means the bundled file agrees with bamf.de:
   stop, report "up to date". Lines such as
   `lastSyncAt 01.11.2026 12:38:53 -> 02.11.2026 (today's check)`,
   `examDate 15.08.2026 -> 24.08.2026` or `by 119 -> 116 (+78 / -81)` are
   the change. Exit 1 means bamf.de did not answer, answered with the
   firewall's redirect, or the page or workbook is not the expected shape:
   report the message as it is, do not retry in a loop, do not fetch
   through another host.
3. Write the new file and bump the version:

   ```bash
   node scripts/bamf-data-sync.mjs evaluation      # or pruefstellen
   ```

   The script rewrites the bundled file, bumps the patch version, and
   prints the suggested commit message. Dates and times are Europe/Berlin.
4. Run the tests from the repository's own check:

   ```bash
   cd src/web && npm ci && npm test && npm run lint
   ```

   The tests derive their expected dates from the bundled file
   (`home-evaluation.test.tsx` was fixed on 2026-10-31 for exactly this), so
   a red suite after a data sync points at a test that hard-codes a fact
   from the data - fix the test to read the fact from the file, never the
   data to fit the test. A red suite for another reason: restore (Rollback)
   and report.
5. Commit the data file together with `src/web/package.json` and
   `src/web/package-lock.json`, nothing else, with the message the script
   printed (`data: BAMF evaluation status <examDate> (checked <date>)` or
   `data: exam centres from bamf.de (<n> centres)`).
6. Hand the branch to landing: as a PULSE job, finish normally (the runner
   lands kept commits); in a conversation, `pulse land --project
   leben-in-deutschland --branch <branch>`. The landing runs
   `scripts/check.sh`; a push to `main` deploys the web
   (`vercel-deploy.yml`), nothing else starts - the apps pick the new
   evaluation file up over the air or with their next hand-started release.
7. Report in plain words: which file, what moved (the lines from step 2),
   the new version, and the commit.

## When bamf.de changes its pages

The script knows two layouts: the service box with the exam date, and the
state landing page that links one `.xlsx` whose filled sheet has a header
row containing `PLZ`, `Ort`, `Name der Prüfstelle` (or `Namen der
Prüfstelle`), `Straße`, `Telefon`, `E-Mail` and, outside Berlin, `Kreis /
kreisfreie Stadt`. A value in `E-Mail` without `@` (a web address such as
`www.landratsamt-ansbach.de`) is written as `website` with `email` empty,
so the app never builds a `mailto:` link to a host. When a check exits 1 three runs in a row the daemon
queues a job to fix the watcher: read the error, fetch the page once with
the script's helpers (`src/catalogue/lib/http.mjs`), adjust the parser and
its tests in `src/web/__tests__/bamf-data-sync.test.ts`, and keep the
validation strict. `catalogue-source.md` in the `bamf-catalogue-sync` skill
describes the firewall.

## Rollback

- Before the commit: `git restore src/web/data/current-evaluation.json
  src/web/data/prüfstellen.json src/web/package.json src/web/package-lock.json`.
- A landed commit: `git revert <sha>` (one commit holds the data and the
  version bump) and land the revert; the revert deploys the web again.
- Nothing external changed: bamf.de only answered `GET` requests.

## References

- `scripts/bamf-data-sync.mjs` (scrape, validation, write, version bump),
  `scripts/lib/xlsx.mjs` (the dependency-free workbook reader),
  `.pulse/automations/evaluation-sync.sh`,
  `.pulse/automations/pruefstellen-sync.sh` (the PULSE watches)
- `.pulse/automations/evaluation-sync.yaml` (daily), `.pulse/automations/pruefstellen-sync.yaml` (weekly)
- `src/web/services/evaluation.ts` (the in-app refresh on Android),
  `src/web/utils/evaluation-store.ts` (the shape), `src/web/types/prüfstellen.ts`
- `AGENTS.md` (public-repository privacy rule, verification commands)
