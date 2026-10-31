---
name: app-store-connect-publish
description: Publish the App Store Connect configuration of Leben in Deutschland from the repository - the tip-jar consumables and the App Store listing (name, subtitle, texts, keywords, URLs, category, content rights, age rating, copyright, release type, version string) - through the App Store Connect API with the owner's API key, an offline rehearsal, an explicit credential gate, and a safe hand-back to the owner. Use when asked to create or update the iOS in-app purchases, push or refresh the App Store listing, re-run after a change under src/store/metadata, or verify the asc-*.mjs scripts.
---

# App Store Connect Publish

Push what the repository says the App Store should contain. Nothing reaches
Apple without the owner's App Store Connect API key, and nothing is written
without `--apply`. The scripts and their rules are the decision (ADR-047,
PLAN-013); the Play twin is the `play-console-publish` skill.

## Boundary

- Agents never hold the owner's key. The `.p8` lives in the owner's
  password manager and reaches the scripts only as a file path outside the
  repository (`ASC_API_KEY_PATH`) on the owner's machine, or as the GitHub
  secret `ASC_API_KEY_BASE64` inside the `App Store Publish` workflow.
  Never ask for, open, print, encode, or commit the key, and never print
  `ASC_KEY_ID` or `ASC_ISSUER_ID`: the repository and its Actions logs are
  public. The scripts log only which variable the key came from.
- Never create a key, a certificate, an app record, or an agreement for the
  owner; App Store Connect requires the owner's Apple ID with two-factor
  authentication for all of them. A closed gate is a normal, expected stop.
- Never commit the numeric Apple ID of the app; the scripts find the app by
  bundle id. The App Store URL goes into `siteConfig.links.appStore` once
  the app is public, nowhere else.
- Product ids are permanent and referenced by the apps; never delete one.
- Screenshots, the App Privacy answers, the app's price and availability,
  the build and the submission stay in App Store Connect by hand; say so
  explicitly in the hand-back.
- `asc-profile.mjs` may create an App Store provisioning profile for the
  team's distribution certificate (the iOS release workflow does); it never
  creates certificates, and it never prints the profile or the Team ID.

## Procedure

1. Print the sandbox line, then read `src/store/README.md` section
   "App Store Connect from the command line" and the "App Store Connect"
   upload checklist. Note the current `main` SHA and `git status` as the
   rollback baseline.
2. Offline checks (no credentials, no network to Apple):
   - `node --version` is 22 or newer.
   - `node src/store/asc-products.mjs` and `node src/store/asc-listing.mjs`
     print their planned requests and end with "valid". Fix any validation
     error in `src/store/metadata/` before going further (title 30,
     App Store description 45, name/subtitle 30, keywords 100, promotional
     text 170, description 4000 characters).
   - `node src/store/asc-rehearsal.mjs` prints `ALL CHECKS PASSED`.
3. Credential gate, presence only (no `eval`, no values):

   ```bash
   test -n "$ASC_KEY_ID" && echo "ASC_KEY_ID set" || echo "ASC_KEY_ID unset"
   test -n "$ASC_ISSUER_ID" && echo "ASC_ISSUER_ID set" || echo "ASC_ISSUER_ID unset"
   test -n "$ASC_API_KEY_PATH" && echo "ASC_API_KEY_PATH set" || echo "ASC_API_KEY_PATH unset"
   ```

   The gate is open when all three are set (laptop) or inside the
   `App Store Publish` workflow (secrets). Otherwise stop here, report the
   offline results, print the owner steps below, and do not try any other
   way in.
4. Products (gate open):
   - `node src/store/asc-products.mjs --list` proves key, team and bundle
     id. 401 means key id, issuer id and `.p8` do not belong together; 403
     means the key lacks App Manager or the Paid Apps Agreement is not
     active; "no app with bundle id" means the app record is missing.
   - `node src/store/asc-products.mjs --apply` must end with every product
     `READY_TO_SUBMIT`, or `MISSING_METADATA` with the sentence about the
     review screenshot. Re-running is safe; unchanged records are skipped.
   - The review screenshot is the tip jar in Settings:
     `node src/store/review-screenshot.mjs` renders it from the exported
     build (needs `src/web/out`), then
     `node src/store/asc-products.mjs --apply --review-screenshot src/store/output/review/tip-jar-de.png`.
     Without a build, hand the owner the path: the product → Review
     Information → Screenshot.
5. Listing (gate open):
   - `node src/store/asc-listing.mjs` once more, then
     `node src/store/asc-listing.mjs --apply`. Read the per-record summary
     (created, updated, unchanged). "Apple refused the answers" for the age
     rating means a new questionnaire item; the owner answers it once in
     App Store Connect → App Information → Age Rating.
   - "no editable iOS version" means every version is in review or live;
     the owner adds a new version in App Store Connect first.
   - Without a laptop: Actions → **App Store Publish** → *Run workflow* with
     `products-list`, `products-apply`, `listing-dry-run`, or
     `listing-apply`.
6. Hand back to the owner, naming what stays manual: screenshots (the
   rendered `ios-*` sets), App Privacy (Data Not Collected), price Free and
   availability, the review screenshot if not attached, selecting the
   TestFlight build, submitting - and after approval
   `siteConfig.links.appStore`.
7. Record: reply on the owner's task or post a `finding` on the PULSE board;
   write a `MEM-*` record only for a durable lesson.

## Owner steps (print verbatim when the gate is closed)

1. App Store Connect → Users and Access → Integrations → App Store Connect
   API → Team Keys → + → name "GitHub Actions", role **App Manager**.
   Download the `.p8` once, note the Key ID and the Issuer ID, store all
   three in the password manager.
2. Laptop: keep the `.p8` outside the repository, then
   `export ASC_KEY_ID=<key id> ASC_ISSUER_ID=<issuer id> ASC_API_KEY_PATH=<path to the .p8>`
   and run this skill again or the commands from steps 4 and 5.
3. GitHub (for the App Store Publish and iOS Release workflows): Settings →
   Secrets and variables → Actions → `ASC_KEY_ID`, `ASC_ISSUER_ID`,
   `ASC_API_KEY_BASE64` (`base64 -i AuthKey_<key id>.p8 | pbcopy`).
4. Business → Agreements, Tax, and Banking → Paid Apps Agreement active,
   otherwise the products cannot be created or bought.

Manual fallback: type the values from
`src/store/metadata/android/one-time-products.json` and
`src/store/metadata/ios/` into App Store Connect.

## Rollback

- Products: never delete an id the apps reference. To withdraw a tip, set
  its availability to no territories in App Store Connect, or remove it from
  the next submission; the apps hide products the store does not return.
- Listing: every write replaces text with text from the repository; the
  previous wording is in git history - restore the files and run `--apply`
  again. Nothing is submitted by the scripts, so nothing reaches review.
- Credentials: revoke the key in App Store Connect → Integrations and
  delete the three GitHub secrets.
