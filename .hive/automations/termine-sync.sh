#!/bin/sh
# Hive watch (.hive/automations/termine-sync.yaml): reads the exam centres'
# pages and publishes termine.json on the `data` branch - no model, nothing
# on `main` (src/termine/publish.mjs, ADR-050). It prints nothing on standard
# output, so no job follows a run; what it did is on standard error, which
# `hive schedule log` shows. A non-zero exit means that the read failed or
# that the push was refused.
set -e
cd "$(dirname "$0")/../.."
exec node src/termine/publish.mjs
