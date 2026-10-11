---
name: play-console-publish
description: Publish the Google Play Console configuration of Leben in Deutschland from the repository - the tip-jar one-time products and the store listing (texts, screenshots, feature graphic) - through the Play Developer API with keyless credentials (gcloud impersonation or Workload Identity Federation), offline checks, an explicit credential gate, Google-side validation, and a safe hand-back to the owner. Use when asked to create or update Play products, push or refresh the Play store listing, re-run after a change under src/store/metadata or src/store/output, or verify the Play scripts.
---

# Play Console Publish

Push what the repository says the store should contain. Nothing reaches
Google without a credential the owner controls, no key file exists, and
nothing is published without `--apply`. The scripts and their rules are
decided in ADR-008 (keyless amendment).

## Boundary

- Agents never hold the owner's Google credentials. The scripts mint
  one-hour tokens from the owner's own `gcloud` login on their machine
  (`PLAY_SERVICE_ACCOUNT`) or from GitHub's OIDC token through Workload
  Identity Federation in Actions. Agents never sign in for the owner: when
  the owner asks for help, start `BROWSER=true gcloud auth login` in the
  background, hand over the printed `accounts.google.com` link, and let the
  owner finish the sign-in in a browser on the same machine (Google
  redirects to `localhost:8085`). Never type a password or an auth code,
  and never print a token.
- Never create a Google Cloud project. Owners often have several Google
  accounts; run `gcloud projects list` for the active login, name the
  candidates, and let the owner choose. If the right project is not
  visible, the owner signs in with the other account (same link flow)
  instead of getting a new project. The setup block from
  `src/store/README.md` may then run against the chosen project; it only
  adds a service account, IAM bindings, and the GitHub identity pool, all
  of which the rollback section can remove.
- Never ask for, create, search for, open, print, or commit a
  service-account key. The owner's organisation blocks key creation
  (`iam.disableServiceAccountKeyCreation`) and the scripts do not need one.
  Do not look for credentials in home, cloud-SDK, or keychain locations;
  check the presence of the variables below only.
- Never print the values of `PLAY_SERVICE_ACCOUNT` or `PLAY_WIF_PROVIDER`
  either: the repository is public, so its Actions logs are public. The
  scripts log only the credential mode (CodeQL `js/clear-text-logging`
  enforces this on pull requests).
- The first "Manage store presence" grant for the service account happens
  only in the Play Console UI, and the IAM bindings happen in the owner's
  Cloud project. There is no API shortcut for the first account, so a
  closed gate is a normal, expected stop.
- The icon slot is never uploaded. App Store Connect is out of scope.

## Procedure

1. Print the sandbox line, then read `src/store/README.md` section
   "Google Play from the command line", ADR-008, and MEM-004. Note the
   current `main` SHA and `git status` as the rollback baseline.
2. Offline checks (no credentials, no network to Google):
   - `node --version` is 22 or newer.
   - `node src/store/check.mjs` ends with "All store assets pass".
   - `node src/store/play-products.mjs` and `node src/store/play-listing.mjs`
     print their planned requests. Fix any validation error in
     `src/store/metadata/` before going further.
   - `node src/store/play-rehearsal.mjs` prints `ALL CHECKS PASSED`. It
     prints `PRODUCT CHECKS PASSED (listing checks skipped)` when the Play
     sets under `src/store/output/` are not rendered; render them with the
     capture pipeline (README "Regenerate everything") before a real
     listing push.
3. Credential gate, presence only (no `eval`, no values):

   ```bash
   test -n "$PLAY_SERVICE_ACCOUNT" && echo "PLAY_SERVICE_ACCOUNT set" || echo "PLAY_SERVICE_ACCOUNT unset"
   test -n "$PLAY_ACCESS_TOKEN" && echo "PLAY_ACCESS_TOKEN set" || echo "PLAY_ACCESS_TOKEN unset"
   command -v gcloud >/dev/null && echo "gcloud present" || echo "gcloud missing"
   ```

   The gate is open when `PLAY_SERVICE_ACCOUNT` is set and `gcloud` is
   present (laptop), when `PLAY_ACCESS_TOKEN` is set, or inside the
   `Play Publish` workflow (Workload Identity Federation). Otherwise stop
   here, report the offline results, print the owner steps below, and do
   not try any other way in. A `PLAY_SERVICE_ACCOUNT_KEY` fallback exists
   only for organisations that allow keys; never suggest creating one.
4. Products (gate open):
   - `node src/store/play-products.mjs --list` proves token, permission, and
     package name. `impersonation of PLAY_SERVICE_ACCOUNT failed (403)`
     means the IAM binding is missing; Play 401/403 means the Console grant
     is missing or younger
     than 24 hours; 404 means the package name is wrong.
   - `node src/store/play-products.mjs --apply` must end with all three
     products `ACTIVE`. Re-running is safe; it only re-activates what is not
     active.
   - Product icons are not in the API. Render them with
     `node src/store/compose/product-icons.mjs`
     (`src/store/output/play-products/<productId>.png`) and hand the owner
     the upload path: Monetize → Products → One-time products → product →
     Icon. Tell the owner explicitly that this step is manual.
5. Listing (gate open):
   - `node src/store/play-listing.mjs --validate` uploads into a draft edit
     that Google validates and the script discards. Read the per-slot
     summary (created, updated, unchanged).
   - `node src/store/play-listing.mjs --apply` commits. If the output says
     the change was "not sent for review", the owner sends it from Play
     Console → Publishing overview.
   - Without a laptop: Actions → **Play Publish** → *Run workflow* with
     `products-list`, `products-apply`, `listing-validate-texts`, or
     `listing-apply-texts`. Screenshots and the feature graphic are pushed
     from a laptop only, because they are rendered locally.
6. Hand back to the owner: Play Console → Settings → License testing → add
   a Google account; upload the current `leben-in-deutschland-v<version>-<code>.aab`
   from the GitHub release to Internal testing; make one tip purchase on a
   device and confirm the thank-you state.
7. Record: tick the owner steps in `docs/plans/PLAN-006-tip-jar.md` once
   done, add the usage-log row, and write memory only for a durable lesson.

## Owner steps (print verbatim when the gate is closed)

1. Run the keyless setup block from `src/store/README.md`, "One-time setup
   (owner, keyless)", in Cloud Shell or any shell with `gcloud` (set
   `PROJECT` first), or sign in on the laptop (step 3) and name an existing
   project; the agent may then run the block. It enables the APIs, creates
   `play-publisher@<project>.iam.gserviceaccount.com`, lets your account
   impersonate it, and creates the GitHub identity pool and provider pinned
   to this repository. Copy the two `echo` lines at the end.
2. Play Console → Users and permissions → Invite new users → the service
   account's e-mail → App permissions → Leben in Deutschland →
   **Manage store presence** → Invite. Fresh grants can take up to 24 hours.
3. Laptop: `gcloud auth login` once (`BROWSER=true gcloud auth login` prints
   the link instead of opening the default browser, so a specific account
   can sign in from any browser on the same machine), then
   `export PLAY_SERVICE_ACCOUNT=play-publisher@<project>.iam.gserviceaccount.com`
   and run this skill again or the commands from steps 4 and 5.
4. GitHub (optional, for the Play Publish workflow): Settings → Secrets and
   variables → Actions → Variables → `PLAY_SERVICE_ACCOUNT` and
   `PLAY_WIF_PROVIDER` from the two `echo` lines. No secret is stored.

Manual fallback: type the values from
`src/store/metadata/android/one-time-products.json` and PLAN-006 step 2 into
Monetize with Play → Products → One-time products, then Activate.

## Rollback

- Products: an id is permanent once created, so never delete an id the app
  references. To withdraw, deactivate the purchase option in the Console or
  fix titles and prices in the JSON and re-run `--apply`.
- Listing: re-run `--apply` from the previous commit of `metadata/` and the
  re-rendered `output/`, or restore the texts in the Console. A failed
  `--validate` or `--apply` already discards its edit; nothing partial stays.
- Repository: `git revert` the metadata commit; there is no generated state
  to clean.

## Output

Plain-language summary: what ran, what passed, whether the gate was open,
the exact next step for the owner, and the Work Accounting footer required
by `AGENTS.md`.

## References

- `src/store/README.md` (setup, commands, troubleshooting)
- `docs/decisions/ADR-008-play-console-from-repository.md`
- `docs/memory/android-play-billing.md` (MEM-004)
- `docs/plans/PLAN-006-tip-jar.md`, `docs/features/006-store-assets.md`
- `docs/workflows/android-release.md` step 6
- `.github/workflows/play-publish.yml` (manual dispatch, Workload Identity
  Federation)
