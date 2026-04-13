# Traverse

Open-source KQL query editor. pnpm monorepo with 3 packages.

## Repository Structure

| Directory | Package | Description |
|-----------|---------|-------------|
| `packages/core/` | `traverse-core` | Component library — Explorer, KQL editor, results, charts, schema |
| `packages/web/` | `traverse-web` | Standalone web SPA with MSAL auth |
| `packages/desktop/` | `traverse-desktop` | Tauri 2 desktop wrapper |
| `docs/` | — | VitePress documentation site |

## Commands (pnpm, not npm)

```bash
pnpm build           # Build all
pnpm lint            # Lint all
pnpm test            # Test all
pnpm build:core      # Build core only
pnpm test:core       # Test core only
pnpm serve:web       # Run web app
pnpm docs:dev        # Preview docs
```

## Dependency Management

All versions centralized in `pnpm-workspace.yaml`:
- `catalog:` — runtime dependencies
- `catalog:development` — dev dependencies

Add dependencies: `pnpm add <pkg> --filter <package-name>`

## Code Style

- **4-space indentation** (enforced by `.editorconfig` if present)
- **Always use curly braces** for if/else/for/while — no single-line conditionals
- **Import order**: (1) external → (2) workspace packages → (3) relative, separated by blank lines
- **Imports before mocks** in spec files: all `import` statements first, then `vi.mock()` calls
- **Test files**: `.spec.ts` / `.spec.tsx`, co-located with source
- **Pure logic**: extracted to `ComponentName.logic.ts` for independent testability
- **Sub-components**: extracted to sibling files in the same directory
- **Context per file**: each React context in its own file under `context/`

## Architecture (traverse-core)

The `Explorer` component is the root entry point. All external concerns are injected:

| Concern | How |
|---------|-----|
| Auth tokens | `getToken(clusterUrl)` in `KustoClientConfig` |
| Colors | `colors` prop (`ExplorerColorConfig`) |
| Dark mode | `isDark` prop (flows to Monaco, charts, tables) |
| Clusters | `clusters` prop (`WellKnownCluster[]`) |
| Theme | Host wraps with `FluentProvider` |

### Component Hierarchy

```
Explorer (provider — colors, state, kusto contexts)
└── ExplorerWorkspace (editor + results + sidebar)
    ├── EditorToolbar (run, format, connection picker)
    ├── TabBar → TabItem (query tabs)
    ├── Monaco Editor (KQL via kqlLanguage.ts)
    ├── SchemaSidebar → FolderRow, SchemaTableItem, SchemaColumnItem
    └── ResultsPanel → ResultsTable, ChartPanel
```

### Key Services

- `createKustoClient()` — Query/mgmt with caching, dedup, retry, concurrency limiting
- `StateService` — Two-tier memory + IndexedDB state (stores: config, queryCache, explorerCache, explorerConnections)
- `loadSchema()` / `getSchema()` — Live cluster schema with per-cluster caching
- `useKustoQuery()` — React hook for KQL execution

## Testing

- **Vitest** with jsdom, v8 coverage provider
- **Coverage thresholds**: 85% statements, 80% branches, 85% functions, 85% lines
- Suppress `console.error`/`console.warn` in all specs via `beforeEach`
- Zero stderr output from test runs

## Linting

- **oxlint** with type-aware rules (`--type-aware` flag)
- Base config: `oxlintrc.json` (all projects)
- React overlay: `oxlintrc.react.json` (React projects)
- `oxlint-tsgolint` companion package required for type-aware rules
