# Store assets

Screenshots, feature graphic, listing copy, and promo videos for the app
stores, generated from the exported web build. Everything under
`src/store/output/` is generated and ignored by Git; only the scripts, the
templates, and the listing copy under `metadata/` are committed.

## What this is

A small, self-contained pipeline in plain Node ESM scripts. It adds no npm
dependency: it reuses `sharp` from `src/web/node_modules`, drives a headless
Chromium-based browser (Microsoft Edge on this machine) over the Chrome
DevTools Protocol with Node's built-in `WebSocket`, calls `ffmpeg` for the
videos, and talks to the Google Play Developer API with `fetch` and
`node:crypto`.

```text
src/store/
  capture.mjs            Shot list; captures raw app screens per language and device
  compose/templates.mjs  HTML templates: captions, framed slide, feature graphic, video cards
  compose/render.mjs     Renders every store set and the feature graphic; copies the icon
  video.mjs              Builds the silent promo videos with ffmpeg
  check.mjs              Validates sizes, format, counts, and the icon hash
  play-listing.mjs       Pushes texts, screenshots and feature graphic to the Play listing
  play-products.mjs      Creates and activates the tip-jar products in Play
  play-rehearsal.mjs     Offline check of both Play scripts and every credential mode against a local mock
  lib/play-api.mjs       Service-account login and request helpers for the Play Developer API
  lib/demo-user.mjs      Synthetic demo learner and the localStorage seed
  lib/browser.mjs        Headless browser launcher and CDP page helper
  lib/server.mjs         Tiny static file server for src/web/out and the templates
  metadata/              Committed store listing copy (de-DE, en-US) and the tip-jar product definition
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
- For `play-listing.mjs --validate/--apply` and `play-products.mjs
  --list/--apply` only: a Google service account invited to the Play Console
  app, used keyless through your `gcloud` login or GitHub's Workload Identity
  Federation (see [Google Play from the command line](#google-play-from-the-command-line)).
  Dry runs need nothing.

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
metadata/android/<de-DE|en-US>/video.txt              optional YouTube URL for the listing video
metadata/android/one-time-products.json               tip-jar products: ids, titles, descriptions, euro prices
metadata/ios/<de-DE|en-US>/name.txt                   <= 30 characters
metadata/ios/<de-DE|en-US>/subtitle.txt               <= 30 characters
metadata/ios/<de-DE|en-US>/keywords.txt               <= 100 characters, comma-separated
metadata/ios/<de-DE|en-US>/promotional_text.txt       <= 170 characters
metadata/ios/<de-DE|en-US>/description.txt            <= 4000 characters (same text as the Play full description)
```

Current lengths are within the limits (title 20, short description 79 de /
74 en, full description 2387 de / 2192 en, keywords 100 de / 99 en,
promotional text 152 de / 147 en). Count characters, not bytes, after editing:

```bash
node -e 'for (const f of process.argv.slice(1)) console.log([...require("fs").readFileSync(f,"utf8")].length, f)' src/store/metadata/*/*/*.txt
```

The full description ends with a required notice block (`HINWEIS` /
`NOTE`): the app is not an official Einbürgerungstest, it is a private
offering and not an official app of the Bundesamt für Migration und
Flüchtlinge (BAMF), the test can only be taken at the BAMF, and the
questions are © BAMF. The wording follows the app's own disclaimer
(`alert1`/`alert2` in `src/web/data/translations/`) and the footer credit.
Never drop it when rewriting the copy; the previous Play listing carried it
and the 2026-10-11 upload had to be re-done to put it back.

The English copy says **Einbürgerungstest**, never "German citizenship
test" or "naturalisation test" (owner rule, 2026-10-11). This covers the
store texts, the screenshot captions and feature-graphic tagline in
`compose/templates.mjs`, and the video copy. The iOS keywords are the one
exception: they are search terms that are never displayed.

Only German and English listings are generated. The app interface itself is
German and English; the questions carry translations in seven languages
(English, Turkish, Russian, French, Arabic, Ukrainian, Hindi), which the
copy and the `translation` slide mention.

## Google Play from the command line

Two scripts write to the Play Console through the official Google Play
Developer API, with the same zero-dependency rule as the rest of the
pipeline. They are the committed, repeatable alternative to clicking
through the Console; both have a dry run that needs no credentials.

The agent-facing procedure is the `play-console-publish` skill
(`docs/skills/play-console-publish/SKILL.md`): offline checks, credential
gate, products, listing, hand-back. Its offline check is

```bash
node src/store/play-rehearsal.mjs   # local mock of Google's token endpoint and the Play API
```

which signs a throwaway service-account key, runs both scripts with
`--apply` against the mock and asserts the calls (JWT signature, prices,
activation, SHA-256 skip, icon untouched, review fallback, no key material
in requests). It prints `ALL CHECKS PASSED`, or
`PRODUCT CHECKS PASSED (listing checks skipped)` when the Play sets under
`output/` are not rendered. Nothing reaches Google.

### One-time setup (owner, keyless)

No service-account key is created or stored. Google's "Secure by Default"
organisation policy `iam.disableServiceAccountKeyCreation` blocks keys in
most organisations anyway, and the scripts do not need one. The service
account itself stays, because the Play Console grants permissions to an
e-mail address; its one-hour tokens are minted on demand from **your own
`gcloud` login** on a laptop and from **GitHub's OIDC token through
Workload Identity Federation** in Actions.

1. Google Cloud, in Cloud Shell or any shell with the gcloud CLI (replace
   the project id; everything else is fixed):

   ```bash
   PROJECT=<your-project-id>
   REPO=leben-in-deutschland/leben-in-deutschland-app
   SA=play-publisher@$PROJECT.iam.gserviceaccount.com
   NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')

   gcloud services enable androidpublisher.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project "$PROJECT"
   gcloud iam service-accounts create play-publisher --project "$PROJECT" --display-name "Play publisher"

   # laptop: your own account may mint tokens for the service account
   gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT" \
     --role roles/iam.serviceAccountTokenCreator --member "user:$(gcloud config get-value account)"

   # GitHub Actions: trust this repository's OIDC tokens (Workload Identity Federation)
   gcloud iam workload-identity-pools create github --project "$PROJECT" --location global --display-name "GitHub Actions"
   gcloud iam workload-identity-pools providers create-oidc github --project "$PROJECT" --location global \
     --workload-identity-pool github --display-name "GitHub" \
     --issuer-uri https://token.actions.githubusercontent.com \
     --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
     --attribute-condition "assertion.repository == '$REPO'"
   gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT" \
     --role roles/iam.workloadIdentityUser \
     --member "principalSet://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"

   echo "PLAY_SERVICE_ACCOUNT=$SA"
   echo "PLAY_WIF_PROVIDER=projects/$NUMBER/locations/global/workloadIdentityPools/github/providers/github"
   ```

   The attribute condition pins the provider to this repository, so no other
   GitHub repository can use it. IAM changes take a minute or two to apply.
2. In Play Console → **Users and permissions** → *Invite new user*, enter
   the service account's e-mail (the `PLAY_SERVICE_ACCOUNT` value), add this
   app under *App permissions*, and grant **"Manage store presence"** (it
   covers store listing, pricing and in-app products; Google's help page
   lists it as "Edit pricing, in-app products, and pricing templates"). New
   permissions can take up to 24 hours to reach the API.
3. Laptop: `gcloud auth login` once (your Google account, interactive;
   `BROWSER=true gcloud auth login` prints the sign-in link instead of
   opening the default browser, so you can finish it with a specific account
   in any browser on the same machine), then before running a script:

   ```bash
   export PLAY_SERVICE_ACCOUNT=play-publisher@<your-project-id>.iam.gserviceaccount.com
   ```

4. GitHub: Settings → Secrets and variables → Actions → **Variables** (not
   secrets, neither value is secret): `PLAY_SERVICE_ACCOUNT` and
   `PLAY_WIF_PROVIDER` from the two `echo` lines. Then Actions → **Play
   Publish** → *Run workflow* runs products and listing texts from CI
   (`.github/workflows/play-publish.yml`); screenshots stay a laptop job
   because they are rendered locally.

Credential modes, first match wins:

| Variable | Where | What happens |
| --- | --- | --- |
| `PLAY_ACCESS_TOKEN` | anywhere | used as is; a short-lived token with the `androidpublisher` scope minted by another tool |
| `PLAY_SERVICE_ACCOUNT` + `PLAY_WIF_PROVIDER` | GitHub Actions | GitHub OIDC token → Google STS → `generateAccessToken` for the service account |
| `PLAY_SERVICE_ACCOUNT` | laptop | `gcloud auth print-access-token` (your login) → `generateAccessToken` for the service account |
| `PLAY_SERVICE_ACCOUNT_KEY` | fallback | path to a JSON key, only where the organisation still allows keys; never inside the repository |

The package name is read from `appId` in `src/web/capacitor.config.ts`
(`PLAY_PACKAGE_NAME` overrides it). Tokens are never printed, and neither
are the variable values: the scripts log only the mode (for example
`authenticating with Workload Identity Federation for PLAY_SERVICE_ACCOUNT,
no key`), because Actions logs of this public repository are public.

### Store listing: `play-listing.mjs`

Sends the texts from `metadata/android/<language>/` and the rendered sets
from `output/` into a Play *edit*, lets Google validate the edit, and
commits it only with `--apply`.

```bash
node src/store/check.mjs                      # assets must pass first
node src/store/play-listing.mjs               # dry run: what would be sent
node src/store/play-listing.mjs --validate    # real upload into a draft edit, Google validates, edit discarded
node src/store/play-listing.mjs --apply       # upload, validate, commit = publish the listing change
node src/store/play-listing.mjs --apply --lang de --text-only
node src/store/play-listing.mjs --apply --images-only
```

What it does per language (`de-DE`, `en-US`):

- `title.txt`, `short_description.txt`, `full_description.txt` → the
  listing texts. Unchanged texts are not re-sent.
- `play-phone/<lang>/` → phone screenshots, `play-tablet/<lang>/` → the
  7-inch **and** the 10-inch slots, `play-feature/<lang>/featureGraphic.png`
  → feature graphic. Play reports a SHA-256 per stored image; a slot whose
  files are byte-identical and in the same order is skipped, otherwise the
  slot is cleared and re-uploaded in file order. Images are declared as not
  AI-generated (they are renders of the real app).
- The **app icon is never uploaded**; the listing keeps the existing one.
- An optional `metadata/android/<language>/video.txt` with a YouTube URL
  sets the promo video. Without the file, the video already in the listing
  is kept. Both files exist and point at the owner's YouTube uploads of
  `video/promo-<lang>-landscape.mp4` (2026-10-11); after re-rendering a
  video, upload the new file in YouTube Studio and update the URL here.

The commit publishes the change; Google may review it first. When the
Console is set to require a manual *Send for review*, the API refuses the
plain commit, the script commits with `changesNotSentForReview` instead and
tells you to send the changes from *Publishing overview*. Any error
discards the edit, so a half-finished upload never reaches the store.

### Tip-jar products: `play-products.mjs`

Creates or updates the three one-time products the app sells
(`tip_small`, `tip_medium`, `tip_large`, fixed in `services/tip-jar.ts` and
`TipJarPlugin.java`) from `metadata/android/one-time-products.json` and
activates them.

```bash
node src/store/play-products.mjs              # dry run: validates the definition, prints the requests
node src/store/play-products.mjs --list       # what Play has today
node src/store/play-products.mjs --apply      # create or update, then activate
node src/store/play-products.mjs --apply --product tip_small
```

The definition holds, per product, the German and English title (≤ 55
characters) and description (≤ 200), and the **consumer price in euro for
Germany** (`1.99`, `4.99`, `9.99`). Prices for every other Play region come
from Google's own converter (`pricing:convertRegionPrices`), which expects
the tax-exclusive amount, so the script first strips German VAT
(`defaultVatRate`, 0.19) and then pins every euro country to the exact
euro price from the file. Future Play regions get the converter's USD/EUR
"other regions" prices. The single purchase option (`buy`) is marked
backwards compatible, which is what the Billing Library flow in
`TipJarPlugin.java` (`OneTimePurchaseOfferDetails`) needs. Consumption is
app-side, so Play has no "consumable" flag to set.

Re-running `--apply` is safe: it re-sends the same definition and only
activates options that are not active yet. Names and prices may also be
changed in the Console at any time without an app update; copy such
changes back into the JSON, or they are overwritten at the next `--apply`.

Regions change over time, so the script uses the regions version Google
returns with the converted prices. Set `PLAY_REGIONS_VERSION` only when
Google's error message asks for a specific one.

## Upload checklist

### Google Play Console

Run `node src/store/check.mjs` first.

**From the command line:** `node src/store/play-listing.mjs --validate`,
then `--apply` (see above). Then check the result in Play Console under
*Grow → Store presence → Main store listing*.

**By hand**, in the Play Console under *Store presence → Main store
listing* (in the *Grow* section of the left menu):

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
   YouTube URL only, not a file. Ready-to-paste titles, descriptions, and
   tags are in `metadata/youtube/<de|en>.txt`. Upload through YouTube
   Studio in the browser, never through the YouTube Data API: videos
   inserted by an API project that has not passed YouTube's compliance
   audit are locked to private for good, and Play rejects private videos.
   The gcloud sign-in is no way around it: Google blocks YouTube scopes
   for gcloud's default client ("This app is blocked").
   Afterwards put the URL into `metadata/android/<language>/video.txt` and
   run `play-listing.mjs --apply --text-only`.
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
  this pipeline; `play-listing.mjs` never uploads the icon slot.
- **Outputs are not committed.** `src/store/output/` is in `.gitignore`.
  Regenerate locally; only `src/web/public/mobile/app-1..7.png` are copied
  into the repository.
- **No real user data.** The learner on the screens is synthetic and
  deterministic; never seed captures from a real device export.
- **No new dependencies.** The scripts use Node built-ins, the existing
  `sharp`, a locally installed browser, `ffmpeg`, and Google's public REST
  API. No fastlane, no third-party upload service or MCP server sees the
  store credentials.
- **No key, no secret.** The Play service account is used keyless
  (`PLAY_SERVICE_ACCOUNT` with your `gcloud` login, Workload Identity
  Federation in Actions). Tokens live one hour and are never printed. If an
  organisation still allows keys and someone insists on one, it stays
  outside the repository and is passed only through
  `PLAY_SERVICE_ACCOUNT_KEY`; never commit, paste, or log it.
- **Nothing is published without `--apply`.** Dry runs are local;
  `--validate` uploads into a draft edit that is discarded.
- **No new Google Cloud project.** The setup block runs against an existing
  project that the owner names (`gcloud projects list` shows what the
  active login can see; a different Google account may own the right one).
  Project ids are global, so the obvious names are taken anyway.
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
  `--explore` to see the page text. If the text shows a first-run prompt or
  the classic design, the app gained a new storage flag: add it to
  `buildStorageSeed` in `lib/demo-user.mjs` (as `lid:ui-mode: modern` and
  the used-up `lid:support-ask` are) so every shot shows the modern design
  without dialogs.
- `check.mjs` reports a wrong count – a set has stale files from an earlier
  shot list. Delete `src/store/output/<set>/` and re-render.
- The fake status bar always shows `10:08`; this is intentional and part of
  the template, not a capture problem.
- `no Play credentials` – `--list`, `--validate`, and `--apply` need
  `PLAY_SERVICE_ACCOUNT` (keyless) or one of the other modes in the table
  above; dry runs do not.
- `iam.disableServiceAccountKeyCreation` in the Cloud console – the
  organisation blocks service-account keys. Expected; the keyless setup above
  needs none.
- `gcloud is not installed` / `gcloud auth print-access-token failed` –
  install the Google Cloud CLI and run `gcloud auth login` (interactive, your
  account), or run the Play Publish workflow from GitHub instead.
- `impersonation of PLAY_SERVICE_ACCOUNT failed (403)` – your account lacks
  `roles/iam.serviceAccountTokenCreator` (laptop) or the repository principal
  lacks `roles/iam.workloadIdentityUser` (Actions) on the service account,
  the IAM Service Account Credentials API is not enabled, or the binding is
  younger than a few minutes.
- `Workload Identity Federation token exchange failed (400)` – the
  `PLAY_WIF_PROVIDER` variable names the wrong project number, pool or
  provider, or the provider's attribute condition does not match this
  repository (forks and other repositories are rejected by design).
- `GitHub OIDC token request failed` – the job lacks
  `permissions: id-token: write`; the Play Publish workflow sets it.
- `Play API 401/403 … insufficient permissions` – the service account is
  not invited to this app with "Manage store presence", the grant is
  younger than about 24 hours, or the Google Play Android Developer API is
  not enabled in the service account's Cloud project.
- `Play API 404` on the first call – wrong package name (check `appId` in
  `src/web/capacitor.config.ts` or `PLAY_PACKAGE_NAME`), or the app lives
  in a different Play developer account than the one that invited the
  service account.
- `regionsVersion.version …` in a Play API 400 – Google wants a specific
  regions version; run again with `PLAY_REGIONS_VERSION=<value from the
  message>`.
- `The price €1.67 for New Regions must be rounded` (Play API 400) – the
  USD/EUR fallback for regions Play adds later must follow Play's price
  pattern (whole cents ending in 9), but `pricing:convertRegionPrices`
  returns it raw. `play-products.mjs` rounds both fallback prices to the
  nearest `.x9` since 2026-10-11; if the message comes back, Google changed
  the pattern - compare with the regional prices the converter returns.
- `edit committed but not sent for review` – not an error. Open Play
  Console → *Publishing overview* and send the changes for review.
- `no files in src/store/output/…` – `play-listing.mjs` found no rendered
  set; run capture → render → check first, or use `--text-only`.
