---
id: MEM-008
title: The Repository Is Public - Keep Personal Identifiers and Secrets Out of It
date: 2026-10-11
tags: [memory, privacy, security, public-repository, git]
---

# Memory: The Repository Is Public - Keep Personal Identifiers and Secrets Out of It

## Lesson

`leben-in-deutschland-app` stays public on purpose: the GitHub Pages site,
the active `main` ruleset, the three deployment environments and CodeQL all
depend on it on the organisation's Free plan, and the app and its daily sync
workflows read `leben-in-deutschland-scrapper` over public raw URLs. Public
means everything - files, history, Actions logs, release assets - is readable
by anyone. The 2026-10-11 audit found no secret but did find the owner's
phone serial number in two plan files and the owner's private e-mail address
as the author of roughly 310 older commits.

What may appear, because it is public by design:

- the business contact address used in the app footer, the About section,
  the privacy policy and the store listing;
- the source-code link, the privacy-policy URL and the package name;
- the public test-centre data (`prüfstellen.json`) with the centres' own
  contact details;
- the maintainer's GitHub user name (organisation owner, template upstream).

What must never appear, in files, docs, skills, logs or commit metadata:

- secrets of any kind: keys, keystores, tokens, passwords, `.env` files,
  `google-services.json`, Vercel project files (all ignored by `.gitignore`;
  GitHub push protection blocks known token formats);
- personal identifiers: private e-mail addresses, phone or device serial
  numbers (`adb -s <serial>`), IMEIs, home-directory paths, Google Cloud
  project ids or numbers, service-account e-mails, Play developer ids, order
  or tracking numbers. Use placeholders such as `<device-serial>` or
  `<project>`; the Play scripts print only the credential mode for the same
  reason.

## When To Apply

- Before committing anything under `docs/` that records a device check, a
  console session or a cloud setup: replace identifiers with placeholders.
- Before printing values in scripts or workflows: Actions logs of this
  repository are public, and `vars.*` are not masked (only `secrets.*` are).
- When writing or installing a skill: skills document procedures, not the
  owner's values.
- When committing: author and committer must use the GitHub noreply address
  (`<id>+<user>@users.noreply.github.com`); `~/.gitconfig` is already set to
  it. In GitHub Settings -> Emails, keep "Keep my email addresses private"
  and "Block command line pushes that expose my email" on.

## Notes

- Audit commands (run from the repository root; tracked files only):

  ```bash
  git ls-files -z | xargs -0 grep -I -o -h -E "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" | sort | uniq -c | sort -rn
  git ls-files -z | xargs -0 grep -I -n -E "adb -s [A-Za-z0-9]{6,}|/Users/[A-Za-z]+/|gserviceaccount\.com|projects/[0-9]{6,}"
  git log --format='%an <%ae>' | sort | uniq -c | sort -rn
  gh api repos/leben-in-deutschland/leben-in-deutschland-app/secret-scanning/alerts?state=open --jq length
  ```

- The older commits that carry the private e-mail can only be cleaned by
  rewriting history (`git filter-repo --mailmap`, force-push, re-clone, and a
  GitHub Support request to purge cached views). That is an owner decision,
  not a routine task, and it is never done as a rollback shortcut.
- The archived blog repository serves a live site from its Pages build; on
  the Free plan it must stay public for that site to exist.
