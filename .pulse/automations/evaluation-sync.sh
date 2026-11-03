#!/bin/sh
# PULSE watch (.pulse/automations/evaluation-sync.yaml): prints what changed in
# BAMF's evaluation status on bamf.de compared with the bundled copy (or that
# the bundled "last checked" date is not today), or nothing. A non-zero exit
# means the watcher itself failed (network, firewall, page layout).
set -e
cd "$(dirname "$0")/../.."
exec node scripts/bamf-data-sync.mjs evaluation --check
