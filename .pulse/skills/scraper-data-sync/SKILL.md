---
name: scraper-data-sync
description: Keep the app's bundled copies of the scraper's two data files - the BAMF evaluation status (src/web/data/current-evaluation.json, exam date and last check) and the exam centres (src/web/data/prüfstellen.json) - in step with what github.com/leben-in-deutschland/leben-in-deutschland-scrapper publishes; validate the download, write it, bump the patch version, run the web tests and commit one data commit. Public GETs, no credentials, never edits the data by hand. Use when a PULSE watch (evaluation-sync, pruefstellen-sync) reports a change, when asked to sync the evaluation status or the Prüfstellen, or when the home page's "last checked" date is stale.
---

# Scraper data sync

Two small JSON files the app ships are collected elsewhere: the
[scraper repository](https://github.com/leben-in-deutschland/leben-in-deutschland-scrapper)
reads BAMF's pages and publishes the result as static files. This skill
carries a new version of either file into the app. It replaced the GitHub
workflows `sync-evaluation.yml` and `sync-data.yml` on 2026-11-01; the
`scripts/scraper-sync.mjs` script does the mechanical part.

| Source | Bundled file | Published at | Changes |
| --- | --- | --- | --- |
| `evaluation` | `src/web/data/current-evaluation.json` | `.../data/current-evaluation.json` | Daily: `lastSyncAt` moves every time the scraper ran; `examDate` and `history` move every few weeks when BAMF reaches a later exam date |
| `pruefstellen` | `src/web/data/prüfstellen.json` | `.../data/prüfstellen.json` | Twice a month at most; the scraper re-scrapes the 16 state lists |

The home page shows `examDate` ("BAMF is evaluating tests taken on ...") and
`lastSyncAt` ("last checked"); the landing page's JSON-LD uses `lastSyncAt`
as `dateModified`. A stale bundled file makes the web site - which is static
- show an old "last checked" date; the Android app refreshes the evaluation
file itself once a day (`services/evaluation.ts`), the web and iOS do not.

## Boundary

- **Read-only, public, no credentials.** The script sends one `GET` to
  `raw.githubusercontent.com` and nothing else. No token, no login; never
  ask for one.
- **The scraper's file is the truth; never edit the data by hand.** When it
  looks wrong (an empty state, an impossible date) the fix belongs in the
  scraper repository, not here. Report it; do not patch the JSON.
- **The script validates before it writes.** The evaluation file must have
  the shape `isEvaluationData` in `src/web/utils/evaluation-store.ts`
  accepts; the centres file must hold 16 states with two-letter codes and
  may not shrink by more than half (a half-empty scrape is a failed scrape).
  A validation error is a reason to stop and report, not to bypass.
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
  committer.

## Procedure

1. Note the current SHA and `git status` as the
   rollback baseline. Node 22 or newer; no `npm install` is needed for the
   check or the write, `src/web/node_modules` only for the tests.
2. See what changed without writing anything:

   ```bash
   node scripts/scraper-sync.mjs evaluation --check
   node scripts/scraper-sync.mjs pruefstellen --check
   ```

   Nothing printed and exit 0 means the bundled file equals the published
   one: stop, report "up to date". Lines such as
   `lastSyncAt 31.10.2026 03:52:47 -> 01.11.2026 04:03:16` or
   `examDate 15.08.2026 -> 02.09.2026` are the change. Exit 1 means the
   download failed or is not the expected shape: report the message as it
   is, do not retry in a loop, do not fetch from another host.
3. Write the new file and bump the version:

   ```bash
   node scripts/scraper-sync.mjs evaluation      # or pruefstellen
   ```

   The script overwrites the bundled file with the download byte for byte,
   bumps the patch version, and prints the suggested commit message.
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
   `data: exam centres from the scraper (<n> centres)`).
6. Hand the branch to landing: as a PULSE job, finish normally (the runner
   lands kept commits); in a conversation, `pulse land --project
   leben-in-deutschland --branch <branch>`. The landing runs
   `scripts/check.sh`; a push to `main` deploys the web
   (`vercel-deploy.yml`), nothing else starts - the apps pick the new
   evaluation file up over the air or with their next hand-started release.
7. Report in plain words: which file, what moved (the lines from step 2),
   the new version, and the commit.

## Rollback

- Before the commit: `git restore src/web/data/current-evaluation.json
  src/web/data/prüfstellen.json src/web/package.json src/web/package-lock.json`.
- A landed commit: `git revert <sha>` (one commit holds the data and the
  version bump) and land the revert; the revert deploys the web again.
- Nothing external changed: `raw.githubusercontent.com` only answered a
  `GET`.

## References

- `scripts/scraper-sync.mjs` (download, validation, write, version bump),
  `scripts/watch-evaluation.sh`, `scripts/watch-pruefstellen.sh` (the PULSE
  watches)
- `.pulse/automations/evaluation-sync.yaml` (daily), `.pulse/automations/pruefstellen-sync.yaml` (weekly)
- `src/web/services/evaluation.ts` (the in-app refresh on Android),
  `src/web/utils/evaluation-store.ts` (the shape), `src/web/types/prüfstellen.ts`
- `AGENTS.md` (public-repository privacy rule, verification commands)
