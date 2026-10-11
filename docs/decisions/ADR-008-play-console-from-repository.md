---
id: ADR-008
title: Configure the Play Console From the Repository Through the Play Developer API
status: Accepted
date: 2026-10-11
areas: [store, android, release]
tags: [adr, google-play, store-listing, billing, automation]
---

# ADR-008: Configure the Play Console From the Repository Through the Play Developer API

## Context

The 2.1 release needs two things set up in the Google Play Console that
cannot be shipped inside the app bundle: the three tip-jar one-time
products (`tip_small`, `tip_medium`, `tip_large`; ADR-004, FEAT-002) and
the refreshed store listing (texts, screenshots, feature graphic;
FEAT-006). Until now both were owner click-work in the Console, which is
slow, easy to get subtly wrong (eight screenshots per slot, two languages,
three products with two listings each), and leaves no trace in the
repository of what the store should contain. The Console's CSV import for
products was removed in May 2025, so bulk changes now go through the API
or by hand.

The repository already follows a zero-dependency rule for store tooling
(`src/store/`, PLAN-009): plain Node ESM scripts, no fastlane, nothing
installed. Store credentials are sensitive; the Play Console permission
model is per app and per user, and GitHub holds no Play credential today.

## Options Considered

### Option 1: Keep configuring the Console by hand

- Pros: no code, no credentials to manage.
- Cons: not repeatable, not reviewable, easy to mistype; every listing
  refresh means re-uploading 34 images per language by hand; the
  repository cannot say what the store contains.

### Option 2: fastlane `supply`

- Pros: mature, well known; `metadata/` already mirrors its layout.
- Cons: a Ruby toolchain and gems in a repository that otherwise needs
  only Node; fastlane does not manage the new one-time-product model with
  purchase options; adds a large dependency for two small jobs.

### Option 3: A third-party service or an MCP server for Google Play

- Pros: conversational convenience.
- Cons: there is no official Google Play MCP server; a community one means
  handing the store credential and listing data to third-party code, which
  the repository's privacy rules forbid for no gain.

### Option 4: Two small scripts on the official Play Developer API (chosen)

- Pros: zero dependencies (`fetch`, `node:crypto`), reviewable source of
  truth in `src/store/metadata/`, dry runs without credentials, Google
  validates every edit before anything is published, idempotent re-runs,
  same service account and permission ("Manage store presence") for both
  jobs.
- Cons: the owner must create a service account once and keep its key
  outside the repository; Google's region and product models change over
  time and the scripts must follow them.

## Decision

Add `src/store/play-products.mjs` and `src/store/play-listing.mjs` on a
shared `src/store/lib/play-api.mjs` client (service-account JWT → access
token → REST). The store state lives in the repository:
`metadata/android/one-time-products.json` for the products and the
existing `metadata/android/<locale>/*.txt` plus the rendered `output/`
sets for the listing. Rules:

- Dry run by default; nothing leaves the machine without `--validate`
  (upload into a draft edit that is discarded) or `--apply`.
- No key: the service account is used keyless (see the amendment below);
  a key file is a fallback only and never lives in the repository or in
  GitHub secrets.
- The app icon is never uploaded; the Play slot keeps the existing icon.
- Product ids stay fixed in the app; titles, descriptions and prices are
  store data. Euro countries get the exact euro price from the file; other
  regions come from Google's converter.
- Re-runs are safe: unchanged texts and byte-identical image sets are
  skipped, active purchase options are not re-activated.

### Amendment 2026-10-11: keyless credentials

The owner's Google Cloud organisation enforces
`iam.disableServiceAccountKeyCreation` (Secure by Default), so the JSON key
assumed above cannot be created. The service account stays, because the
Play Console grants permissions to an e-mail identity, but its tokens are
minted on demand: in GitHub Actions through Workload Identity Federation
(GitHub OIDC token → Google STS → `generateAccessToken`, provider pinned to
this repository by attribute condition), on a laptop through the owner's
own `gcloud` login with `roles/iam.serviceAccountTokenCreator`. A
pre-minted `PLAY_ACCESS_TOKEN` is accepted for other tooling, and
`PLAY_SERVICE_ACCOUNT_KEY` remains only as a fallback for organisations
that still allow keys. The `Play Publish` workflow runs products and
listing texts from CI with no secret stored anywhere; screenshots remain a
laptop job because they are rendered locally.

## Consequences

### Positive

- The store configuration is reviewable in pull requests and reproducible
  in minutes after a listing or price change.
- The products exist with the names and prices the app's tests already
  assume (Kaffee 1,99 €, Kuchen 4,99 €, Abendessen 9,99 €).
- No new toolchain, no third party, no credential in the repository.

### Negative

- One owner step remains: creating the service account, the identity
  pool and the IAM bindings, and granting "Manage store presence"; fresh
  grants can take up to 24 hours.
- Changes made directly in the Console are overwritten by the next
  `--apply` unless copied back into the repository files.

## Follow-Up

- [x] `src/store/README.md` documents setup, commands, and troubleshooting.
- [x] `docs/memory/android-play-billing.md` records the `legacyCompatible`
      and permission lessons; PLAN-006 and the release workflow point at
      the scripts.
- [x] `src/store/play-rehearsal.mjs` checks both scripts offline against a
      local mock; the `play-console-publish` skill
      (`docs/skills/play-console-publish/SKILL.md`) is the repeatable
      procedure with its credential gate.
- [ ] Owner: create the service account, run `play-products.mjs --apply`
      and `play-listing.mjs --validate` → `--apply`, add a license-testing
      account, and test a purchase from the internal testing track.
- [x] GitHub Actions: `.github/workflows/play-publish.yml` (manual
      dispatch, Workload Identity Federation, repository variables only).
