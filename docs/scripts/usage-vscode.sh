#!/usr/bin/env bash
# VS Code Copilot Chat session metadata. VS Code's local chat files expose
# dates, models, and request counts, but not token counts.
# Usage: docs/scripts/usage-vscode.sh [session-id]
set -eu

set -- "${1:-}"
for base in "$HOME/Library/Application Support" "$HOME/.config"; do
    for app in "Code" "Code - Insiders" "VSCodium"; do
        [ -d "$base/$app/User" ] && set -- "$@" "$base/$app/User"
    done
done

[ $# -gt 1 ] || {
    echo "No VS Code user data found." >&2
    exit 1
}

python3 - "$@" <<'PY'
import datetime
import glob
import os
import re
import sys

wanted = sys.argv[1]
rows = []

for user in sys.argv[2:]:
    patterns = [
        os.path.join(user, "workspaceStorage", "*", "chatSessions", "*"),
        os.path.join(user, "globalStorage", "emptyWindowChatSessions", "*"),
    ]
    for path in (item for pattern in patterns for item in glob.glob(pattern)):
        if not os.path.isfile(path):
            continue
        session_id = os.path.splitext(os.path.basename(path))[0]
        if wanted and wanted not in session_id:
            continue

        raw = open(path, errors="ignore").read()
        found = re.findall(r'"modelId":"([^"]+)"', raw)
        found += re.findall(r'"identifier":"(copilot/[^"]+)"', raw)
        models = {model.split("/", 1)[-1] for model in found}
        requests = raw.count('"requestId"') or raw.count('"message":{')
        timestamp = os.path.getmtime(path)
        match = re.search(r'"lastMessageDate":(\d{13})', raw)
        if match:
            timestamp = int(match.group(1)) / 1000
        if requests or models:
            rows.append(
                (timestamp, session_id, requests, ",".join(sorted(models)) or "?")
            )

if not rows:
    print("No matching VS Code Copilot Chat sessions")
    raise SystemExit

for timestamp, session_id, requests, models in sorted(rows, reverse=True)[:10]:
    day = datetime.date.fromtimestamp(timestamp).isoformat()
    print(
        f"{day} {session_id[:14]} {requests:>4} req "
        f"tokens: n/a (not stored locally) {models}"
    )
PY
