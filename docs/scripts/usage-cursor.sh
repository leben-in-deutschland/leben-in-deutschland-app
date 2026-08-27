#!/usr/bin/env bash
# Cursor session metadata from its local state.vscdb store. Cursor records
# session titles, dates, and messages locally, but not token counts.
# Usage: docs/scripts/usage-cursor.sh [session-id]
set -eu

DATABASE=""
for base in "$HOME/Library/Application Support/Cursor" "$HOME/.config/Cursor"; do
    if [ -f "$base/User/globalStorage/state.vscdb" ]; then
        DATABASE="$base/User/globalStorage/state.vscdb"
        break
    fi
done

[ -n "$DATABASE" ] || {
    echo "No Cursor state database found." >&2
    exit 1
}
command -v sqlite3 >/dev/null || {
    echo "sqlite3 is required to read $DATABASE" >&2
    exit 1
}

PYTHON=$(cat <<'PY'
import datetime
import json
import sys

wanted = sys.argv[1]
rows = []

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        data = json.loads(line)
    except Exception:
        continue

    session_id = data.get("composerId") or "?"
    if wanted and wanted not in session_id:
        continue
    timestamp = (data.get("lastUpdatedAt") or data.get("createdAt") or 0) / 1000
    messages = len(
        data.get("conversation") or data.get("fullConversationHeadersOnly") or []
    )
    name = (data.get("name") or "").strip()[:28]
    rows.append((timestamp, session_id, messages, name))

if not rows:
    print("No matching Cursor sessions")
    raise SystemExit

for timestamp, session_id, messages, name in sorted(rows, reverse=True)[:10]:
    day = datetime.date.fromtimestamp(timestamp).isoformat() if timestamp else "?"
    print(
        f"{day} {session_id[:14]} {messages:>4} msg "
        f"tokens: n/a (not stored locally) {name}"
    )
PY
)

sqlite3 -readonly "$DATABASE" \
    "SELECT value FROM cursorDiskKV WHERE key LIKE 'composerData:%'" 2>/dev/null \
    | python3 -c "$PYTHON" "${1:-}"
