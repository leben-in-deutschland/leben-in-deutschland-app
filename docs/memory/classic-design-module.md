---
id: MEM-005
title: Keeping a Retired Design as a Namespaced Module
date: 2026-10-11
tags: [memory, web, ui, migration, tailwind]
---

# Memory: Keeping a Retired Design as a Namespaced Module

## Lesson

When an old interface must stay available next to a new one (ADR-007: the
2.0 learner screens live under `src/web/classic/`), restore it from Git into
its own folder and treat it as a guest of the new shell:

- Restore files with `git show <commit>:<path>` and rewrite every import to
  the new namespace (`@/classic/...`). Shared modules that still exist
  (`@/utils/routes`, `@/utils/navigation`, data loaders) are imported from
  their current location, not copied.
- Route every read and write through the current store (`utils/user-store.ts`).
  The old "read, mutate, save the whole object" code is then harmless because
  the store normalizes and keeps every newer field. Code that rebuilt the
  record (the 2.0 state change wiped progress) must be replaced, not kept.
- Strip anything the shared shell already owns: reminder scheduling, update
  and review prompts, system bars, migration. Otherwise it runs twice.
- Keep a device-level preference (which design to show) in its own storage
  key (`lid:ui-mode`), never inside the record: old code paths cannot lose
  it, older builds ignore it, and exporting the record stays design-neutral.
- Add the new folder to `tailwind.config.ts` `content`. Classes used only by
  the restored files are otherwise purged from the production CSS without
  any build error.
- The 2.0 "read in a mount effect, listen for `user`" pattern fails this
  repository's `react-hooks/set-state-in-effect` rule. Replace it with the
  store hooks (`useUser`, `useIsNative`, `useHydrated`) or lazy
  `useState(() => ...)` initializers instead of adding `eslint-disable`.
- Shell-level toasts that point at pages of the new design must be gated on
  the active design; the items can still be stored for later.

## When To Apply

Any time a screen set is kept for opt-in or rollback instead of being
deleted, or when old components are brought back from Git history.

## Notes

- A headless Edge/CDP run against `src/web/out` (served with a tiny static
  server that maps `/dashboard` to `dashboard.html`) catches runtime errors
  the unit tests cannot, such as chart.js in the restored dashboard. The page
  uses smooth scrolling: after `scrollIntoView`, wait before measuring click
  coordinates or clicks land outside the viewport.
- `__tests__/fixtures/legacy-user-2.0-device.json` is a real 2.0 record for
  such checks.
- The retained "mutate the record, then save" code passes
  `eslint-plugin-react-hooks` 7.0.1 but not 7.1.x: `eslint-config-next`
  16.3.8 pulls 7.1.1, whose `react-hooks/immutability` and stricter
  `react-hooks/set-state-in-effect` flag 16 lines in
  `classic/components/{prepare-quiz,quiz-answer,quiz}.tsx`. Raise
  `eslint-config-next` above 16.3.3 only together with immutable updates
  there (copy, change, save), not with `eslint-disable`
  ([`PLAN-014`](../plans/PLAN-014-dependabot-remediation-2026-10.md)).
