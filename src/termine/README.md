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
  sync.mjs             Reads every source, validates, writes termine.json
  publish.mjs          One run of the automation: reads what is published, runs sync.mjs, pushes the file as one commit to the `data` branch
  discover.mjs         Maintenance tool: finds each of BAMF's exam centres' website and the page with its test dates -> output/candidates.json; --merge adds them to sources.json
  sources.json         COMMITTED: the registry - one entry per exam centre: id, state, town, name, adapter, page
  web-registry.mjs     Writes the website's copy of the registry (src/web/data/termine-registry.json); --check says whether it is up to date
  data-branch.md       README of the `data` branch; publish.mjs puts it there with every commit
  adapters/kufer.mjs   Kufer (KuferWEB): the course system of most Volkshochschulen
  adapters/item.mjs    ITEM (vhs-cms): many Bavarian and some other Volkshochschulen
  adapters/cmx.mjs     cmx (cmxOrganize): Volkshochschulen in Bavaria, Baden-Württemberg and Rhineland-Palatinate
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
live pages; nothing touches the network) and `termine-publish.test.ts` (what
a run leaves on the `data` branch; a bare repository in a temporary folder
is the remote).

## Rules

- **Polite reading.** Public pages only, `GET` only, no login, no cookie
  kept, nothing posted. One page per centre and run, at most four runs a
  day. The `User-Agent` is `LebenInDeutschlandTermine/1.0` with the address
  of the page that explains it. `robots.txt` is read in every run; a centre
  that closes the page to this crawler (or to `*`) is not read. A redirect
  to another site is a failure for the sync, not followed: a source must
  not move to another site unseen. Only the discovery tool follows one, to
  learn where a centre's website is.
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
  and exits 1, and so does a run in which no source answers at all.
- **A centre can opt out.** Remove its entry from `sources.json` and run
  `node src/termine/web-registry.mjs`; the legal notice of the website has
  the contact. The deploy of that change takes the centre off the website's
  pages, the next run off the published file.

## Commands

Run everything from the repository root.

```bash
node src/termine/sync.mjs                         # read every source -> src/termine/output/termine.json
node src/termine/sync.mjs --out FILE --previous FILE
node src/termine/sync.mjs --only by-vhs-kisshab   # look at one source; prints its result, writes nothing
node src/termine/publish.mjs --dry-run            # one run of the automation without the push (reads every source)

node src/termine/discover.mjs --new --cache /tmp/termine-cache    # every exam centre of BAMF's list that is not a source yet
node src/termine/discover.mjs --state by --cache /tmp/termine-cache
node src/termine/discover.mjs --host vhs-calw.de                  # by the domain of BAMF's address, also when the website is another
node src/termine/discover.mjs --merge             # candidates -> sources.json (existing entries stay; candidates with "check" wait)
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

The Hive automation `.hive/automations/termine-sync.yaml` is a watch: the
daemon runs its script every six hours, without a model. The script calls
`publish.mjs`, and one run does this:

1. It reads what is published - the **`data` branch**, from the
   repository's public address, without a login. A file younger than three
   hours ends the run: four reads a day at most, also when somebody starts
   a run by hand shortly after a scheduled one.
2. `sync.mjs` reads the centres, with the published file as `--previous`.
3. The new `termine.json` and the branch's README become one commit on top
   of the published one, and `git push origin <commit>:refs/heads/data`
   publishes it. Nothing else is ever pushed, and never with force. Nothing
   lands on `main`, nothing is built or deployed.

- The apps download
  `https://raw.githubusercontent.com/leben-in-deutschland/leben-in-deutschland-app/data/termine.json`
  (`src/web/services/termine.ts`), at most once an hour and only when the
  exam dates are open or a centre is watched.
- The website asks its own origin, `/live/termine.json`; `src/web/vercel.json`
  rewrites that to the same raw file, so the browser talks to no third
  party.

What a run says goes to standard error: `hive schedule log SCHED-NNN` shows
the last run, `hive schedule list --project leben-in-deutschland` the
schedule and its state. Nothing is printed on standard output - Hive gives
a watch that prints there an agent job.

- **The read fails** (most centres silent, a file of the wrong shape, a
  crash): exit 1. Nothing is published and the published file stays.
- **The push is refused**: exit 1 as well; the dates were read and are not
  published. The push uses the git login of the checkout the daemon runs
  the script in - the one a `git push` typed there would use. Hive gives a
  script no credential of its own.
- **Another run published while this one was reading**: nothing to do,
  exit 0.
- **The published branch cannot be reached** (the machine is offline):
  nothing is read, exit 0.

Hive marks the watcher broken at the first exit 1 and sends an agent after
three in a row. While nothing is published the file ages, and the app
shows a centre whose last read is older than 36 hours as not confirmed.

By hand, in a checkout with push rights: `node src/termine/publish.mjs
--dry-run` reads the centres and builds the commit without pushing; without
`--dry-run` it publishes; `--even-if-fresh` reads although the published
file is young. `hive schedule run SCHED-NNN` makes the automation due at
once; the six hours then count from that run.

## What the pages say before the dates arrive

The dates reach a page after it has loaded, so the page as it is built holds
none. What it does hold is the registry: `/termine` and `/termine/<STATE>`
get the centres from `src/web/data/termine-registry.json`. Until the dates
arrive, and when they cannot be loaded, the overview lists the states with
the towns of their centres, and a state's page lists its centres with the
link to each centre's own page. That is also what a search engine reads
that runs no script; each page has its own title, canonical address, link
preview and breadcrumbs (`src/web/app/termine/[[...state]]/page.tsx`).

The website is built from `src/web` alone, so that file is a copy of
`sources.json` without the adapter:

```bash
node src/termine/web-registry.mjs           # write the copy
node src/termine/web-registry.mjs --check   # exit 1 when it is out of date
```

Run it after every change to `sources.json` (`discover.mjs --merge` does it
by itself); the registry test fails when the copy is out of date. The change
reaches the pages with the next deploy of `main`. The apps leave the lists
out: an installed app would show the registry of its release, not today's.
An app ships the built page as the website has it, so the lists are in its
files and show for the moment before the page has started, like the
website's header and footer; a centre that left the registry is gone from
there with the next app release.

## Adding an exam centre

BAMF lists a mail address for every centre, not a website. `discover.mjs`
starts at the domain of that address and, where it lists no test date,
looks for the centre's website:

- **The address redirects** (`vhs.essen.de` to `vhs-essen.de`): the tool
  follows it. That is the centre's own word and needs no further proof.
- **A Volkshochschule under its town hall or district**
  (`...@bielefeld.de`, `...@kreis-offenbach.de`): the tool follows the
  town's link to a host that carries the school in its name
  (`vhs-bielefeld.de`, `vhs.oberhavel.de`, `kvhs-harburg.de`) - from the
  start page, or from the town's own page about the school - and it tries
  the usual names (`vhs-<town>.de`, `vhs.<town>.de`,
  `volkshochschule-<town>.de`) and the town's website (`<town>.de`).
- **Such a website counts only when it names the centre**: its postcode,
  or - behind a town's link - its town. Two guessed names stay in the
  report with `"check"` and are not merged: a website that names the town
  but not the postcode (towns share names), and a guessed website for a
  district's school ("Kreisvolkshochschule", "VHS des Landkreises ...":
  `vhs-<town>.de` is the school of the town it sits in). Look at such a
  website; when it is the centre's, delete `"check"` in
  `output/candidates.json` and merge.

On a website it reads robots.txt, the start page and at most five further
pages: the keyword search of a Kufer site (its search form, the usual
address `?kathaupt=26...` of the current template, `/kw/kathaupt/18/...`
of the older one), the links that name the test, the site's own search
form when it asks with GET, and the parts of the programme where the test
usually stands ("Deutsch und Integration", "Prüfungen"). Nothing is
posted, so a site whose search is a POST form is searched by its links
only.

1. `node src/termine/discover.mjs --host <domain of BAMF's address> --cache /tmp/termine-cache`
   and read `output/candidates.json`: the website (`website`, `via` when it
   is not the address's domain), the page, the adapter, how many test
   dates, three samples - or `note` and `looked`: why there is none and
   which other websites were looked at.
2. When the samples are the centre's real test dates - not a preparation
   course, not a year-long entry without a day ("Einbürgerungstests
   2026/2027", 01.01.) - `node src/termine/discover.mjs --merge`. For a
   centre the tool does not find, add the entry by hand:

   ```json
   { "id": "nw-vhs-beispiel", "state": "NW", "city": "Beispielstadt", "name": "VHS Beispielstadt", "adapter": "kufer", "url": "https://www.vhs-beispiel.de/kurssuche?kathaupt=26&suchesetzen=false&kfs_stichwort_schlagwort=Einb%C3%BCrgerungstest" }
   ```

3. `node src/termine/sync.mjs --only <id>` shows what the sync reads.
4. After an entry added or changed by hand:
   `node src/termine/web-registry.mjs` renews the website's copy.
5. `cd src/web && npm test` (the registry test checks ids, adapters,
   addresses and that the website's copy is up to date).

The id is the state code plus the domain of the website that is read,
without its ending; it is what a learner's watch list stores, so it never
changes once published. Town and name are BAMF's. One entry differs: BAMF
lists the school of Goch (postcode 47574) under "Kleve", its district;
the registry names Goch and keeps Kleve as a further town.

## When a page changes

A source that stops being read shows up in the run's log
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
`recognises(html)`, registered in `adapters/index.mjs`.

BAMF lists 663 centres under 600 addresses. At the start (2026-11-22) two
adapters read 111 of them. A second look on 2026-11-25 - the school's
website behind a town's address, the wider search, the card and accordion
templates of Kufer and ITEM, the cmx adapter - brought the registry to
226. Of the other addresses, 96 lead to a website in a system the tool
reads that lists no test date online (registration in person, "currently
no dates"), 189 to a website no adapter knows - among them the systems
of Bonn, Gelsenkirchen and Pforzheim (VhsConnect), Stuttgart's own
template and the Berlin districts - and 80 to no website the tool finds.
No centre is read in Berlin, Bremen, Mecklenburg-Vorpommern and
Schleswig-Holstein.

## Rollback

- A wrong date or a centre that must go: remove or fix its entry in
  `sources.json` and run `node src/termine/web-registry.mjs`; the deploy of
  that change rebuilds the website's pages without it, and the next run
  publishes the file without it.
- A bad run on the `data` branch: `git revert` the commit there (or wait for
  the next run, which rewrites the file).
- No more reads: `paused: true` in `.hive/automations/termine-sync.yaml`.
  The published file then ages, and after 36 hours the app shows its dates
  as not confirmed.
- The whole feature: delete the `data` branch as well; the page then says
  that the dates could not be loaded and links the list of exam centres.
  Nothing on `main` depends on the file.
