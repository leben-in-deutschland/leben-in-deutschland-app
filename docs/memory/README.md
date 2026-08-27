# Memory

Memory stores durable rules, patterns, and mistakes that should change future
work. It is not a task log.

## Current Memory

- [`android-release-signing.md`](android-release-signing.md) - verifies the
  correct Play application and signing source before changing release secrets.
- [`android-production-release-validation.md`](android-production-release-validation.md)
  - requires an installed signed-bundle smoke test before production runtime
  dependency changes.

## Rules

- Add only verified, reusable lessons.
- Keep temporary work in `docs/plans/`.
- Keep decisions in `docs/decisions/`.
- Keep behavior requirements in `docs/features/`.
- Update or remove memory as soon as it becomes false.
- Never store credentials, private keys, keystores, secret values, or local
  machine paths.

Copy `_template.md` for a new focused memory note.
