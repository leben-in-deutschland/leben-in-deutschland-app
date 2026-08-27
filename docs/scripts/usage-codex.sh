#!/usr/bin/env bash
# Real token usage for OpenAI Codex sessions. CLI and IDE share the same
# rollout logs. The last token_count event contains session-cumulative usage.
# Usage: docs/scripts/usage-codex.sh [session-id]
set -eu

DIRECTORY="${CODEX_HOME:-$HOME/.codex}/sessions"
[ -d "$DIRECTORY" ] || {
    echo "No Codex session logs found at $DIRECTORY" >&2
    exit 1
}

python3 - "$DIRECTORY" "${1:-}" <<'PY'
import datetime
import glob
import json
import os
import sys

root, wanted = sys.argv[1], sys.argv[2]
files = sorted(
    glob.glob(os.path.join(root, "**", "*.jsonl"), recursive=True),
    key=os.path.getmtime,
    reverse=True,
)
shown = 0

for path in files:
    if shown >= 10:
        break

    session_id = os.path.basename(path)
    usage = model = day = None

    for line in open(path, errors="ignore"):
        try:
            event = json.loads(line)
        except Exception:
            continue
        payload = event.get("payload") or {}

        if event.get("type") == "session_meta":
            session_id = payload.get("id") or session_id
            day = (event.get("timestamp") or "")[:10]
        elif event.get("type") == "turn_context":
            model = payload.get("model") or model
        elif payload.get("type") == "token_count" or event.get("type") == "token_count":
            data = payload if payload.get("type") == "token_count" else event
            info = data.get("info") or {}
            if info.get("total_token_usage"):
                usage = info["total_token_usage"]

    if not usage or (wanted and wanted not in session_id):
        continue

    if not day:
        day = datetime.date.fromtimestamp(os.path.getmtime(path)).isoformat()
    input_tokens = usage.get("input_tokens", 0) or 0
    output_tokens = usage.get("output_tokens", 0) or 0
    cache_tokens = usage.get("cached_input_tokens", 0) or 0
    total = input_tokens + output_tokens
    print(
        f"{day} {session_id[:14]} {input_tokens:>9,} in {output_tokens:>8,} out "
        f"{cache_tokens:>11,} cached-input {total:>12,} total {model or '?'}"
    )
    shown += 1

if not shown:
    print("No matching Codex sessions")
PY
