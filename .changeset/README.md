# Changesets

This repository uses [changesets](https://github.com/changesets/changesets) to manage versioning and changelogs for the published `@mhjuma/traverse` package.

## When do I need a changeset?

Only when your PR modifies files in `packages/core/` — the source that ships as `@mhjuma/traverse` on npm. Changes to the desktop app, web app, docs, or CI configuration do **not** require a changeset.

## Workflow

### 1. Create a changeset

After making your changes, run:

```bash
pnpm changeset
```

Follow the prompts to select the package (`@mhjuma/traverse`), the semver bump type (`patch`, `minor`, or `major`), and a summary of the change.

This creates a markdown file in the `.changeset/` directory describing your change.

### 2. Consume the changeset (bump version + update changelog)

```bash
pnpm changeset:version
```

This removes the changeset file, bumps the version in `packages/core/package.json`, and updates `CHANGELOG.md`.

### 3. Commit and push

Commit the version bump, changelog update, and any remaining changeset files together with your code changes. Push and open (or update) your PR.

### 4. CI validation

The CI workflow checks that:

- If `packages/core/` was modified, the version has been bumped (no unconsumed changesets remain).
- If no core files changed, no changeset is required.

### 5. Publishing

When your PR merges to `master`, the `publish.yml` workflow automatically publishes the new version to npm if the version has changed.
