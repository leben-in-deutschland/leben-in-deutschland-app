---
id: MEM-017
title: Legal notice names a natural person (DDG/MStV)
date: 2026-10-30
tags: [memory, legal, privacy]
---

# Memory: Legal notice names a natural person

## Lesson

The Impressum (`src/web/app/impressum/page.tsx`) and the privacy policy
(`src/web/app/privacy-policy/page.tsx`) name Manish Tiwari with a private
postal address (Am Potekamp 22, 40885 Ratingen) as operator and GDPR
controller. This is required by German law: § 5 DDG (Telemediengesetz
successor) requires commercial online offers to name a natural person with a
summonable address, § 18 Abs. 2 MStV requires naming the person responsible
for journalistic/editorial content, and Art. 13 GDPR requires naming the data
controller. A private hobby site without this "Impressum" risks an Abmahnung
(warning letter) from competitors or consumer-protection associations.

## When To Apply

- When editing the Impressum page, the privacy policy contact/controller
  sections, the footer, or the settings "About" links: keep the named person,
  address, and contact consistent across all of them.
- Keep the `hello@lamplitlabs.com` mailbox as contact; do not substitute other
  addresses without the owner.
- Never link the EU ODR platform (ceased operation 2025-07-20); the VSBG
  sentence (§ 36) in the Impressum is the current substitute.
- The person/address here is public legal-disclosure data the owner placed in
  the repository deliberately; it is not the "personal identifier" class that
  `public-repository-privacy.md` forbids (that covers secrets, device serials,
  home paths, private e-mail).

## Notes

- `/datenschutz` and `/datenschutzrichtlinie` are alias routes
  (`app/datenschutz/page.tsx`, `app/datenschutzrichtlinie/page.tsx`) that
  re-export the privacy-policy page: the static export (`output: "export"`)
  ignores `next.config.js` redirects, so real routes are the only alias
  mechanism that ships. The canonical URL stays `/privacy-policy`.
- Impressum is web-only like `/privacy-policy`: on native, AppLink opens it
  in the system browser via `openExternal`.
