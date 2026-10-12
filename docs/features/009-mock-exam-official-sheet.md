---
id: FEAT-009
title: Mock Exam Shaped Like the Official Test Sheet
status: Done
date: 2026-10-12
tags: [feature, web, android, mock, ui]
---

# FEAT-009: Mock Exam Shaped Like the Official Test Sheet

Plan: [`PLAN-013`](../plans/PLAN-013-official-catalogue-and-musterbogen.md).
Related decision: [`ADR-009`](../decisions/ADR-009-official-bamf-catalogue-source.md)
(official sources instead of third-party ones).

## Problem

In the real test a learner gets a paper sheet, the "Testfragebogen". It
starts with a cover and an instruction page, numbers the questions
"Frage 1" to "Frage 33", shows a small box in front of every answer instead
of letters, and mixes the three state questions in among the general ones.
The app's mock exam asks the same number of questions in the same time, but
it looks like a practice session: catalogue numbers and topic chips on every
question, A-D letters on the answers, the state questions always at the
end, and the clock starts the moment "Start" is pressed. Learners should
rehearse the sheet they will actually hold. BAMF publishes one sample sheet
per test, which the app should point to.

## Behaviour

- **Links to the official sample sheets.** The mock-exam intro gets a
  section with the two official sample sheets, "Musterfragebogen
  Einbürgerungstest"
  (`https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/musterbogen_einbuergerungstest.html`)
  and "Musterfragebogen Leben in Deutschland"
  (`https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/musterbogen_lebenindeutschland.html`).
  Both open bamf.de in a new tab; inside the Android app they open the
  system browser. The PDFs are not bundled.
- **Cover and instructions before the clock.** Pressing "Start" no longer
  starts the exam. It shows a cover and instruction screen modelled on the
  sample sheet: the title of the chosen test type ("Einbürgerungstest" or
  "Leben in Deutschland"), the word "Testfragebogen", the learner's
  Bundesland, "33 questions", "60 minutes" or "timer off" when the learner
  switched the timer off, the pass mark (17 or 15 of 33), today's date, and
  the instructions in the app's own words: four answers, exactly one is
  correct, mark the box in front of the answer. The example question
  "Wie viele Tage hat die Woche?" is shown with "7" marked, and a note says
  that a tap on another answer moves the cross (there is no paper-style
  correction rule). The clock starts only when the learner presses
  "Begin test". Leaving the cover screen starts nothing and records nothing.
- **Running exam.** Each question is headed "Frage N" (1 to 33) without
  the catalogue number and without topic chips. Answers show a checkbox
  marker instead of the A-D letters; a selected answer shows the box
  crossed. The keyboard shortcuts 1-4 (and a-d) still pick an answer, the
  arrow keys still move, and the flag key still flags. The header shows the
  name of the test type instead of a generic title. The timer, the question
  map, flagging, and the leave-exam confirmation behave as before.
- **Mixed order.** The 3 state questions are shuffled in among the 30
  general ones, as on the sheet, instead of being appended at the end. The
  set is still 30 general plus 3 state questions, picked without duplicates.
- **Unchanged.** Results, the review of a finished exam, practice sessions,
  and progress are untouched; a stored mock result has the same shape as
  before. Every new text exists in German and English.

## Out of Scope

- The classic (2.0) design; it keeps its own mock test.
- Bundling the sample-sheet PDFs or rendering them in the app.
- Imitating the paper correction rules (filling a box completely to undo a
  cross, re-marking a corrected box); a tap simply moves the cross.
- Exam and sheet numbers from the cover; the app has none.
- Changing the number of questions, the duration, or the pass marks.

## Acceptance

- [x] The intro shows both sample-sheet links; on the web they open bamf.de
      in a new tab.
- [ ] In the Android app the links open the system browser (same plain
      anchor pattern as the home notice card; not yet confirmed on a device).
- [x] "Start" shows the cover with the test type title, "Testfragebogen",
      Bundesland, 33 questions, 60 minutes or "timer off", pass mark, date,
      instructions, and the marked example; no time elapses and no result is
      recorded until "Begin test".
- [x] "Begin test" starts the clock; questions are headed "Frage 1" to
      "Frage 33" without catalogue number or topic chips; answers show
      checkbox markers and no letters; the header shows the test type name.
- [x] Keys 1-4 and a-d select answers, arrow keys navigate, the flag key
      flags.
- [x] With a seeded random, the exam contains 30 general and 3 state
      questions and the state questions are not all at the end.
- [x] Results, review, practice, progress, and the classic design behave as
      before; German and English texts exist for every new string.
- [x] `cd src/web && npm run lint && npm test && npm run build` pass.
