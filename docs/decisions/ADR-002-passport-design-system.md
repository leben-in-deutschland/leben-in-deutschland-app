---
id: ADR-002
title: Use a Passport-Inspired Design System and App Shell
status: Accepted
date: 2026-10-09
areas: [web, android, ui]
tags: [adr, design-system, ui, navigation]
---

# ADR-002: Use a Passport-Inspired Design System and App Shell

## Context

The interface had grown screen by screen. Colors, card styles, uppercase
labels, and chart styles differed between pages; settings lived in a modal;
statistics were hidden behind "show more"; navigation on phones was a hamburger
menu with external links mixed in. The owner asked for a modern, friendlier
interface and gave freedom to redesign everything.

## Options Considered

### Restyle the existing components in place

- Smallest change and lowest risk.
- Keeps the scattered structure: modals for settings, results, and history;
  no shared navigation; duplicated quiz logic inside components.

### Adopt a generic dashboard kit look

- Fast to build with HeroUI defaults.
- Looks like many other apps and says nothing about the subject.

### Build a small design system around the subject, with a real app shell

- Gives the app its own identity: the burgundy and gold of the German
  passport, Fira Sans (a typeface from the family of German wayfinding
  design), and a "pass" card as the one memorable element.
- Adds a bottom tab bar on phones and pages for practice, progress, and
  settings, so every main task is one tap away.
- Larger change; needs careful migration and review.

## Decision

Build the subject-specific design system and app shell. Tokens live in
`src/web/tailwind.config.ts` (HeroUI themes for light and dark) and
`src/web/styles/globals.css`. Fonts are loaded with `next/font/google` so the
Android build stays offline-ready. Shared building blocks live in
`src/web/components/ui/` and `src/web/components/shell/`. Screens keep their
logic in tested modules under `src/web/utils/` instead of inside components.

## Consequences

### Positive

- One visual language across web and Android, in light and dark mode.
- Common tasks are reachable from the tab bar; sessions get a focus mode.
- Logic that used to live inside components is now unit tested.

### Negative

- Many files change at once, so review and rollback need care.
- Screenshots in the store listing (`public/mobile/`) become outdated until
  they are retaken.

## Amendment (2026-10-09, same session)

After the first screens were on the phone, the owner asked for a more modern
look and gave full authority to change the interface. Two refinements were
made within this decision:

- **Typefaces:** the text face is now Inter and headings use Plus Jakarta
  Sans (`src/web/config/fonts.ts`). Fira Code stayed for the passport
  machine-readable line until that line was removed (see the amendment
  below). Fira Sans was dropped because it read as a
  wayfinding face rather than a modern app face. The CSS variables
  `--font-sans` and `--font-display` did not change.
- **Depth and motion:** soft layered shadows, a faint ambient glow behind the
  pass card, gradient primary buttons, a translucent floating tab bar, and a
  gentle press scale on interactive cards. All motion respects
  `prefers-reduced-motion`.

The app shell also owns the **Android hardware Back button**
(`src/web/components/shell/use-back-button.ts`). Without a listener,
Capacitor performs a WebView history step, which silently abandoned a running
mock exam. Now: an open dialog or sheet closes first; a running exam or an
onboarding step asks or steps back; a tab root returns to Home; Home
minimizes the app.

## Amendment (2026-10-10, pass card simplified)

The owner found the pass card confusing. Three things competed with the
numbers: the fake machine-readable strip at the bottom
(`P<DEUBERLIN<<...`), the guilloche rosette drawn behind the readiness text,
and two numbers that seemed to disagree ("9 %" readiness next to
"13/310 known"). The card now keeps only the cover color and the foil rule as
passport touches:

- the state is a small pin-marked line above the greeting;
- one readiness block: the ring, the status, and "13 von 310 Fragen gewusst"
  as its explanation;
- two tiles for the streak ("2 Tage") and today's goal ("1/10" with a bar);
- the "continue" button, then the card ends.

`components/pass/mrz.ts` and `guilloche.tsx` were deleted, the landing
page's decorative code line went with them, and Fira Code is no longer
bundled (`--font-mono` is gone from `config/fonts.ts`, `app/layout.tsx`, and
`tailwind.config.ts`).

## Follow-Up

- [x] Update `docs/architecture/overview.md` with the shell and routes.
- [ ] Retake store and Open Graph screenshots after release (owner task).
