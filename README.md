# Exam dates (generated)

`termine.json` on this branch is written by a script of the
[Leben in Deutschland app](https://github.com/leben-in-deutschland/leben-in-deutschland-app),
`src/termine/publish.mjs`, which runs every six hours:
`src/termine/sync.mjs` reads the public course pages of exam centres for the
Einbürgerungstest and the test "Leben in Deutschland" and stores, per
centre, the dates it lists and what the page says about places.

- The app and the website read this file; nothing here is edited by hand.
- Every date links to the exam centre's own page. That page is what counts:
  this file is not official and can be out of date.
- An exam centre that should not appear, or whose dates are read wrongly:
  see the contact in the [legal notice](https://www.lebenindeutschland.org/impressum).

How it works and how to add a centre: `src/termine/README.md` on `main`.
