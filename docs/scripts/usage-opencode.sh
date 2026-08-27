#!/usr/bin/env bash
# Real token usage for OpenCode sessions from its local message store.
# Usage: docs/scripts/usage-opencode.sh [session-id]
set -eu

STORE="${OPENCODE_STORE:-$HOME/.local/share/opencode/storage/message}"
[ -d "$STORE" ] || {
    echo "No OpenCode message store found at $STORE" >&2
    exit 1
}

python3 - "$STORE" "${1:-}" <<'PY'
import collections
import glob
import json
import os
import sys

store, wanted = sys.argv[1], sys.argv[2]
sessions = collections.defaultdict(
    lambda: [0, 0, 0, 0, collections.Counter(), 0.0]
)

for path in glob.glob(os.path.join(store, "*", "*.json")):
    try:
        data = json.load(open(path))
    except Exception:
        continue
    if data.get("role") != "assistant":
        continue

    session_id = data.get("sessionID") or os.path.basename(os.path.dirname(path))
    if wanted and wanted not in session_id:
        continue

    tokens = data.get("tokens") or {}
    cache = tokens.get("cache") or {}
    session = sessions[session_id]
    session[0] += tokens.get("input", 0) or 0
    session[1] += tokens.get("output", 0) or 0
    session[2] += (cache.get("read", 0) or 0) + (cache.get("write", 0) or 0)
    session[3] += 1
    if data.get("modelID"):
        session[4][data["modelID"]] += 1
    session[5] = max(session[5], os.path.getmtime(path))

if not sessions:
    print("No matching OpenCode sessions")
    raise SystemExit

for session_id, values in sorted(
    sessions.items(), key=lambda item: -item[1][5]
)[:10]:
    input_tokens, output_tokens, cache_tokens, messages, models, _ = values
    total = input_tokens + output_tokens + cache_tokens
    model = ",".join(key for key, _ in models.most_common()) or "?"
    print(
        f"{session_id[:22]} {input_tokens:>9,} in {output_tokens:>8,} out "
        f"{cache_tokens:>11,} cache {total:>12,} total {messages:>4} msg {model}"
    )
PY
