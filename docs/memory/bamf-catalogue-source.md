---
id: MEM-009
title: The Official BAMF Question Catalogue - How to Read It and What It Cannot Tell You
date: 2026-10-12
tags: [memory, data, questions, bamf, http, privacy]
---

# Memory: The Official BAMF Question Catalogue - How to Read It and What It Cannot Tell You

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
4. **The official numbering is not the app's numbering.** Only 4 of the
   300 general questions share a number, and learner progress is keyed by
   `num` (ADR-006). Never auto-merge the official catalogue into
   `src/web/data/question.json`, never renumber in a script; the pipeline
   writes a report and a proposal, and the owner merges.
5. **Pictures carry credits** such as "© Deutscher Bundestag/Achim Melde".
   Extracted images stay in the git-ignored `src/catalogue/output/images/`;
   publishing them is a separate decision.
6. **A push to `main` is a release.** `android-release.yml` and
   `vercel-deploy.yml` run on every push to `main`, so the catalogue
   workflow commits to `catalogue/bamf-<stand>-<run id>` and opens a pull
   request instead; the owner must allow Actions to create pull requests
   once in the repository settings.

## When To Apply

- Before changing anything under `src/catalogue/` or
  `.github/workflows/sync-catalogue.yml`.
- When `check.mjs` reports `changed=true` but the counts in `extract.mjs`
  fail: the PDF layout changed; fix the parser, do not hand-edit the JSON.
- When someone proposes to "just copy" the proposal into the app, to fetch
  the catalogue from the app at runtime, or to renumber questions.
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
- In 2025 about 384 of the 460 official question stems matched the app's
  texts exactly; the rest were reworded. Expect the first report to be long
  and the following ones short.
- The only dependency is `pdfjs-dist`, a devDependency of
  `src/web/package.json`, loaded from `src/web/node_modules`; the app bundle
  does not include it and makes no request to bamf.de.
