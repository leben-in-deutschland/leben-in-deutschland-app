#!/bin/sh
# PULSE check: the repository's own verification (tests, lint, type check).
set -e
cd "$(dirname "$0")/../.."
exec sh scripts/verify.sh
