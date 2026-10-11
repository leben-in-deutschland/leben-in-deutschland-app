---
id: MEM-006
title: Check the Web Flavour of the Export in a Desktop Browser Before a Release
date: 2026-10-11
tags: [memory, web, vercel, layout, testing, i18n]
---

# Memory: Check the Web Flavour of the Export in a Desktop Browser Before a Release

## Lesson

The same `main` push releases the Android bundle and the Vercel website, but
the two exports differ and the device check only covers one of them. Three
layout bugs that the phone never showed were found only by opening the web
export in a desktop browser at 1440, 834, 390 and 360 px:

1. **Side-by-side dialog buttons clip German labels on desktop.** A 448 px
   centred modal gives two buttons less room than a full-width phone sheet.
   Stack `ModalFooter` buttons (`flex-col-reverse gap-2`, `w-full`) unless
   both labels are short in German and English.
2. **Header actions beside a title do not fit at 384-390 px.** The
   notification drawer's "Alle als gelesen markieren" collided with the close
   button. Put secondary header actions on their own line under the title.
3. **Long single German words break `line-clamp`.** In a 2-column tile with
   a 48 px icon, the label gets about 74 px at 360 px; "Übersprungen" and
   "Bundesland" cannot wrap and are cut. Use `hyphens-auto break-words`
   (works because `<html lang="de">`) and allow enough lines; `h-full` keeps
   tiles of one grid row the same height.

## When To Apply

- Before merging to `main`: `npm run build` (not `build:android`, which strips
  `pruefstellen/`, `question-catalogue/`, `mobile/` and the `.txt` RSC files),
  serve `src/web/out/` and view it at desktop, tablet and phone widths in
  light and dark theme, as a fresh user, a modern user and a 2.0 record.
- When adding a dialog, drawer header, or compact tile with German text.
- When a German label is a single long word: test at 360 px, the most common
  Android width, not only on the 412 dp test phone.

## Notes

- A quick scan for cut text: for every visible element with `overflow-x:
  hidden/clip` or `text-overflow: ellipsis`, report `scrollWidth >
  clientWidth`. Skip `sr-only` elements (1 px wide by design) and progress
  tracks; the skip link "Zum Inhalt springen" always appears and is fine.
- The mock exam registers `beforeunload` on the web; automated browser
  navigation must auto-accept the dialog or it blocks.
- Light theme in a headless browser: emulate the media feature
  `prefers-color-scheme` with `value: "light"`.
- `html` scrolls smoothly; scroll with `behavior: "instant"` and re-measure
  before dispatching clicks.
- The local static server has no `/_vercel/speed-insights/script.js`; that 404
  is expected outside Vercel.
