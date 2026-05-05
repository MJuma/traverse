# Contributing to Traverse

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/MJuma/traverse.git
cd traverse
pnpm install
```

## Workflow

1. Fork the repo and create a branch from `master`
2. Make your changes
3. Ensure `pnpm build && pnpm lint && pnpm test` all pass
4. If your change modifies `packages/core/`, create a changeset and bump the version:
   ```bash
   pnpm changeset              # describe the change and bump type
   pnpm changeset:version      # bump version + update CHANGELOG.md
   ```
5. Commit and open a pull request

Changes to `packages/core/` require a version bump — the CI will enforce this. See `.changeset/README.md` for details.

## Code Style

- 4-space indentation
- Always use curly braces for if/else/for/while
- Import order: external → workspace → relative (separated by blank lines)
- Imports before `vi.mock()` calls in spec files
- Test files: `.spec.ts` / `.spec.tsx`, co-located with source
- Pure logic extracted to `ComponentName.logic.ts`

## Testing

- All changes must pass existing tests
- New features should include tests
- Coverage thresholds: 85% statements, 80% branches, 85% functions, 85% lines
- Suppress `console.error`/`console.warn` in specs via `beforeEach`

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add column resize handles
fix: correct chart axis colors in dark mode
docs: update quick start guide
test: add ResultsTable filter specs
```

## Reporting Issues

Use [GitHub Issues](https://github.com/MJuma/traverse/issues). Include:
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS/Node version
