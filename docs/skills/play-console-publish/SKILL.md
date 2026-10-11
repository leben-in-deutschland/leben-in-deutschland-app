---
name: play-console-publish
description: Publish the Google Play Console configuration of Leben in Deutschland from the repository - the tip-jar one-time products and the store listing (texts, screenshots, feature graphic) - through the Play Developer API with offline checks, an explicit credential gate, Google-side validation, and a safe hand-back to the owner. Use when asked to create or update Play products, push or refresh the Play store listing, re-run after a change under src/store/metadata or src/store/output, or verify the Play scripts.
---

# Play Console Publish

Push what the repository says the store should contain. Nothing reaches
Google without a key the owner supplies in their own shell, and nothing is
published without `--apply`. The scripts and their rules are decided in
ADR-008.

## Boundary

- Agents never hold the owner's Google credentials. The only input is the
  file path in `PLAY_SERVICE_ACCOUNT_KEY`, exported by the owner.
- Never ask for, search for, open, print, or commit the key, a token, or the
  key file's content. Do not look for key files in home, cloud-SDK, or
  keychain locations. Check presence of the variable only.
- The first "Manage store presence" grant for the service account happens
  only in the Play Console UI. There is no API shortcut for the first
  account, so a closed gate is a normal, expected stop.
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
3. Credential gate:
   `test -n "$PLAY_SERVICE_ACCOUNT_KEY" && echo set || echo unset`.
   If `unset`, stop here, report the offline results, print the owner steps
   below, and do not try any other way in.
4. Products (gate open):
   - `node src/store/play-products.mjs --list` proves token, permission, and
     package name. 401/403 means the grant is missing or younger than
     24 hours; 404 means the package name is wrong.
   - `node src/store/play-products.mjs --apply` must end with all three
     products `ACTIVE`. Re-running is safe; it only re-activates what is not
     active.
5. Listing (gate open):
   - `node src/store/play-listing.mjs --validate` uploads into a draft edit
     that Google validates and the script discards. Read the per-slot
     summary (created, updated, unchanged).
   - `node src/store/play-listing.mjs --apply` commits. If the output says
     the change was "not sent for review", the owner sends it from Play
     Console → Publishing overview.
6. Hand back to the owner: Play Console → Settings → License testing → add
   a Google account; upload the current `leben-in-deutschland-v<version>-<code>.aab`
   from the GitHub release to Internal testing; make one tip purchase on a
   device and confirm the thank-you state.
7. Record: tick the owner steps in `docs/plans/PLAN-006-tip-jar.md` once
   done, add the usage-log row, and write memory only for a durable lesson.

## Owner steps (print verbatim when the gate is closed)

1. Google Cloud console → pick or create a project → APIs & Services →
   enable **Google Play Android Developer API**.
2. IAM & Admin → Service accounts → create one → Keys → Add key → JSON →
   save it **outside** the repository (for example
   `~/.config/play/leben-in-deutschland.json`).
3. Play Console → Users and permissions → Invite new users → the service
   account's e-mail → App permissions → Leben in Deutschland →
   **Manage store presence** → Invite. Fresh grants can take up to 24 hours.
4. In a shell: `export PLAY_SERVICE_ACCOUNT_KEY=~/.config/play/leben-in-deutschland.json`,
   then run this skill again or the commands from steps 4 and 5.

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
