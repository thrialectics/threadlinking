#!/bin/bash
# session-start.sh - SessionStart hook for threadlinking
# Shows pending files and active threads at the start of each Claude Code session
# Directory-aware: filters to current project when in a project directory
#
# Usage: Called automatically by Claude Code at session start

PENDING_FILE="$HOME/.threadlinking/pending_files.json"
INDEX_FILE="$HOME/.threadlinking/thread_index.json"

# Check if threadlinking is set up
if [ ! -d "$HOME/.threadlinking" ]; then
    exit 0
fi

# Detect project root for current directory
PROJECT_ROOT=""
CURRENT_DIR=$(pwd)

# Exclude home directory itself from being a "project"
if [ "$CURRENT_DIR" = "$HOME" ]; then
    PROJECT_ROOT=""
# Try git first (most reliable)
elif git rev-parse --show-toplevel &>/dev/null; then
    PROJECT_ROOT=$(git rev-parse --show-toplevel)
    # But not if git root is home directory
    if [ "$PROJECT_ROOT" = "$HOME" ]; then
        PROJECT_ROOT=""
    fi
else
    # Check for project markers in current directory
    if [ -f "package.json" ] || \
       [ -f "CLAUDE.md" ] || \
       [ -f "pyproject.toml" ] || \
       [ -f "Cargo.toml" ] || \
       [ -d ".git" ]; then
        PROJECT_ROOT="$CURRENT_DIR"
    fi
fi

# Count total threads
TOTAL_THREADS=0
if [ -f "$INDEX_FILE" ]; then
    if command -v jq &> /dev/null; then
        TOTAL_THREADS=$(jq 'keys | length' "$INDEX_FILE" 2>/dev/null || echo 0)
    else
        TOTAL_THREADS=$(grep -o '"snippets"' "$INDEX_FILE" 2>/dev/null | wc -l | tr -d ' ')
    fi
fi

# Count total pending files
TOTAL_PENDING=0
if [ -f "$PENDING_FILE" ]; then
    if command -v jq &> /dev/null; then
        TOTAL_PENDING=$(jq '.files | length' "$PENDING_FILE" 2>/dev/null || echo 0)
    else
        TOTAL_PENDING=$(grep -o '"path"' "$PENDING_FILE" 2>/dev/null | wc -l | tr -d ' ')
    fi
fi

# If no threadlinking data at all, exit silently
if [ "$TOTAL_THREADS" -eq 0 ] && [ "$TOTAL_PENDING" -eq 0 ]; then
    exit 0
fi

# If not in a project directory, show global summary
if [ -z "$PROJECT_ROOT" ]; then
    echo "=== Threadlinking (Global) ==="
    echo "$TOTAL_THREADS threads | $TOTAL_PENDING pending files"
    echo "==============================="
    exit 0
fi

# In a project directory - filter to this project
PROJECT_NAME=$(basename "$PROJECT_ROOT")

if command -v jq &> /dev/null; then
    # Count threads with linked_files under PROJECT_ROOT
    RELEVANT_THREADS=$(jq -r --arg root "$PROJECT_ROOT" '
      [to_entries[] | select(
        .value.linked_files | if . then any(startswith($root)) else false end
      )] | length
    ' "$INDEX_FILE" 2>/dev/null || echo 0)

    # Get thread names for this project
    THREAD_NAMES=$(jq -r --arg root "$PROJECT_ROOT" '
      [to_entries[] | select(
        .value.linked_files | if . then any(startswith($root)) else false end
      ) | .key] | join(", ")
    ' "$INDEX_FILE" 2>/dev/null)

    # Count pending files under PROJECT_ROOT (check both path prefix and project field)
    RELEVANT_PENDING=$(jq -r --arg root "$PROJECT_ROOT" '
      [.files[] | select(
        (.path | startswith($root)) or (.project == $root)
      )] | length
    ' "$PENDING_FILE" 2>/dev/null || echo 0)
else
    # Fallback without jq - rough estimate
    RELEVANT_THREADS=$(grep -l "$PROJECT_ROOT" "$INDEX_FILE" 2>/dev/null | wc -l | tr -d ' ')
    RELEVANT_PENDING=$(grep "$PROJECT_ROOT" "$PENDING_FILE" 2>/dev/null | grep -o '"path"' | wc -l | tr -d ' ')
    THREAD_NAMES=""
fi

# Only show output if there's something relevant to this project
if [ "$RELEVANT_THREADS" -gt 0 ] || [ "$RELEVANT_PENDING" -gt 0 ]; then
    echo "=== Threadlinking: $PROJECT_NAME ==="

    if [ "$RELEVANT_THREADS" -gt 0 ]; then
        if [ -n "$THREAD_NAMES" ]; then
            echo "Threads: $THREAD_NAMES"
        else
            echo "Threads: $RELEVANT_THREADS"
        fi
    fi

    if [ "$RELEVANT_PENDING" -gt 0 ]; then
        echo "Pending: $RELEVANT_PENDING files not yet linked"
    fi

    echo "======================================="
fi

exit 0
