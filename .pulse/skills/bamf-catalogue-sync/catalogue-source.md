---
title: The Official BAMF Question Catalogue - How to Read It and What It Cannot Tell You
date: 2026-10-12
tags: [memory, data, questions, bamf, http, privacy]
---

# The Official BAMF Question Catalogue - How to Read It and What It Cannot Tell You

Support file of the `bamf-catalogue-sync` skill; `SKILL.md` beside it says
when to read this.

## Lesson

The official source for the test questions is the BAMF PDF
"Gesamtfragenkatalog zum Test 'Leben in Deutschland' und zum
'Einbürgerungstest'" at
`https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.pdf`
(the HTML landing page) and the same URL with `?__blob=publicationFile`
(the file). Six facts decide how it is read (ADR-009, `src/catalogue/`):

1. **bamf.de is behind an Airlock web application firewall.** `HEAD` is
   rejected with a `303` to an error page. `GET` works, and a conditional
   `GET` with `If-None-Match` / `If-Modified-Since` answers `304` with no
   body. Some `200` answers arrive **without** `ETag` and `Last-Modified`;
   when the bytes are unchanged, keep the stored validators instead of
   overwriting them with `null`, or every following check downloads the
   full 9 MB again. Never use `HEAD` to "just check"; never store or print
   the cookies the firewall sets. The repository and its Actions logs are
   public.
2. **There are three "last updated" signals, and they do not agree.**
   The landing page shows `Datum` (`26.05.2025` in 2025) and links the file
   with `&v=<n>` (BAMF's version counter, `v=23`); the PDF title ends in
   `Stand: <date>` (`07.05.2025`); the server sends `Last-Modified`
   (`03 Sep 2025` for that same file) and an `ETag`. Trust `ETag` and
   `Last-Modified` to decide whether the bytes changed; treat `Datum` and
   `v` as hints that force a download when they move even though the file
   answered `304`; show `Stand` to humans as the edition name.
3. **The PDF has no answer key.** It lists 300 general questions
   (`Teil I`, Aufgabe 1-300) and 16 x 10 state questions (`Teil II - Fragen
   für das Bundesland <Name>`), each with exactly four checkbox answers,
   about 43 of them with pictures. Solutions can only be carried over from
   the app's current data by matching answer texts; anything else is a
   human review (`needsReview: true`). Never invent a solution.
4. **The official numbering is not the app's numbering.** Only 143 of the
   460 questions share a number, and learner progress, review schedules,
   explanations (`public/data/context/*.json`), and translations
   (`public/data/translations/*.json`) are all keyed by `num` (ADR-006).
   Never renumber in a script. The pipeline applies only entries whose
   solution follows an exact answer-text match (`apply.mjs`) and keeps
   `num` and `id`; everything else is held back for the owner (ADR-009,
   amendment of 2026-10-12).
5. **Pictures carry credits** such as "© Deutscher Bundestag/Achim Melde".
   Extracted images stay in the git-ignored `src/catalogue/output/images/`;
   publishing them is a separate decision.
6. **A push to `main` is a web release.** `vercel-deploy.yml` runs on
   every push to `main` (`src/catalogue/**` is not in its `paths-ignore`).
   The apps need no build for a catalogue change: they download
   `questions-core.json` over the air; `android-release.yml` and
   `ios-release.yml` are started by hand. Catalogue commits therefore bump
   the patch version when app data changed and reach `main` through
   `pulse land`, which the daemon pushes (`landing.push`). Until 2026-11-01
   this was a GitHub workflow pushing with a `PAT` secret, because a push
   made with a workflow's own `GITHUB_TOKEN` never triggers other
   workflows; the daemon's push is an ordinary push and does trigger them.
7. **`question.json` can silently drift from the shipped files.**
   `questions-core.json` and `public/data/` are generated from
   `src/web/data/question.json` by `split-questions.js`, but nothing
   enforces that they were regenerated. In December 2025 the scraper commit
   `227846e` landed on `main` after the Next.js 16 upgrade `ed7efbe` and
   overwrote `question.json` with a file carrying 68 duplicate numbers,
   while the generated files from `ed7efbe` stayed correct; the drift went
   unnoticed until `apply.mjs` regenerated the split files and 84 tests
   failed. The repair was `git show ed7efbe:src/web/data/question.json`
   (its split output equals the shipped files byte for byte). Rules: treat
   the file whose `split-questions.js` output equals the shipped core as
   the truth, commit all three together, and let `apply.mjs` refuse
   duplicate numbers. The scraper's `question.json` has 100 duplicate
   numbers – never copy it into the app again (the workflow that did,
   `sync-question.yml`, was removed on 2026-11-01; the official PDF is the
   only source of questions now).
8. **Tests must not hardcode catalogue facts.** The practice-screen test
   assumed "a is correct for question 1"; adopting the official answer
   order moved it to `d`. Look the solution up from `questionsData()`
   instead of hardcoding letters, counts, or texts that the catalogue can
   change.
9. **Translations are keyed by letter, not by text.** Each question's
   `translation.<lang>.a`–`d` sits under the letter of the German answer it
   translates, and the practice screen's translation panel shows them by
   letter. When the official answer order is adopted, every translation
   letter must move with its answer - also when BAMF reworded that answer
   (gender pairs swapped, "schwarz-gelb" → "schwarz-gold"). The first apply
   on 2026-10-12 moved them only when all four answers matched verbatim
   and left 44 questions (for example 15, 109, 149, HB-5, ST-5) with
   translations under the wrong letter until 2026-11-01. Explanations
   (`context`) that name a letter ("Option b, freie Wahlen") are free text:
   no script rewrites them, so 19 of them still name the pre-2026-10-12
   letter; that is an owner edit, not a pipeline step.

## When To Apply

- Before changing anything under `src/catalogue/`,
  `.pulse/automations/bamf-catalogue-sync.sh` or
  `.pulse/automations/bamf-catalogue-sync.yaml`.
- When `check.mjs` reports `changed=true` but the counts in `extract.mjs`
  fail: the PDF layout changed; fix the parser, do not hand-edit the JSON.
- When someone proposes to apply a `needsReview` entry without the owner,
  to fetch the catalogue from the app at runtime, or to renumber questions.
- When something other than `pulse land` wants to put a catalogue commit on
  `main`: the hard stops forbid an agent's `git push` and `gh`.
- Before touching `src/web/data/question.json`, `questions-core.json`, or
  `public/data/` separately.
- When writing a scraper or checker for any other bamf.de document: same
  firewall, same `GET`-only rule.

## Notes

- The official sample test sheets (Musterfragebogen) live under the same
  path: `musterbogen_einbuergerungstest.html` and
  `musterbogen_lebenindeutschland.html`. Each is a 14-15-page
  "Testfragebogen" with a cover, an instruction page (33 questions, four
  options, exactly one correct, cross the box, 60 minutes), "Frage 1" to
  "Frage 33" with checkboxes and no letters, the 3 state questions mixed in,
  and a signature page. The mock exam follows that shape (FEAT-009); the
  PDFs are linked, not bundled.
- In 2025 about 349 of the 460 official questions were identical to the
  app's texts after normalisation and 111 reworded; 283 listed the same
  answers in another order. The first `apply.mjs` run aligned 346
  questions (240 answer orders, 303 solution letters, 106 answer texts, 35
  stems) and held back 54. Expect the following runs to be short.
- The only dependency is `pdfjs-dist`, a devDependency of
  `src/web/package.json`, loaded from `src/web/node_modules`; the app bundle
  does not include it and makes no request to bamf.de.
