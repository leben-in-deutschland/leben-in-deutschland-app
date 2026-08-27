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

- Interactive mock tests and preparation flows.
- Access to general and state-specific questions.
- Progress and statistics dashboards.
- Question catalogue and exam-center lookup.
- English and German content surfaces.
- Web delivery plus an Android application.

## Product Boundaries

- The repository contains a statically exported client application and native
  Android wrapper.
- User state is stored locally in the browser; no application backend or
  database is present in this repository.
- Versioned JSON and assets provide the learning content.
- Scheduled GitHub Actions retrieve source data from
  `leben-in-deutschland/leben-in-deutschland-scrapper`.
- Vercel and Google Play are delivery systems, not product logic.
- PULSE documents engineering work and adds no user-facing runtime.

## Success Signals

- Learners can complete practice and mock-test flows reliably.
- Progress survives normal client use without requiring an account.
- Question and exam-center data stays current through existing sync workflows.
- Web and Android builds preserve the same core experience.

## Open Questions

- The repository does not state who owns the canonical interpretation and
  approval of upstream test content.
- The supported status and release expectations for iOS are not documented.
- Production release ownership and approval requirements are not documented.
