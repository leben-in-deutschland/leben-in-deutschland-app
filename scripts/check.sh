#!/bin/sh
# Daily check: run the web unit tests and lint.
set -e
cd "$(dirname "$0")/../src/web"
npm test
npm run lint
