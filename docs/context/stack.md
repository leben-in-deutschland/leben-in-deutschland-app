# Stack Context

## Repository Layout

```text
src/web/       Next.js web application and tests
src/android/   Capacitor Android project
src/catalogue/ Scripts that check, extract, compare, and apply the official BAMF catalogue PDF
.github/       CI, data sync, deployment, and release workflows
docs/          PULSE engineering control plane
```

## Application Stack

- Next.js 16 with static export.
- React 19 and TypeScript 5.
- Tailwind CSS 3 and HeroUI components.
- Capacitor 7 for native integration.
- Android compile/target SDK 36 and minimum SDK 23.
- Browser `localStorage` for user progress and preferences: the learner
  record under `user`, and `lid:*` keys for state that must survive record
  writes (`lid:ui-mode` for the design choice, `lid:support`,
  `lid:evaluation`, `lid:notices`, `lid:notices-dismissed`,
  `lid:questions`).
- Versioned JSON for questions, evaluation data, translations, and centers.

## Tooling

- npm with `src/web/package-lock.json`.
- ESLint 9 with Next.js configuration.
- Vitest 4 and jsdom.
- Gradle wrapper under `src/android/`.
- GitHub Actions for tests, data sync, Vercel deployment, and Android release.
- Java 21 in the Android release workflow.
- `pdfjs-dist`, a devDependency of `src/web/package.json`, used only by the
  catalogue scripts under `src/catalogue/` (loaded from
  `src/web/node_modules`); it is not part of the app bundle.

## Real Commands

Run commands from the repository root unless the command changes directory:

```bash
cd src/web && npm test
cd src/web && npm run lint
cd src/web && npm run build
cd src && make build-sync
cd src/android && ./gradlew bundleRelease
```

Use the smallest command that covers the change. Do not run deployment,
release, signing, or data-writing workflows without their existing approval
and secret boundaries.

## Integrations

- Vercel for web deployment.
- Capacitor and the Android Gradle toolchain.
- Google Play release signing through GitHub Actions secrets.
- GitHub-hosted scraper data consumed by scheduled sync workflows.
- Browser and native plugins for notifications, sharing, file access, app
  updates/reviews, haptics, keyboard behavior, and text-to-speech.
- Google Play Billing (`com.android.billingclient:billing`, pinned as
  `playBillingVersion` in `src/android/variables.gradle`) through the local
  Capacitor plugin `TipJarPlugin.java`; see
  `docs/memory/android-play-billing.md` for the yearly library deadline.
- The BAMF evaluation status: on Android, `services/evaluation.ts` downloads
  the scraper repository's public `current-evaluation.json` from
  `raw.githubusercontent.com` through `CapacitorHttp` (part of
  `@capacitor/core`) at most once a day (ADR-005). The project's own domain
  is behind Vercel's security challenge and rejects non-browser clients.
- Two more daily public files on the same client (ADR-006): the owner's
  `notices.json` from the app repository's `content` branch (`404` means
  "no notices") and `questions-core.json` from `main`, both with
  `If-None-Match` so an unchanged file costs one `304`. These three are the
  app's only runtime requests for its own data; none carries identifiers.
- The official BAMF question catalogue PDF (ADR-009): the `Sync Catalogue`
  workflow (`.github/workflows/sync-catalogue.yml`) runs
  `src/catalogue/check.mjs` once a week with read-only `GET` requests to
  `bamf.de` (conditional `GET`, never `HEAD`, no cookies stored). When the
  PDF changed it applies the safe part (exact answer-text matches) to
  `src/web/data/question.json`, runs the tests, pushes to `main` with the
  `PAT` secret (which starts the deploy and release workflows), and opens
  an issue for the questions that need a human. The app itself never
  requests anything from bamf.de.

## Constraints

- The web build must remain compatible with static export.
- The Android package ID is `org.lebenindeutschland.app`.
- Signing secrets and keystores must never enter the repository.
- Generated web, Android, and code-context output is not canonical source.

## Open Questions

- The intended iOS support status is unknown.
- No repository-standard Markdown linter or link checker is configured.
