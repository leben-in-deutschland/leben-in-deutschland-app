# Stack Context

## Repository Layout

```text
src/web/       Next.js web application and tests
src/android/   Capacitor Android project
.github/       CI, data sync, deployment, and release workflows
docs/          PULSE engineering control plane
```

## Application Stack

- Next.js 16 with static export.
- React 19 and TypeScript 5.
- Tailwind CSS 3 and HeroUI components.
- Capacitor 7 for native integration.
- Android compile/target SDK 36 and minimum SDK 23.
- Browser `localStorage` for user progress and preferences.
- Versioned JSON for questions, evaluation data, translations, and centers.

## Tooling

- npm with `src/web/package-lock.json`.
- ESLint 9 with Next.js configuration.
- Vitest 4 and jsdom.
- Gradle wrapper under `src/android/`.
- GitHub Actions for tests, data sync, Vercel deployment, and Android release.
- Java 21 in the Android release workflow.

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

## Constraints

- The web build must remain compatible with static export.
- The Android package ID is `org.lebenindeutschland.app`.
- Signing secrets and keystores must never enter the repository.
- Generated web, Android, and code-context output is not canonical source.

## Open Questions

- The intended iOS support status is unknown.
- No repository-standard Markdown linter or link checker is configured.
