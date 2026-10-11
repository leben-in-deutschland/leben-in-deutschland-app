# Architecture Overview

## Status

Current repository-derived view as of 2026-10-09 (updated for the 2.1 UI and
UX revamp in [`PLAN-004`](../plans/PLAN-004-ui-ux-revamp.md) and, on
2026-10-11, for the classic design opt-in in
[`PLAN-011`](../plans/PLAN-011-classic-ui-choice.md)).

## System Shape

1. **Web application** - `src/web/` is a Next.js App Router application using
   React and TypeScript. `next.config.js` exports static files to `out/`.
2. **User experience** - routes under `src/web/app/` provide test preparation,
   mock exams, statistics, question browsing, exam-center lookup, settings,
   and privacy information.
3. **Client state** - user progress and preferences are stored in browser
   `localStorage` through `src/web/services/` and `src/web/utils/`.
4. **Content** - question, evaluation, translation, and exam-center data is
   versioned under `src/web/data/` and public assets.
5. **Native delivery** - Capacitor packages the exported web application for
   Android under `src/android/` with application ID
   `org.lebenindeutschland.app`.
6. **Automation** - GitHub Actions refreshes data, tests/builds the app,
   deploys the web output through Vercel, and builds/signs Android bundles.
7. **Engineering control plane** - PULSE lives under `docs/` and adds no
   runtime dependency to the product.

## Interface Shell (2.1 revamp)

See [`ADR-002`](../decisions/ADR-002-passport-design-system.md) and
[`FEAT-001`](../features/001-ui-ux-revamp.md).

- `src/web/components/shell/` wraps every page: a top bar, a phone tab bar
  for the learner areas (`/dashboard`, `/practice`, `/mock`, `/progress`,
  `/settings`), the notification center, and an onboarding gate that shows
  the first-run setup until the learner has a federal state. Practice
  sessions (`/prepare`) and running mock exams use a focus mode without the
  bars. Public pages (`/`, catalogue, exam centers, privacy) get the public
  header and footer.
- Design tokens live in `src/web/tailwind.config.ts` (HeroUI light and dark
  themes) and `src/web/styles/globals.css`; shared building blocks live in
  `src/web/components/ui/`, `components/pass/`, and `components/question/`.
- Inside the Android app, in-app links must point to bundled `.html` files.
  `components/ui/app-link.tsx` and `utils/navigation.ts` handle this; pages
  that are removed from the Android bundle open the public website instead.
- The shell also owns the Android hardware Back button
  (`components/shell/use-back-button.ts`): open dialogs close first, a
  running exam asks before leaving, onboarding steps back, tab roots return
  to Home, and Home minimizes the app. Screens claim a press with
  `useBackButton(handler, enabled)`.
- Typefaces come from `next/font/google` in `src/web/config/fonts.ts` (Inter
  for text, Plus Jakarta Sans for headings, Fira Code for the passport line)
  and are copied into the build, so the Android app stays offline.

**Two designs** ([`ADR-007`](../decisions/ADR-007-classic-ui-opt-in.md),
[`FEAT-008`](../features/008-classic-ui-choice.md)). The learner routes can
render either the 2.1 "modern" screens or the 2.0 "classic" screens:

- `utils/ui-mode.ts` decides (`resolveUiMode(stored, user)`): the choice
  under the storage key `lid:ui-mode` (`"classic"` or `"modern"`) wins; no
  record, no federal state, or unfinished onboarding means modern; a finished
  record without a choice is an upgraded 2.0 learner and means classic plus
  a one-time prompt (`components/shell/ui-mode-prompt.tsx`). Onboarding
  stores `"modern"`; deleting the record clears the key.
- `src/web/classic/` holds the 2.0 components, logic utils, icons, types,
  and user service restored from `c295bc7` (imports under `@/classic/`).
  `AppShell` renders `ClassicApp({ pathname })` for `/dashboard`,
  `/practice`, `/prepare`, `/mock`, `/progress`, and `/settings` in classic
  mode, with a neutral loading state until the mode is known.
- Shared in both modes: the data layer (`utils/user-store.ts`, schema
  version 2; classic writes keep every 2.1 field), the shell effects
  (`use-app-effects.ts`: in-app inbox, Android reminder planning), the
  update and review prompts (`native-prompts.tsx`), and notification tap
  routing. The restored dashboard schedules no reminder of its own, and a
  state change keeps progress. Both Settings offer the switch to the other
  design.
- Public pages (`/`, `/question-catalogue`, `/pruefstellen`,
  `/privacy-policy`) are modern only.

## Learner Data and Logic

- `utils/user-store.ts` is the only reader and writer of the stored record
  (`localStorage` key `user`). It normalizes older records on every read
  (`utils/user-defaults.ts`) and notifies subscribers through the existing
  `user` window event.
- Pure, unit-tested modules hold the rules: streaks, goals, and freezes
  (`utils/streak-logic.ts`), spaced repetition (`utils/review-schedule.ts`),
  answer recording and mock grading (`utils/practice-logic.ts`), study modes
  (`utils/study-modes.ts`), readiness and pass chance
  (`utils/readiness-logic.ts`), achievements (`utils/achievements.ts`), and
  in-app notifications (`utils/engagement.ts`).
- Notifications are local-first ([`ADR-003`](../decisions/ADR-003-local-first-notifications.md)):
  the shell runs `runEngagement` after every change to fill the in-app
  notification center, and on Android re-plans scheduled notifications with
  `utils/notification-planner.ts` through `services/notifications.ts`.
- The tip jar ([`ADR-004`](../decisions/ADR-004-tip-jar-play-billing.md)) is
  Android-only: `components/preferences/support-section.tsx` calls
  `services/tip-jar.ts`, which bridges to the local Capacitor plugin
  `TipJarPlugin.java` on Google Play Billing. The tip counter is stored under
  its own key (`lid:support`, `utils/support-store.ts`); the learner record is
  never written by it.
- The BAMF evaluation status ([`ADR-005`](../decisions/ADR-005-evaluation-status-refresh.md))
  is bundled from `data/current-evaluation.json` and, on Android only,
  refreshed daily: `components/home/use-evaluation.ts` reads the newer of
  the bundled file and the cache in `utils/evaluation-store.ts`
  (`lid:evaluation`) and asks `services/evaluation.ts` to download the
  scraper's public file through Capacitor's native HTTP client. The website
  keeps the build-time value, which the daily sync workflow rebuilds.
- The same channel ([`ADR-006`](../decisions/ADR-006-remote-content.md))
  carries two more public files through the shared pieces
  `utils/remote-cache.ts` (one cache shape, 24-hour age, 1-hour retry,
  app-version stamp) and `services/remote-file.ts` (conditional GET with
  `If-None-Match`): owner notices and switches (`utils/notice-store.ts`,
  `services/notices.ts`, `components/home/use-notices.ts`,
  `components/home/notice-card.tsx`; keys `lid:notices`,
  `lid:notices-dismissed`; `flags.tipJar` gates `SupportSection`) and the
  question catalogue (`utils/question-store.ts`, `services/questions.ts`;
  key `lid:questions`), which `utils/question-bank.ts` prefers over the
  bundle once it passes a strict check, while `utils/question-loader.ts`
  hides bundled explanations and translations for changed questions.

## Main Data Flow

```text
Scraper repository -> GitHub Actions sync -> versioned JSON
                                           -> Next.js static export
                                           -> browser / Vercel
                                           -> Capacitor Android bundle
```

User progress stays on the client unless a future accepted decision introduces
a server-side boundary.

## Release Boundaries

- Web deployment is defined in `.github/workflows/vercel-deploy.yml`.
- Android delivery is defined in `.github/workflows/android-release.yml`.
  The go-live procedure (local release-flavour check, version bump, internal
  testing track, staged rollout, rollback) is `docs/workflows/android-release.md`.
- Android signing material is supplied through GitHub Actions secrets; durable
  handling rules live in `docs/memory/android-release-signing.md`.
- Product source, CI, deployment, and external state remain outside PULSE
  bootstrap scope.

## Constraints

- Static export limits features that require a Next.js server runtime.
- Client-local persistence must remain safe when browser storage is absent or
  cleared.
- Android behavior spans TypeScript/Capacitor configuration and native Gradle
  sources.
- Generated build output and optional code-context indexes are not source of
  truth.

## Open Questions

- `src/web/capacitor.config.ts` declares an iOS path, but no native iOS project
  is tracked. Whether iOS remains a supported target is not documented.
- The repository does not identify owners or approval boundaries for web and
  Play Store production releases.
