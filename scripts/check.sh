#!/bin/sh
# Daily check: run the web unit tests, lint and type check.
# The type check (tsc --noEmit -p .) is what `next build` runs on deploy and
# covers src/catalogue/*.mjs through allowJs; vitest does not type-check, so
# without it a type error from a catalogue or data sync job passes here and
# fails the Vercel deploy instead (1f3ac55).
set -e
cd "$(dirname "$0")/../src/web"
npm test
npm run lint
npm run typecheck
