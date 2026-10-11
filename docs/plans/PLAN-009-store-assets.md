---
id: PLAN-009
title: Store Screenshots, Brand Assets, Listing Copy, and Promo Video
status: Done
date: 2026-10-11
tags: [android, store, brand, marketing, website]
---

# PLAN-009: Store Screenshots, Brand Assets, Listing Copy, and Promo Video

Spec: [`FEAT-006`](../features/006-store-assets.md).

## Context

The Play listing still shows screenshots of the previous interface
(`src/web/public/mobile/app-1..7.png`, 1620×2880, bright green background,
English captions). The same files are the Open Graph images of the website
(`src/web/app/layout.tsx`). The owner asked for Android and iOS store
screenshots, brand assets, and - if possible - a promo video for the
redesigned app, with one hard constraint: **the app icon stays as it is**.

Facts that shape the scope:

- There is no iOS project (`src/` holds `android`, `web`, `makefile`).
  iOS-sized sets are rendered from the same web UI so they are ready when an
  iOS app exists; nothing is set up for Xcode or App Store Connect.
- The owner was not available for the style questions, so the recommended
  defaults apply: framed phone on the burgundy/gold brand background with a
  short caption, dark theme, German and English, silent ~30 s videos in
  landscape (YouTube link for Play) and portrait.
- Google Play rules: phone screenshots PNG/JPEG without alpha, every side
  320-3840 px, longer side at most twice the shorter one, 2-8 images; tablet
  sets 9:16 or 16:9 with sides ≥ 1080 px; feature graphic 1024×500 without
  alpha; hi-res icon 512×512 32-bit PNG; promo video is a YouTube URL.
- Tooling present on the machine without new npm packages: Microsoft Edge
  (headless Chromium driven over CDP), `ffmpeg`, Node 22 (global
  `WebSocket`), the `sharp` module already in `node_modules`.
- Capacitor's `window.CapacitorCustomPlatform = { name: "android" }` hook
  makes `isNativePlatform()` true while every plugin falls back to its web
  implementation, so the app renders its Android variant in a desktop
  browser without a device.

## Steps

- [x] `src/store/lib/demo-user.mjs`: a plausible synthetic learner record
      (Berlin, ~60 % readiness, 12-day streak, exam in three weeks, three
      finished mock exams, review schedule) generated relative to the capture
      date; German and English variants.
- [x] `src/store/capture.mjs`: static server for `src/web/out`, headless
      Edge over CDP, device metrics for phone (412×915 @3) and tablet
      (1032×1376 @2), seeded `localStorage` (record, language, theme, fresh
      remote caches), raw PNG captures per language and screen under
      `src/store/output/raw/`.
- [x] `src/store/compose/`: HTML templates with the build's own fonts for the
      framed slides and the feature graphic; `render.mjs` renders Play phone
      1080×1920 and tablet 1440×2560, iPhone 6.9" 1320×2868 and 6.5"
      1284×2778, iPad 13" 2064×2752, feature graphic 1024×500; the existing
      512 px icon is copied, never redrawn.
- [x] `src/store/check.mjs`: verifies sizes, aspect limits, no alpha, and
      counts for every set.
- [x] Listing copy under `src/store/metadata/` (de-DE, en-US; Play title,
      short and full description; App Store name, subtitle, keywords,
      description, promotional text) grounded in product facts.
- [x] `src/store/video.mjs`: silent ~30 s MP4s (1920×1080, 1080×1920) from an
      intro, framed scenes with captions, and an outro, assembled with
      `ffmpeg`.
- [x] Website: replace `public/mobile/app-1..7.png` with the new Play phone
      slides (same names) and correct the declared Open Graph size in
      `app/layout.tsx`; `npm run build` must pass.
- [x] Docs: `src/store/README.md` (regeneration and upload steps), FEAT-006,
      README indexes, this plan Done with evidence, usage log.

## Acceptance Criteria

- Every generated set passes `node src/store/check.mjs` (dimensions, aspect,
  alpha, count) with zero findings.
- German and English sets exist for phone and tablet; captions are real
  product facts (460 official questions, 16 states, 7 translation languages,
  mock exam with 33 questions, offline, no data collection, free).
- The icon files under `src/web/public/` and `src/android/app/src/main/res/`
  are byte-identical to the baseline.
- `npm run build` succeeds with the replaced website screenshots; no product
  behaviour changes, so `npm test` only runs if product code changes.
- Nothing is committed or pushed; the owner reviews the branch.

## Verification

```bash
node src/store/capture.mjs && node src/store/compose/render.mjs && node src/store/check.mjs
node src/store/video.mjs
cd src/web && npm run build
git status --short -- src/web/public src/android   # only mobile/app-*.png may differ
```

## Rollback

- **Baseline:** uncommitted branch `feat/ui-ux-revamp` at `c295bc7` with the
  prior tasks' changes; snapshot of `src/web/public/mobile/app-*.png` and
  `src/web/app/layout.tsx` in the session folder `files/pre-store/`.
- **Trigger:** a check failure that cannot be fixed, a changed icon file, a
  failing `npm run build`, or the owner rejecting the style.
- **Reversal:** delete `src/store/` and the `.gitignore` line for
  `src/store/output/`; copy `files/pre-store/mobile/app-*.png` back to
  `src/web/public/mobile/` and `files/pre-store/layout.tsx` to
  `src/web/app/layout.tsx`; delete the new docs files and remove their index
  rows.
- **State safety:** no dependencies, schemas, secrets, deployment, or phone
  data change. Headless Edge uses a throw-away profile under `/tmp`. The
  phone is only used for an optional recording after a full `localStorage`
  backup, restored and verified byte-identical afterwards.
- **Recovery verification:** `git status --short` shows no file under
  `src/web/public` or `src/android`; `npm run build` passes; icon hashes
  unchanged.

## Evidence

- `node src/store/capture.mjs`: 32 raw captures (de/en × phone/tablet × 8
  screens) from the exported build with the synthetic learner; reviewed on
  contact sheets.
- `node src/store/compose/render.mjs`: 80 framed slides across
  `play-phone`, `play-tablet`, `ios-iphone-6.9`, `ios-iphone-6.5`,
  `ios-ipad-13`, plus two feature graphics and the copied icon.
- `node src/store/check.mjs`: "All store assets pass the size and format
  checks." (sizes, PNG, no alpha, counts, icon byte-identical).
- `node src/store/video.mjs`: four MP4s (`promo-{de,en}-{landscape,portrait}`),
  `ffprobe`: h264, yuv420p, 30 fps, 29.1 s, no audio stream.
- Listing copy lengths: Play title 20, short 79/79, full 2022/1864 chars;
  App Store subtitle 22/28, keywords 100/99, promotional text 152/147.
- Website: `app-1..7.png` replaced (1080×1920, no alpha), Open Graph size
  corrected to 1080×1920 and the third alt text updated;
  `cd src/web && npm run build` exit 0.
- Icon: `shasum -a 256 -c` over the 27 baseline hashes - all `OK`.
- Docs: `src/store/README.md`, FEAT-006, index rows; nothing committed.
