#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION=$(tr -d '[:space:]' < "$REPO_ROOT/VERSION")

[ -z "$VERSION" ] && exit 0
echo "🏷️ Syncing version $VERSION..."

# Update package.json files and word_games VERSION
sed -i -E "s/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/" "$REPO_ROOT"/services/dashboard/*/package.json 2>/dev/null || true
echo "$VERSION" > "$REPO_ROOT/word_games/VERSION" 2>/dev/null || true

if [ -x "$REPO_ROOT/word_games/scripts/sync-version.sh" ]; then
    "$REPO_ROOT/word_games/scripts/sync-version.sh"
fi

echo "✅ Version sync complete!"
