#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# prepare-android.sh
#
# Strips web-only assets from the Next.js static export (out/) before
# Capacitor syncs them into the Android APK.
#
# Usage: npm run build:android   (chains build -> this script -> cap sync)
# ---------------------------------------------------------------------------
set -euo pipefail

OUT_DIR="out"

if [ ! -d "$OUT_DIR" ]; then
  echo "Error: $OUT_DIR directory not found. Run 'next build' first."
  exit 1
fi

echo "=== Preparing Android build: stripping web-only assets from $OUT_DIR ==="

# -------------------------------------------------------
# 1. Remove marketing screenshots (used only for OG meta)
# -------------------------------------------------------
if [ -d "$OUT_DIR/mobile" ]; then
  SIZE=$(du -sh "$OUT_DIR/mobile" | cut -f1)
  rm -rf "$OUT_DIR/mobile"
  echo "  Removed /mobile/ screenshots ($SIZE)"
fi

# -------------------------------------------------------
# 2. Remove pruefstellen pre-rendered pages (SEO-only)
# -------------------------------------------------------
if [ -d "$OUT_DIR/pruefstellen" ]; then
  SIZE=$(du -sh "$OUT_DIR/pruefstellen" | cut -f1)
  rm -rf "$OUT_DIR/pruefstellen"
  echo "  Removed /pruefstellen/ pages ($SIZE)"
fi
# Also remove the top-level pruefstellen HTML if present
rm -f "$OUT_DIR/pruefstellen.html" "$OUT_DIR/pruefstellen.txt" 2>/dev/null

# -------------------------------------------------------
# 3. Remove question-catalogue pre-rendered pages (SEO-only)
#    The app renders questions client-side from JS bundle.
# -------------------------------------------------------
if [ -d "$OUT_DIR/question-catalogue" ]; then
  SIZE=$(du -sh "$OUT_DIR/question-catalogue" | cut -f1)
  rm -rf "$OUT_DIR/question-catalogue"
  echo "  Removed /question-catalogue/ pages ($SIZE)"
fi
rm -f "$OUT_DIR/question-catalogue.html" "$OUT_DIR/question-catalogue.txt" 2>/dev/null

# -------------------------------------------------------
# 4. Remove .txt RSC payload files (React Server Components)
#    These are only used for RSC streaming; Capacitor loads
#    the static HTML directly.
# -------------------------------------------------------
TXT_COUNT=$(find "$OUT_DIR" -name '*.txt' -type f | wc -l | tr -d ' ')
if [ "$TXT_COUNT" -gt 0 ]; then
  TXT_SIZE=$(find "$OUT_DIR" -name '*.txt' -type f -exec du -ch {} + 2>/dev/null | tail -1 | cut -f1)
  find "$OUT_DIR" -name '*.txt' -type f -delete
  echo "  Removed $TXT_COUNT .txt RSC payload files ($TXT_SIZE)"
fi

# -------------------------------------------------------
# 5. Report final size
# -------------------------------------------------------
FINAL_SIZE=$(du -sh "$OUT_DIR" | cut -f1)
echo ""
echo "=== Android build prepared. Final $OUT_DIR size: $FINAL_SIZE ==="
