#!/bin/sh
# PULSE watch (.pulse/automations/bamf-catalogue-sync.yaml): prints what
# changed on bamf.de's catalogue page or PDF compared with
# src/catalogue/state.json, or nothing. A non-zero exit means the watcher
# itself failed (network, firewall redirect, not a PDF).
set -e
cd "$(dirname "$0")/.."
exec node src/catalogue/watch.mjs
