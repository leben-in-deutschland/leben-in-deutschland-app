#!/bin/sh
# PULSE watch (.pulse/automations/evaluation-sync.yaml): prints what changed in
# the scraper's BAMF evaluation status compared with the bundled copy, or
# nothing. A non-zero exit means the watcher itself failed (network, shape).
set -e
cd "$(dirname "$0")/../.."
exec node scripts/scraper-sync.mjs evaluation --check
