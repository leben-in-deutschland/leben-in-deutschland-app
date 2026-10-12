# Product Context

## Product

**Leben in Deutschland** helps people prepare for the German
`Leben in Deutschland` and naturalization tests through interactive practice
material.

## Target Users

- People preparing for the German naturalization test.
- Learners who need practice questions, mock exams, progress feedback, and
  nearby exam-center information.

## First Valuable Outcome

A learner can open the application, practice the official-style questions,
run a mock test, and review progress without creating an account.

## Current Capabilities

- Interactive mock tests and preparation flows. The mock exam follows the
  official sample test sheet (Musterfragebogen): a cover and instruction
  page before the clock starts, "Frage 1" to "Frage 33" with checkbox
  marks, the state questions mixed in, and links to the two official sample
  sheets on bamf.de ([`FEAT-009`](../features/009-mock-exam-official-sheet.md)).
- Ten study modes, including spaced review, topics, quick rounds, and a
  marathon through the whole catalogue.
- Streak options (daily goal, streak rule, rest days, streak freezes) and
  achievements.
- An in-app notification center on web and Android, plus scheduled Android
  reminders that learners control per type.
- Learners who upgrade from version 2.0 keep the 2.0 ("classic") design
  until they choose the new one; both designs offer a switch in Settings,
  and new learners start on the new design
  ([`ADR-007`](../decisions/ADR-007-classic-ui-opt-in.md)).
- Access to general and state-specific questions.
- Progress and statistics dashboards with an exam-readiness estimate.
- Question catalogue and exam-center lookup.
- English and German content surfaces.
- Web delivery plus an Android application.
- The app is free and ad-free. On Android, learners can leave an optional tip
  through Google Play (three repeatable one-time products); tips unlock
  nothing and the section stays hidden until the products exist in the Play
  Console.

## Product Boundaries

- The repository contains a statically exported client application and native
  Android wrapper.
- User state is stored locally in the browser; no application backend or
  database is present in this repository.
- Versioned JSON and assets provide the learning content.
- Scheduled GitHub Actions retrieve source data from
  `leben-in-deutschland/leben-in-deutschland-scrapper`.
- The official BAMF catalogue PDF is the reference for what a question
  says ([`ADR-009`](../decisions/ADR-009-official-bamf-catalogue-source.md)):
  a weekly read-only check under `src/catalogue/` turns a new edition into
  a report and a proposal in a pull request. The scraper still supplies
  translations, explanations, and solutions, and nothing changes in the
  app's question file until the owner approves the merge.
- Vercel and Google Play are delivery systems, not product logic. Google
  Play's billing system is the only payment processor; the repository holds
  no payment data beyond a per-device tip counter.
- PULSE documents engineering work and adds no user-facing runtime.

## Success Signals

- Learners can complete practice and mock-test flows reliably.
- Progress survives normal client use without requiring an account.
- Question and exam-center data stays current through existing sync workflows.
- Web and Android builds preserve the same core experience.

## Open Questions

- The repository does not state who owns the canonical interpretation of
  upstream test content beyond ADR-009, which makes the owner the reviewer
  of every change to the question texts.
- The supported status and release expectations for iOS are not documented.
- Production release ownership and approval requirements are not documented.
