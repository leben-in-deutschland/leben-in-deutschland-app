# Store assets

Screenshots, feature graphic, listing copy, and promo videos for the app
stores, generated from the exported web build. Everything under
`src/store/output/` is generated and ignored by Git; only the scripts, the
templates, and the listing copy under `metadata/` are committed.

## What this is

A small, self-contained pipeline in plain Node ESM scripts. It adds no npm
dependency: it reuses `sharp` from `src/web/node_modules`, drives a headless
Chromium-based browser (Microsoft Edge on this machine) over the Chrome
DevTools Protocol with Node's built-in `WebSocket`, and calls `ffmpeg` for
the videos.

```text
src/store/
  capture.mjs            Shot list; captures raw app screens per language and device
  compose/templates.mjs  HTML templates: captions, framed slide, feature graphic, video cards
  compose/render.mjs     Renders every store set and the feature graphic; copies the icon
  video.mjs              Builds the silent promo videos with ffmpeg
  check.mjs              Validates sizes, format, counts, and the icon hash
  lib/demo-user.mjs      Synthetic demo learner and the localStorage seed
  lib/browser.mjs        Headless browser launcher and CDP page helper
  lib/server.mjs         Tiny static file server for src/web/out and the templates
  metadata/              Committed store listing copy (de-DE, en-US)
  output/                Generated, gitignored: raw captures, sets, videos
```

The screens show a synthetic learner ("Amina", Berlin) built by
`lib/demo-user.mjs` from a seeded random generator, so every run produces
the same numbers: readiness 71 % ("Fast bereit"), 220 of 310 questions
known, a 12-day streak, 7 of 10 answers today, the exam in 21 days, and
three passed mock exams. No real user data is involved. The seed also marks
the remote-content caches (`lid:notices`, `lid:questions`, `lid:evaluation`)
as freshly fetched and empty, so the app uses its bundled content and the
capture never touches the network.

## Prerequisites

- Node 22 or newer (the browser driver needs the built-in `WebSocket`).
- `src/web/node_modules` installed (`cd src/web && npm install`); `sharp`
  is loaded from there.
- A Chromium-based browser. `lib/browser.mjs` tries, in order: the path in
  `LID_BROWSER`, `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`,
  Google Chrome, Chromium. It runs with `--headless=new`, a throw-away
  profile, and `--remote-debugging-port=0`.
- `ffmpeg` on the `PATH` or in the `FFMPEG` environment variable (Homebrew
  installs it to `/opt/homebrew/bin/ffmpeg`). Only `video.mjs` needs it.
- The exported web build in `src/web/out` (see the first command below).

## Regenerate everything

Run from the repository root. A full run takes a few minutes.

```bash
cd src/web && npm run build && cd ../..   # 1. exported build in src/web/out
node src/store/capture.mjs                # 2. raw screens -> output/raw/<lang>/<device>/<shot>.png
node src/store/compose/render.mjs         # 3. framed sets, feature graphic, icon copy
node src/store/video.mjs                  # 4. promo videos (needs ffmpeg)
node src/store/check.mjs                  # 5. must print "All store assets pass ..."
```

Partial runs while iterating:

```bash
node src/store/capture.mjs --lang de --device phone --shot home --explore   # --explore also writes <shot>.txt with the page text
node src/store/capture.mjs --theme light                                     # default is dark
node src/store/compose/render.mjs --lang en --set play-phone --shot mock
node src/store/compose/render.mjs --set play-feature                         # feature graphic only
node src/store/compose/render.mjs --set play-icon                            # icon copy only
node src/store/video.mjs --lang de --orientation landscape
```

Captures are made for two emulated devices in Android mode (Android user
agent, touch, `window.CapacitorCustomPlatform = { name: "android" }`, dark
colour scheme):

| Device | Viewport (CSS px) | Scale | Raw capture |
| --- | --- | --- | --- |
| phone | 412 × 915 | 3 | 1236 × 2745 |
| tablet | 1032 × 1376 | 2 | 2064 × 2752 |

The shot list (`SHOTS` in `capture.mjs`), in listing order:

| # | Shot | Page | What it shows |
| --- | --- | --- | --- |
| 01 | home | `/dashboard.html` | Readiness, streak, daily goal, next steps |
| 02 | practice | `/prepare.html?action=new` | A correctly answered question with the explanation open |
| 03 | translation | `/prepare.html?action=new` | The translation panel (German set shows English, English set shows Turkish) |
| 04 | mock | `/mock.html` | Exam in progress, question 5 of 33, 48:39 left |
| 05 | progress | `/progress.html` | Readiness breakdown |
| 06 | streak | `/progress.html` | Scrolled to the streak section |
| 07 | modes | `/practice.html` | Study modes |
| 08 | settings | `/settings.html` | Offline, private, free; states and theme |

## Outputs and where each one goes

All paths are under `src/store/output/`. Sets are rendered per language
(`de`, `en`) as `<set>/<lang>/NN_<shot>.png`, eight slides each.

| Output | Size | Store slot |
| --- | --- | --- |
| `play-phone/<lang>/` | 1080 × 1920 | Google Play: Phone screenshots (up to 8) |
| `play-tablet/<lang>/` | 1440 × 2560 | Google Play: 7-inch tablet **and** 10-inch tablet screenshots (same files for both slots) |
| `play-feature/<lang>/featureGraphic.png` | 1024 × 500 | Google Play: Feature graphic |
| `play-icon/icon.png` | 512 × 512 | Google Play: App icon – a byte-identical copy of `src/web/public/android-chrome-512x512.png`; the listing already has it, do not change it |
| `ios-iphone-6.9/<lang>/` | 1320 × 2868 | App Store Connect: iPhone 6.9-inch display (later) |
| `ios-iphone-6.5/<lang>/` | 1284 × 2778 | App Store Connect: iPhone 6.5-inch display (later) |
| `ios-ipad-13/<lang>/` | 2064 × 2752 | App Store Connect: iPad 13-inch display (later) |
| `video/promo-<lang>-landscape.mp4` | 1920 × 1080 | YouTube upload, then the URL goes into the Play listing |
| `video/promo-<lang>-portrait.mp4` | 1080 × 1920 | Social posts, website; no store slot |
| `raw/<lang>/<device>/<shot>.png` | see above | Intermediate captures used by render and video |

Videos are silent H.264 (`yuv420p`, 30 fps, `+faststart`), about 29 s: a
3 s intro card, eight 3.5 s scenes with a gentle alternating zoom and 0.6 s
cross-fades, and a 3.5 s outro card. `video/frames/` keeps the stills.

`check.mjs` verifies every set: PNG, exact size, no alpha channel, at most
8 MB per screenshot (15 MB for the feature graphic), exactly eight slides
per set (Play allows at most 8 per device type, the App Store at most 10),
the feature graphic at 1024 × 500, the icon at 512 × 512 and identical to
the committed icon, and that no video file is empty. It exits non-zero on
any problem.

The website uses the same imagery: `src/web/public/mobile/app-1..7.png`
are copies of `play-phone/de/01_home.png` to `07_modes.png` (the settings
slide is not used there) and are the Open Graph images declared in
`src/web/app/layout.tsx`. Those seven files are the only committed images
from this pipeline; copy them over again after a re-render.

## Listing copy

The copy is committed under `metadata/` and is the only part of the
pipeline that is edited by hand. The folder layout mirrors the fastlane
`supply`/`deliver` conventions so it could be automated later, but fastlane
is not used.

```text
metadata/android/<de-DE|en-US>/title.txt              <= 30 characters
metadata/android/<de-DE|en-US>/short_description.txt  <= 80 characters
metadata/android/<de-DE|en-US>/full_description.txt   <= 4000 characters
metadata/ios/<de-DE|en-US>/name.txt                   <= 30 characters
metadata/ios/<de-DE|en-US>/subtitle.txt               <= 30 characters
metadata/ios/<de-DE|en-US>/keywords.txt               <= 100 characters, comma-separated
metadata/ios/<de-DE|en-US>/promotional_text.txt       <= 170 characters
metadata/ios/<de-DE|en-US>/description.txt            <= 4000 characters (same text as the Play full description)
```

Current lengths are within the limits (title 20, short description 79,
full description 2022 de / 1864 en, keywords 100 de / 99 en, promotional
text 152 de / 147 en). Count characters, not bytes, after editing:

```bash
node -e 'for (const f of process.argv.slice(1)) console.log([...require("fs").readFileSync(f,"utf8")].length, f)' src/store/metadata/*/*/*.txt
```

Only German and English listings are generated. The app interface itself is
German and English; the questions carry translations in seven languages
(English, Turkish, Russian, French, Arabic, Ukrainian, Hindi), which the
copy and the `translation` slide mention.

## Upload checklist

### Google Play Console

Run `node src/store/check.mjs` first. Then, in the Play Console under
*Store presence → Main store listing* (in the *Grow* section of the left
menu):

1. **App name, short description, full description:** paste
   `metadata/android/en-US/*.txt` for the default language and
   `metadata/android/de-DE/*.txt` for German.
2. **App icon:** leave the existing icon in place. If the console asks for
   a file, use `play-icon/icon.png`; it is identical to the one in the app.
3. **Feature graphic:** `play-feature/<lang>/featureGraphic.png` per
   language.
4. **Phone screenshots:** all eight files from `play-phone/<lang>/`, in
   file order (`01_` first).
5. **7-inch tablet** and **10-inch tablet screenshots:** the eight files
   from `play-tablet/<lang>/` for both slots.
6. **Video:** upload `video/promo-de-landscape.mp4` (or the English one)
   to YouTube as public or unlisted and paste the video URL. Play accepts a
   YouTube URL only, not a file.
7. Repeat the text and image steps for the second language, then save and
   send the listing for review.

### App Store Connect (ready for later)

There is no iOS project in this repository yet, so nothing is uploaded to
App Store Connect today. The `ios-*` sets and `metadata/ios/` are rendered
from the same web UI and copy so a future iOS release can start from them:
name, subtitle, keywords, promotional text, and description per locale, and
up to ten screenshots per display size. Re-check Apple's current size list
before using them; the sizes in `render.mjs` are the ones that were valid
when the sets were made.

## Changing slides, captions, and demo data

- **Add or change a slide:** edit `SHOTS` in `capture.mjs`. Each shot has an
  `id`, a `path` under `src/web/out`, optional `steps` run by `runStep`
  (`waitFor`, `click`, `clickText`, `answerCorrectly`, `openPanel`,
  `shiftTime`, `answerAndNext`, `scrollToHeading`, `scrollTo`, `scrollBy`,
  `wait`), and an optional `translation` language per app language. Add a
  `[title, subtitle]` pair for the new id to both languages in `CAPTIONS`
  (`compose/templates.mjs`), then run capture → render → check. The sets,
  the videos, and `check.mjs` all follow `SHOTS` automatically. Keep the
  count at eight or fewer for Play.
- **Change captions or video text:** `CAPTIONS`, `FEATURE_COPY`, and
  `VIDEO_COPY` in `compose/templates.mjs`; re-run render (and video).
- **Change the look:** the frame, status bar, colours, and fonts live in
  `slideHtml`, `featureGraphicHtml`, `videoLandscapeHtml`, and
  `videoCardHtml` in `compose/templates.mjs`. Everything is laid out on a
  1080 px wide base canvas and scaled to each set's size. The fonts (Inter,
  Plus Jakarta Sans) are taken from the `@font-face` rules of the build.
- **Change the demo numbers:** `buildDemoUser` in `lib/demo-user.mjs`
  (known and wrong question counts, streak days, mock results, review
  schedule, exam date, nickname, state). Use `--explore` on a capture to
  read the resulting page text.
- **Add a store set:** add an entry to `SETS` in `compose/render.mjs` with
  the canvas size and the raw device (`phone` or `tablet`); `check.mjs`
  picks it up.

## Rules

- **The icon is never redrawn.** `play-icon/icon.png` is a copy of
  `src/web/public/android-chrome-512x512.png`, and `check.mjs` fails if the
  two differ. Changing the icon is an owner decision, not a side effect of
  this pipeline.
- **Outputs are not committed.** `src/store/output/` is in `.gitignore`.
  Regenerate locally; only `src/web/public/mobile/app-1..7.png` are copied
  into the repository.
- **No real user data.** The learner on the screens is synthetic and
  deterministic; never seed captures from a real device export.
- **No new dependencies.** The scripts use Node built-ins, the existing
  `sharp`, a locally installed browser, and `ffmpeg`.
- **Honest imagery.** Captions and copy state product facts only (official
  questions, 16 states, 7 translation languages, 33-question mock exam,
  offline, free). The mock-exam question is German in the English set too,
  because the real test is in German.

## Troubleshooting

- `No Chromium-based browser found. Set LID_BROWSER to the executable path.`
  – Edge, Chrome, or Chromium is not at the expected path. Point
  `LID_BROWSER` at the browser binary.
- `missing .../src/web/out/dashboard.html - run "npm run build" in src/web first`
  or `no @font-face rules found in src/web/out - run the build first` –
  capture, render, and video all read the exported build. Run
  `cd src/web && npm run build` and retry.
- `missing capture output/raw/<lang>/<device>/<shot>.png - run capture.mjs first`
  – render or video ran before capture, or capture was run with filters
  that skipped that shot. Run `node src/store/capture.mjs` (optionally with
  the same `--lang`/`--shot`) first.
- `spawnSync ffmpeg ENOENT` – `ffmpeg` is not on the `PATH`. Run
  `FFMPEG=/opt/homebrew/bin/ffmpeg node src/store/video.mjs` or add
  `/opt/homebrew/bin` to the `PATH`.
- `question not found in catalogue` or `no button with text "..."` – the
  app's texts or markup changed. Update the step in `SHOTS` (labels are
  given per language) and re-run capture for that shot.
- `timed out waiting for ...` – the page did not reach the expected state
  in 15 s; check the build is current and retry the single shot with
  `--explore` to see the page text.
- `check.mjs` reports a wrong count – a set has stale files from an earlier
  shot list. Delete `src/store/output/<set>/` and re-render.
- The fake status bar always shows `10:08`; this is intentional and part of
  the template, not a capture problem.
