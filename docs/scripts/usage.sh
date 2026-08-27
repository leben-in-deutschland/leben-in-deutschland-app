#!/usr/bin/env bash
# Unified token report across AI coding runners. Each collector reads the
# runner's own local logs and reports real token fields only.
#
#   claude    Claude Code (CLI, IDE extensions, desktop)   ~/.claude/projects
#   copilot   GitHub Copilot CLI                           ~/.copilot/session-state
#   opencode  OpenCode (TUI and IDE)                       ~/.local/share/opencode
#   codex     OpenAI Codex (CLI and IDE extension)         ~/.codex/sessions
#   vscode    VS Code Copilot Chat                         VS Code chatSessions
#   cursor    Cursor IDE                                   Cursor state.vscdb
#
# VS Code Copilot Chat and Cursor do not keep token counts in their local
# stores. Their collectors report n/a instead of guessing.
#
# Usage: docs/scripts/usage.sh [all|claude|copilot|opencode|codex|vscode|cursor] [session-id]
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
PICK="${1:-all}"
SID="${2:-}"

case "$PICK" in
    all|claude|copilot|opencode|codex|vscode|cursor) ;;
    *)
        SID="$PICK"
        PICK="all"
        ;;
esac

ran=0

run() {
    # $1 name, $2 data path, $3 collector
    [ "$PICK" = "all" ] || [ "$PICK" = "$1" ] || return 0
    if [ -e "$2" ]; then
        echo "== $1 =="
        "$HERE/$3" "$SID" || true
        ran=1
    else
        if [ "$PICK" = "$1" ]; then
            echo "$1: not detected ($2 missing)"
            ran=1
        else
            echo "== $1 == not detected"
        fi
    fi
    echo
}

CLAUDE_ROOT="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
[ -d "$CLAUDE_ROOT" ] || CLAUDE_ROOT="$HOME/.config/claude"
run claude   "$CLAUDE_ROOT"                                                     usage-claude.sh
run copilot  "${COPILOT_STATE_DIR:-$HOME/.copilot/session-state}"             usage-copilot.sh
run opencode "${OPENCODE_STORE:-$HOME/.local/share/opencode/storage/message}" usage-opencode.sh
run codex    "${CODEX_HOME:-$HOME/.codex}/sessions"                           usage-codex.sh

VSCODE_USER="$HOME/Library/Application Support/Code/User"
[ -d "$VSCODE_USER" ] || VSCODE_USER="$HOME/.config/Code/User"
run vscode "$VSCODE_USER" usage-vscode.sh

CURSOR_DB="$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
[ -f "$CURSOR_DB" ] || CURSOR_DB="$HOME/.config/Cursor/User/globalStorage/state.vscdb"
run cursor "$CURSOR_DB" usage-cursor.sh

[ "$ran" = 1 ] || echo "No supported AI-runner logs detected on this machine."
