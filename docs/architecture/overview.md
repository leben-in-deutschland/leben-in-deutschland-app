# Architecture Overview

## Status

Current repository-derived view as of 2026-08-27.

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
