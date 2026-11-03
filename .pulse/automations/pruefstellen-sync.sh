#!/bin/sh
# PULSE watch (.pulse/automations/pruefstellen-sync.yaml): prints what changed
# in the exam-centre lists on bamf.de compared with the bundled copy, or
# nothing. A non-zero exit means the watcher itself failed (network, firewall,
# workbook layout).
set -e
cd "$(dirname "$0")/../.."
exec node scripts/bamf-data-sync.mjs pruefstellen --check
