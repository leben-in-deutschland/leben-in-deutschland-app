# Memory

Memory stores durable rules, patterns, and mistakes that should change future
work. It is not a task log.

## Current Memory

- [`android-release-signing.md`](android-release-signing.md) - verifies the
  correct Play application and signing source before changing release secrets.
- [`android-device-testing.md`](android-device-testing.md) - hardware Back,
  debounced native syncs, plugin-call logs, and the release flavour need a
  real device check; recipe for testing the R8 build without CI secrets.
- [`capacitor-r8-annotations.md`](capacitor-r8-annotations.md) - preserves
  Capacitor runtime annotations in minified Android release builds.
- [`android-play-billing.md`](android-play-billing.md) - Play Billing
  library deadline, consume-to-count rule, and how to test the tip jar.
- [`classic-design-module.md`](classic-design-module.md) - how a retired
  design stays available as a namespaced module without touching the record
  or running shell work twice.
- [`web-browser-check.md`](web-browser-check.md) - the web export differs
  from the Android one; view it at desktop, tablet, 390 and 360 px before a
  release, and how German labels clip in dialogs, drawer headers and tiles.
- [`android-min-sdk.md`](android-min-sdk.md) - Google Play's automatic
  integrity protection rejects bundles with `minSdkVersion` below 24; keep
  `variables.gradle` at 24 after Capacitor upgrades.
- [`public-repository-privacy.md`](public-repository-privacy.md) - the
  repository is public on purpose; what may appear, what never may (secrets,
  private e-mail, device serials, cloud ids, home paths), noreply commit
  identity, and the audit commands.

## Rules

- Add only verified, reusable lessons.
- Keep temporary work in `docs/plans/`.
- Keep decisions in `docs/decisions/`.
- Keep behavior requirements in `docs/features/`.
- Update or remove memory as soon as it becomes false.
- Never store credentials, private keys, keystores, secret values, or local
  machine paths.

Copy `_template.md` for a new focused memory note.
