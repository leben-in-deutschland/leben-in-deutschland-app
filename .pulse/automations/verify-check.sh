#!/bin/sh
# PULSE check: runs the repository's own verify script (tests, lint, types).
set -e
cd "$(dirname "$0")/../.."
exec sh scripts/verify.sh
