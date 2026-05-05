#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

MODE="${1:-}"
CHANGESET_DIR=".changeset"
PACKAGE_JSON="packages/core/package.json"

count_changesets() {
    if [[ ! -d "$CHANGESET_DIR" ]]; then
        echo "0"
        return
    fi
    find "$CHANGESET_DIR" -maxdepth 1 -name '*.md' ! -name 'README.md' | wc -l | tr -d ' '
}

get_registry() {
    node -p "require('./${PACKAGE_JSON}').publishConfig?.registry || 'https://registry.npmjs.org'" 2>/dev/null || echo "https://registry.npmjs.org"
}

has_version_bump() {
    local target_ref="$1"
    local current_version
    current_version=$(node -p "require('./${PACKAGE_JSON}').version")
    local target_version
    target_version=$(git show "${target_ref}:${PACKAGE_JSON}" 2>/dev/null | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).version" 2>/dev/null || echo "")
    if [[ -z "$target_version" ]]; then
        return 0
    fi
    [[ "$current_version" != "$target_version" ]]
}

# PR mode
if [[ "$MODE" == "pr" ]]; then
    TARGET_REF="origin/${GITHUB_BASE_REF:-master}"

    if ! git rev-parse --verify "$TARGET_REF" >/dev/null 2>&1; then
        echo "❌ Cannot resolve target ref '${TARGET_REF}'. Ensure fetch-depth: 0."
        exit 1
    fi

    CHANGED_FILES=$(git diff --name-only "${TARGET_REF}...HEAD" -- 'packages/core/')
    if [[ -z "$CHANGED_FILES" ]]; then
        echo "✅ No core package changes detected — changeset not required."
        exit 0
    fi

    echo "📦 Core package files changed:"
    echo "$CHANGED_FILES" | head -10
    echo ""

    CHANGESET_COUNT=$(count_changesets)
    if [[ "$CHANGESET_COUNT" -gt 0 ]]; then
        echo "⚠️  Found $CHANGESET_COUNT unconsumed changeset file(s)."
        echo "Run 'pnpm changeset:version' to bump the version and consume them before merging."
        exit 1
    fi

    if has_version_bump "$TARGET_REF"; then
        echo "✅ Version bump detected in ${PACKAGE_JSON} — changeset already consumed."
        exit 0
    fi

    echo "❌ No changeset or version bump found."
    echo ""
    echo "To prepare this PR for publishing:"
    echo "  1. Run 'pnpm changeset' to create a changeset file"
    echo "  2. Run 'pnpm changeset:version' to bump the version"
    echo "  3. Commit both the version bump and changelog"
    exit 1

# Publish mode
elif [[ "$MODE" == "publish" ]]; then
    CHANGESET_COUNT=$(count_changesets)
    if [[ "$CHANGESET_COUNT" -gt 0 ]]; then
        echo "❌ Found $CHANGESET_COUNT unconsumed changeset file(s)."
        echo "Run 'pnpm changeset:version' and commit the result before merging."
        exit 1
    fi

    PACKAGE_NAME=$(node -p "require('./${PACKAGE_JSON}').name")
    LOCAL_VERSION=$(node -p "require('./${PACKAGE_JSON}').version")
    REGISTRY=$(get_registry)

    NPM_OUTPUT=""
    NPM_EXIT=0
    NPM_OUTPUT=$(npm view "$PACKAGE_NAME" version --registry "$REGISTRY" 2>&1) || NPM_EXIT=$?

    if [[ "$NPM_EXIT" -ne 0 ]]; then
        if echo "$NPM_OUTPUT" | grep -qi 'E404\|not found\|not in this registry'; then
            echo "📦 Package not yet published — first publish of $PACKAGE_NAME@$LOCAL_VERSION"
            echo "skip_publish=false" >> "$GITHUB_OUTPUT"
            exit 0
        else
            echo "❌ Failed to query registry for $PACKAGE_NAME:"
            echo "$NPM_OUTPUT"
            exit 1
        fi
    fi

    PUBLISHED_VERSION="$NPM_OUTPUT"
    if [[ "$LOCAL_VERSION" != "$PUBLISHED_VERSION" ]]; then
        echo "📦 Version bump detected: $PUBLISHED_VERSION → $LOCAL_VERSION"
        echo "skip_publish=false" >> "$GITHUB_OUTPUT"
        exit 0
    fi

    echo "ℹ️  No version change ($LOCAL_VERSION) — skipping publish."
    echo "skip_publish=true" >> "$GITHUB_OUTPUT"
    exit 0
else
    echo "Usage: check-changeset.sh <pr|publish>"
    exit 1
fi
