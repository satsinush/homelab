#!/usr/bin/env bash
# Helper script to sync version string from VERSION file across package.json and CMake files.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="$REPO_ROOT/VERSION"

if [ ! -f "$VERSION_FILE" ]; then
    echo "⚠️ VERSION file not found at $VERSION_FILE"
    exit 0
fi

VERSION=$(tr -d '[:space:]' < "$VERSION_FILE")

if [ -z "$VERSION" ]; then
    echo "⚠️ VERSION file is empty"
    exit 0
fi

echo "🏷️ Syncing version $VERSION across project files..."

# Helper function to update "version": "..." in JSON
update_npm_version() {
    local file="$1"
    if [ -f "$file" ]; then
        if command -v node >/dev/null 2>&1; then
            node -e '
                const fs = require("fs");
                const file = process.argv[1];
                const version = process.argv[2];
                const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
                if (pkg.version !== version) {
                    pkg.version = version;
                    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
                    console.log(`  → Updated ${file} to version ${version}`);
                }
            ' "$file" "$VERSION"
        else
            sed -i -E "s/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/" "$file"
            echo "  → Updated $file to version $VERSION"
        fi
    fi
}

# 1. Update Node Package Versions
update_npm_version "$REPO_ROOT/services/dashboard/frontend/package.json"
update_npm_version "$REPO_ROOT/services/dashboard/api/package.json"
update_npm_version "$REPO_ROOT/services/dashboard/host-api/package.json"

# 2. Update word_games VERSION file and delegate to word_games/scripts/sync-version.sh
WORD_GAMES_VERSION_FILE="$REPO_ROOT/word_games/VERSION"
if [ -f "$WORD_GAMES_VERSION_FILE" ]; then
    echo "$VERSION" > "$WORD_GAMES_VERSION_FILE"
fi

if [ -x "$REPO_ROOT/word_games/scripts/sync-version.sh" ]; then
    "$REPO_ROOT/word_games/scripts/sync-version.sh"
fi

echo "✅ Version sync complete!"
