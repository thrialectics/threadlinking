#!/bin/bash
# track-files.sh - PostToolUse hook for Write/Edit operations
# Tracks files that have been modified during a session for later threadlinking
#
# Usage: Called automatically by Claude Code when Write or Edit tools are used
# Args: $1 = file path that was written/edited (from $CLAUDE_FILE)

FILE_PATH="$1"

# Exit if no file path provided
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Pending files storage location
PENDING_FILE="$HOME/.threadlinking/pending_files.json"
THREADLINKING_DIR="$HOME/.threadlinking"

# Ensure directory exists
mkdir -p "$THREADLINKING_DIR"

# Initialize pending file if it doesn't exist
if [ ! -f "$PENDING_FILE" ]; then
    echo '{"files":[],"session_start":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$PENDING_FILE"
fi

# Convert to absolute path if needed
if [[ "$FILE_PATH" != /* ]]; then
    FILE_PATH="$(cd "$(dirname "$FILE_PATH")" 2>/dev/null && pwd)/$(basename "$FILE_PATH")"
fi

# Check if file is already tracked (avoid duplicates)
if grep -q "\"$FILE_PATH\"" "$PENDING_FILE" 2>/dev/null; then
    exit 0
fi

# Detect project root for this file
FILE_PROJECT=""
FILE_DIR=$(dirname "$FILE_PATH")

if [ -d "$FILE_DIR" ]; then
    # Save current dir and move to file's directory
    ORIG_DIR=$(pwd)
    cd "$FILE_DIR" 2>/dev/null

    # Try git first (most reliable)
    if git rev-parse --show-toplevel &>/dev/null; then
        FILE_PROJECT=$(git rev-parse --show-toplevel)
    else
        # Walk up looking for project markers
        CHECK_DIR="$FILE_DIR"
        while [ "$CHECK_DIR" != "/" ] && [ "$CHECK_DIR" != "$HOME" ]; do
            if [ -f "$CHECK_DIR/package.json" ] || \
               [ -f "$CHECK_DIR/CLAUDE.md" ] || \
               [ -f "$CHECK_DIR/pyproject.toml" ] || \
               [ -f "$CHECK_DIR/Cargo.toml" ] || \
               [ -d "$CHECK_DIR/.git" ]; then
                FILE_PROJECT="$CHECK_DIR"
                break
            fi
            CHECK_DIR=$(dirname "$CHECK_DIR")
        done
    fi

    # Return to original directory
    cd "$ORIG_DIR" 2>/dev/null
fi

# Add file to pending list
if command -v jq &> /dev/null; then
    # Use jq for proper JSON handling (includes project root)
    jq --arg file "$FILE_PATH" \
       --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg project "$FILE_PROJECT" \
       '.files += [{"path": $file, "modified": $ts, "project": $project}]' \
       "$PENDING_FILE" > "$PENDING_FILE.tmp" \
       && mv "$PENDING_FILE.tmp" "$PENDING_FILE"
else
    # Fallback: simple text manipulation (no project tracking)
    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    sed -i.bak 's/"files":\[/"files":[{"path":"'"$FILE_PATH"'","modified":"'"$TIMESTAMP"'","project":"'"$FILE_PROJECT"'"},/' "$PENDING_FILE" 2>/dev/null
    # Clean up empty entry if first file
    sed -i.bak 's/,\]/]/' "$PENDING_FILE" 2>/dev/null
    rm -f "$PENDING_FILE.bak"
fi

exit 0
