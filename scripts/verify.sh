#!/bin/sh
# Standing check: unit tests and lint for the web app.
set -e
cd "$(dirname "$0")/../src/web"
npm test
npm run lint
