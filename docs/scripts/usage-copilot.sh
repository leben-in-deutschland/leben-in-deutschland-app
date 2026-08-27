#!/usr/bin/env bash
# Real token usage for a GitHub Copilot CLI session from its local event log.
# Closed session: canonical session.shutdown.modelMetrics totals.
# Live session: visible main-agent output plus subagent totals.
# Usage: docs/scripts/usage-copilot.sh [session-id]
set -eu

STATE_DIR="${COPILOT_STATE_DIR:-$HOME/.copilot/session-state}"
if [ "${1:-}" != "" ]; then
    EVENTS="$STATE_DIR/$1/events.jsonl"
else
    EVENTS="$(ls -t "$STATE_DIR"/*/events.jsonl 2>/dev/null | head -1 || true)"
fi

[ -n "${EVENTS:-}" ] && [ -f "$EVENTS" ] || {
    echo "No events.jsonl found in $STATE_DIR" >&2
    exit 1
}

SESSION_ID="$(basename "$(dirname "$EVENTS")")"

python3 - "$EVENTS" "$SESSION_ID" <<'PY'
import collections
import json
import sys

events, session_id = sys.argv[1], sys.argv[2]
main_output = collections.Counter()
main_messages = collections.Counter()
subagent_total = collections.Counter()
subagent_runs = collections.Counter()
selected_model = context_tier = reasoning_effort = None
context = {}
shutdown = None

for line in open(events, errors="ignore"):
    if '"type"' not in line:
        continue
    try:
        event = json.loads(line)
    except Exception:
        continue

    event_type = event.get("type")
    data = event.get("data", {}) or {}

    if event_type in (
        "session.resume",
        "assistant.turn_start",
        "assistant.message",
        "subagent.completed",
        "session.model_change",
    ):
        shutdown = None

    if event_type == "session.start":
        selected_model = data.get("selectedModel") or selected_model
        context_tier = data.get("contextTier") or context_tier
        reasoning_effort = data.get("reasoningEffort") or reasoning_effort
    elif event_type == "session.resume":
        selected_model = data.get("selectedModel") or selected_model
        context_tier = data.get("contextTier") or context_tier
    elif event_type == "session.model_change":
        selected_model = data.get("newModel") or selected_model
        context_tier = data.get("contextTier") or context_tier
        reasoning_effort = data.get("reasoningEffort") or reasoning_effort
    elif event_type == "assistant.message":
        tokens = data.get("outputTokens", 0) or 0
        if tokens:
            model = data.get("model", "?")
            main_output[model] += tokens
            main_messages[model] += 1
    elif event_type == "subagent.completed":
        tokens = data.get("totalTokens", 0) or 0
        if tokens:
            model = data.get("model", "?")
            subagent_total[model] += tokens
            subagent_runs[model] += 1
    elif event_type in ("session.compaction_start", "session.shutdown", "session.truncation"):
        for key in ("systemTokens", "conversationTokens", "toolDefinitionsTokens", "currentTokens"):
            if isinstance(data.get(key), int):
                context[key] = data[key]
        if event_type == "session.shutdown":
            shutdown = data

models_seen = list((main_output + subagent_total).keys())
models = ", ".join(models_seen) or selected_model or "?"
print(
    f"Session : {session_id[:8]}   Model: {models} "
    f"(selected: {selected_model}) tier={context_tier} effort={reasoning_effort}"
)

metrics = (shutdown or {}).get("modelMetrics") or {}
if metrics:
    total_input = total_output = total_cache = 0
    for model, values in sorted(metrics.items()):
        usage = values.get("usage", {}) or {}
        input_tokens = usage.get("inputTokens", 0) or 0
        output_tokens = usage.get("outputTokens", 0) or 0
        cache_tokens = (usage.get("cacheReadTokens", 0) or 0) + (
            usage.get("cacheWriteTokens", 0) or 0
        )
        total = input_tokens + output_tokens
        total_input += input_tokens
        total_output += output_tokens
        total_cache += cache_tokens
        print(
            f"  {model:16s} {input_tokens:>9,} in {output_tokens:>8,} out "
            f"({cache_tokens:>10,} cached input) {total:>11,} total"
        )
    grand_total = total_input + total_output
    print(
        f"Tokens  : {total_input:,} in / {total_output:,} out / "
        f"{grand_total:,} total ({total_cache:,} cached input) [final]"
    )
elif shutdown:
    details = shutdown.get("tokenDetails", {}) or {}

    def token_count(key):
        return (details.get(key) or {}).get("tokenCount", 0) or 0

    uncached_input = token_count("input")
    output_tokens = token_count("output")
    cache_tokens = token_count("cache_read") + token_count("cache_write")
    input_tokens = uncached_input + cache_tokens
    total = input_tokens + output_tokens
    print(
        f"Tokens  : {input_tokens:,} in / {output_tokens:,} out / "
        f"{total:,} total ({cache_tokens:,} cached input) [final, main agent]"
    )
else:
    main_total = sum(main_output.values())
    sub_total = sum(subagent_total.values())
    for model, tokens in main_output.most_common():
        print(f"  main   {model:16s} {tokens:>10,} out ({main_messages[model]} messages)")
    for model, tokens in subagent_total.most_common():
        print(f"  subagt {model:16s} {tokens:>10,} total ({subagent_runs[model]} runs)")
    print(
        f"Tokens  : n/a in / {main_total:,} main out + {sub_total:,} "
        f"subagent total [interim, live]"
    )

if context:
    visible_context = context.get("currentTokens", sum(context.values()))
    print(f"Context : ~{visible_context:,} {context}")
PY
