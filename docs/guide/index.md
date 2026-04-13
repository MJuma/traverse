# Introduction

Traverse is an open-source KQL (Kusto Query Language) query editor built with React. It provides a full-featured Azure Data Explorer experience that you can embed in your own applications or run as a standalone web/desktop app.

## Packages

| Package | Description |
|---------|-------------|
| `traverse-core` | Component library — Explorer, KQL editor, results table, charts, schema browser |
| `traverse-web` | Standalone web SPA with MSAL authentication |
| `traverse-desktop` | Tauri 2 desktop app with MSAL authentication |

## Features

- **Monaco KQL Editor** — Syntax highlighting, contextual autocomplete from live cluster schema, statement detection, query formatting
- **Multi-Cluster Connections** — Connect to any ADX cluster, per-tab connection binding, database auto-discovery
- **Virtual Results Table** — 100K+ row support, column sort/filter, selection aggregates (count, sum, avg, P50/P75/P90), CSV/JSON export
- **Auto-Detected Charts** — 6 Vega-Lite chart types with auto-detection from query result shape
- **Schema Browser** — Live schema tree, search, type badges, context menus, drag-and-drop into editor
- **Query History** — IndexedDB-backed history with full result recall
- **Dark/Light Themes** — System preference detection, customizable color injection
- **Dependency Injection** — All external concerns (auth, colors, clusters) injected via props — no hardcoded config

## Architecture

Traverse is designed around dependency injection. The `Explorer` component accepts all external concerns as props:

```tsx
<Explorer
    isDark={isDark}
    kustoClient={kustoClient}
    colors={explorerColors}
    clusters={wellKnownClusters}
    className={styles.fullPage}
/>
```

The host app provides:
- **Authentication** via `getToken(clusterUrl)` in the `KustoClientConfig`
- **Colors** via `ExplorerColorConfig` (semantic colors + chart palette)
- **Clusters** via `WellKnownCluster[]` (pre-seeded connection list)
- **Theme** via FluentUI's `FluentProvider`

This makes `traverse-core` embeddable in any React application regardless of its auth strategy or design system.
