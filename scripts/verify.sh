#!/bin/sh
# Standing check: unit tests, lint and type check for the web app.
# The type check (tsc --noEmit -p .) is what `next build` runs on deploy;
# vitest does not type-check, so without it a type error passes here and
# fails the Vercel deploy instead (1f3ac55).
set -e
cd "$(dirname "$0")/../src/web"
npm test
npm run lint
npm run typecheck
