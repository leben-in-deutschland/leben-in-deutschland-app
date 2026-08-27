#!/usr/bin/env bash
# Real token usage for Claude Code sessions. CLI, IDE extensions, and desktop
# use the same project JSONL logs. Usage is deduplicated by message and request.
# Usage: docs/scripts/usage-claude.sh [session-id]
set -eu

ROOTS=""
for directory in "${CLAUDE_CONFIG_DIR:-$HOME/.config/claude}/projects" "$HOME/.claude/projects"; do
    [ -d "$directory" ] && ROOTS="$ROOTS $directory"
done

[ -n "$ROOTS" ] || {
    echo "No Claude project logs found." >&2
    exit 1
}

python3 - "${1:-}" $ROOTS <<'PY'
import collections
import datetime
import glob
import json
import os
import sys

wanted, roots = sys.argv[1], sys.argv[2:]
sessions = collections.defaultdict(
    lambda: [0, 0, 0, 0, 0, collections.Counter(), 0.0]
)
seen = set()
files = []

for root in roots:
    files += glob.glob(os.path.join(root, "*", "*.jsonl"))
    files += glob.glob(os.path.join(root, "*", "*", "chat.jsonl"))

for path in files:
    basename = os.path.basename(path)
    session_id = (
        os.path.basename(os.path.dirname(path))
        if basename == "chat.jsonl"
        else basename[:-6]
    )
    if wanted and wanted not in session_id:
        continue

    for line in open(path, errors="ignore"):
        if '"usage"' not in line:
            continue
        try:
            event = json.loads(line)
        except Exception:
            continue

        message = event.get("message") or {}
        usage = message.get("usage") or {}
        if not usage:
            continue

        dedupe_key = (message.get("id"), event.get("requestId"))
        if dedupe_key != (None, None) and dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        session = sessions[session_id]
        session[0] += usage.get("input_tokens", 0) or 0
        session[1] += usage.get("output_tokens", 0) or 0
        session[2] += usage.get("cache_creation_input_tokens", 0) or 0
        session[3] += usage.get("cache_read_input_tokens", 0) or 0
        session[4] += 1
        model = message.get("model")
        if model and model != "<synthetic>":
            session[5][model] += 1

    if session_id in sessions:
        sessions[session_id][6] = max(
            sessions[session_id][6], os.path.getmtime(path)
        )

if not sessions:
    print("No matching Claude sessions")
    raise SystemExit

for session_id, values in sorted(
    sessions.items(), key=lambda item: -item[1][6]
)[:10]:
    input_tokens, output_tokens, cache_write, cache_read, messages, models, modified = values
    cache_tokens = cache_write + cache_read
    total = input_tokens + output_tokens + cache_tokens
    model = ",".join(key for key, _ in models.most_common()) or "?"
    day = datetime.date.fromtimestamp(modified).isoformat() if modified else "?"
    print(
        f"{day} {session_id[:14]} {input_tokens:>9,} in {output_tokens:>8,} out "
        f"{cache_tokens:>11,} cache {total:>12,} total {messages:>4} msg {model}"
    )
PY
