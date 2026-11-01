#!/bin/sh
# PULSE watch (.pulse/automations/pruefstellen-sync.yaml): prints what changed
# in the scraper's exam-centre list compared with the bundled copy, or
# nothing. A non-zero exit means the watcher itself failed (network, shape).
set -e
cd "$(dirname "$0")/.."
exec node scripts/scraper-sync.mjs pruefstellen --check
