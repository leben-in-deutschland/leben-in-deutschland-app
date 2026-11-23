# Exam dates (Termine)

Reads the test dates for the *Einbürgerungstest* and the test *Leben in
Deutschland* from the exam centres' own public course pages, a few times a
day, and writes them as one file for the app: per centre the dates it lists
and what its page says about places. The app shows them on `/termine` and
tells a learner when a centre they watch has a new date or a place that
became bookable (decision ADR-050, feature FEAT-023, plan PLAN-014).

Nothing here is official. Every date links to the exam centre's page, and
that page is what counts.

## What this is

A small, self-contained pipeline in plain Node 22 ESM scripts, in the style
of `src/catalogue/`. No npm dependency, only Node built-ins (`fetch`,
`TextDecoder`, `node:fs`).

```text
src/termine/
  sync.mjs             Reads every source, validates, writes termine.json (the scheduled workflow runs this)
  discover.mjs         Maintenance tool: finds the page with the test dates for BAMF's exam centres -> output/candidates.json; --merge adds them to sources.json
  sources.json         COMMITTED: the registry - one entry per exam centre: id, state, town, name, adapter, page
  data-branch.md       README of the `data` branch, copied there by the workflow
  adapters/kufer.mjs   Kufer (KuferWEB): the course system of most Volkshochschulen
  adapters/item.mjs    ITEM (vhs-cms): many Bavarian and some other Volkshochschulen
  adapters/index.mjs   The adapters by name
  lib/http.mjs         Polite GET: User-Agent, timeout, size limit, redirects only within the site, the page's own charset
  lib/robots.mjs       robots.txt (RFC 9309): the group that names this crawler, longest match, wildcards
  lib/html.mjs         Entity decoding, quote-aware tag stripping, text of an element; bounded on pages that never close a tag
  lib/dates.mjs        German dates and times -> "YYYY-MM-DD" and "HH:MM"; the exam day apart from the days of registration; "today" in Germany
  lib/status.mjs       A page's words or booking classes -> free, few, waitlist, full, soon, closed, unknown
  lib/courses.mjs      Which courses are the test itself; the shape of a date
  output/              IGNORED: candidates.json, a local termine.json
```

Tests: `src/web/__tests__/termine-pipeline.test.ts` (fixtures shaped like the
live pages; nothing touches the network).

## Rules

- **Polite reading.** Public pages only, `GET` only, no login, no cookie
  kept, nothing posted. One page per centre and run, at most four runs a
  day. The `User-Agent` is `LebenInDeutschlandTermine/1.0` with the address
  of the page that explains it. `robots.txt` is read in every run; a centre
  that closes the page to this crawler (or to `*`) is not read. A redirect
  to another site is a failure, not followed.
- **Never invent availability.** A date is `free` or `few` only when the
  centre's page says a place can be booked. A negation ("nicht", "kein",
  "nur"), a count of none ("0 freie Plätze"), a condition with a day in it
  ("Anmeldung möglich vom 01.12. bis 15.12."), a pointer to the course text
  or no word at all is never `free`: it is `full` when the text says so
  ("keine Restplätze"), `soon` when registration starts later ("ab 01.12.
  buchbar"), `unknown` otherwise. "Keine Anmeldung möglich" is `unknown`,
  not `closed`: most centres take registrations for this test in person,
  and their web shop says exactly that about it. A title, or the tooltip
  of a link to the course, may say `full`, `closed` or `waitlist`
  ("Einbürgerungstest - AUSGEBUCHT"), never `free`.
- **A light belongs to its own course.** Blocks are cut at the template's
  markers or table rows. Without them, a block is the container the course
  sits in (a card, a row, a list item), whatever comes first in it. Where
  the structure does not say whose a traffic light is - a legend, lights
  between two cards - it is not read, and the date is `unknown`.
- **The exam day, not a day of registration.** "Anmeldeschluss: Fr.
  08.01.2027" is the deadline, "Anmeldung ab 04.12.2026" the start of
  registration; neither is the test. A date printed without a year counts
  only with a weekday that fits a nearby year, and two digits are a year
  only when that weekday agrees. What cannot be read is dropped, not
  guessed.
- **The test, not courses about it.** Preparation courses, the test that
  ends an integration or orientation course (for its participants only)
  and appointments to register are dropped (`isExamTitle`).
- **Facts and a link.** Day, time, booking state, the centre's title of the
  date, the place, the link. No description text is stored.
- **A failed read is shown as such.** A source that cannot be read keeps the
  dates of its last good read for three days (`ok: false`, the old
  `checkedAt`); then they are dropped. A page in the site's layout that
  lists no course at all, while dates ahead are known for the centre, is a
  failed read too ("no course found on the page"): a maintenance page or a
  changed link shape must not wipe the dates at once. A run in which fewer
  than half of the sources that answered last time answer writes nothing
  and exits 1.
- **A centre can opt out.** Remove its entry from `sources.json`; the legal
  notice of the website has the contact.

## Commands

Run everything from the repository root.

```bash
node src/termine/sync.mjs                         # read every source -> src/termine/output/termine.json
node src/termine/sync.mjs --out FILE --previous FILE
node src/termine/sync.mjs --only by-vhs-kisshab   # look at one source; prints its result, writes nothing

node src/termine/discover.mjs --cache /tmp/termine-cache          # every exam centre of BAMF's list
node src/termine/discover.mjs --state by --cache /tmp/termine-cache
node src/termine/discover.mjs --host vhs-calw.de
node src/termine/discover.mjs --merge             # candidates -> sources.json (existing entries stay)
```

`sync.mjs` prints one line on stdout
(`111 of 111 centres read, 108 list a date; 335 dates, 87 bookable`) and
what happened per source on stderr. Exit 1 when the registry or the result
is not valid, or when most sources are silent.

## The file

```jsonc
{
  "version": 1,
  "generatedAt": "2026-11-22T05:41:03.510Z",
  "centres": [
    {
      "id": "by-vhs-kisshab",                // from the centre's domain; never changes
      "state": "BY",
      "city": "Bad Kissingen",
      "name": "Städtische Volkshochschule Bad Kissingen und Hammelburg",
      "plz": "97688",
      "towns": ["Bad Kissingen", "Hammelburg"],   // only when the centre serves several
      "url": "https://www.vhs-kisshab.de/p/integration/einbuergerungstest-675-CAT-KAT77",
      "checkedAt": "2026-11-22T05:41:03.510Z",    // last successful read; null when it never answered
      "ok": true,                                  // false: the last read failed, slots are from checkedAt
      "slots": [
        {
          "id": "2627405KG",               // the centre's course number
          "date": "2026-12-03",
          "time": "14:30",                 // optional, also "until"
          "status": "free",                // free | few | waitlist | full | soon | closed | unknown
          "booking": "inperson",           // optional: online | inperson | phone | written
          "title": "Einbürgerungstest 7-26",
          "place": "Bad Kissingen",        // optional
          "deadline": "2026-11-12",        // optional: last day to register
          "url": "https://www.vhs-kisshab.de/p/integration/einbuergerungstest/einbuergerungstest-7-26-675-C-2627405KG"
        }
      ]
    }
  ]
}
```

`validateTermine` in `sync.mjs` is the shape; `isTermineData` and
`sanitizeTermine` in `src/web/utils/termine-store.ts` are what the app
accepts (a state it does not know becomes `unknown`). A change that older
app versions could not read needs a new `version` and a new file name.

## How it runs

`.github/workflows/termine-sync.yml` runs `sync.mjs` four times a day
(05:17, 09:17, 13:17, 17:17 UTC) and by hand (`workflow_dispatch`), with
the published file as `--previous`, and commits the result as
`termine.json` to the **`data` branch** with the workflow's own token. No
secret, nothing on `main`, no build, no deploy.

- The apps download
  `https://raw.githubusercontent.com/leben-in-deutschland/leben-in-deutschland-app/data/termine.json`
  (`src/web/services/termine.ts`), at most once an hour and only when the
  exam dates are open or a centre is watched.
- The website asks its own origin, `/live/termine.json`; `src/web/vercel.json`
  rewrites that to the same raw file, so the browser talks to no third
  party.

A failed run changes nothing: the published file stays, GitHub reports the
failed workflow.

## Adding an exam centre

1. `node src/termine/discover.mjs --host <domain> --cache /tmp/termine-cache`
   and read `output/candidates.json`: the page, the adapter, how many test
   dates, three samples.
2. When the samples are the centre's real test dates,
   `node src/termine/discover.mjs --merge`. For a centre the tool does not
   find (its mail domain is not its website, or its dates sit on a page the
   start page does not link), add the entry by hand:

   ```json
   { "id": "nw-vhs-beispiel", "state": "NW", "city": "Beispielstadt", "name": "VHS Beispielstadt", "adapter": "kufer", "url": "https://www.vhs-beispiel.de/kurssuche?kathaupt=26&suchesetzen=false&kfs_stichwort_schlagwort=Einb%C3%BCrgerungstest" }
   ```

3. `node src/termine/sync.mjs --only <id>` shows what the sync reads.
4. `cd src/web && npm test` (the registry test checks ids, adapters and
   addresses).

The id is the state code plus the centre's domain without its ending; it is
what a learner's watch list stores, so it never changes once published.

## When a page changes

A source that stops being read shows up in the workflow log
(`! by-vhs-x: the page is not a kufer course list any more`, or
`! by-vhs-x: no course found on the page`) and in the file (`ok: false`).
Fetch the page once with `--only`, find what moved, fix the adapter and
add the new shape to the fixtures in `termine-pipeline.test.ts`. Keep the
rules above: when a page stops saying whether a place is left, the answer
is `unknown`.

Before a change to an adapter or to `lib/` goes in, read the same pages
with the old and the new code and look at every difference:
`discover.mjs --cache DIR` keeps the pages, so this costs the websites
nothing. Fixtures show that a rule works; only real pages show what else
it touches (a tighter tag pattern once stopped matching tags with an
inline image in them).

A page is at most 3 MB, and the tag patterns are bounded, so a page that
never closes its tags or quotes costs seconds, not the run.

A new course system is one module in `adapters/` with
`parse(html, pageUrl, { today }) -> { recognised, courses }` and
`recognises(html)`, registered in `adapters/index.mjs`. At the start
(2026-11-22) the two adapters read 111 of the 663 centres BAMF lists; 107
centres have a mail domain that is not their website, and about 270
websites run a system no adapter knows yet.

## Rollback

- A wrong date or a centre that must go: remove or fix its entry in
  `sources.json`; the next run publishes the file without it.
- A bad run on the `data` branch: `git revert` the commit there (or wait for
  the next run, which rewrites the file).
- The whole feature: disable the workflow in the repository's Actions
  settings; the page then says that the dates could not be loaded and links
  the list of exam centres. Nothing on `main` depends on the file.
