#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION=$(tr -d '[:space:]' < "$REPO_ROOT/VERSION")

[ -z "$VERSION" ] && exit 0
echo "🏷️ Syncing version $VERSION..."

# Update dashboard package.json files
sed -i -E "s/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/" "$REPO_ROOT"/services/dashboard/*/package.json 2>/dev/null || true

echo "✅ Version sync complete!"
