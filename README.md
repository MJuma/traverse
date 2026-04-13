# Traverse

An open-source KQL query editor built with React, Monaco, and Vega-Lite.

[![Build](https://github.com/MJuma/traverse/actions/workflows/deploy-docs.yml/badge.svg)](https://github.com/MJuma/traverse/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is Traverse?

Traverse is a full-featured Azure Data Explorer (Kusto) query editor you can embed in your own applications or run as a standalone web/desktop app. It provides the core experience of querying, visualizing, and exploring Kusto data — without being tied to any specific product or infrastructure.

## Features

- **Monaco KQL Editor** — Syntax highlighting, contextual autocomplete from live cluster schema, statement detection, formatting
- **Multi-Cluster Connections** — Connect to any ADX cluster, per-tab connection binding, database auto-discovery
- **Virtual Results Table** — 100K+ row support, column sort/filter, selection aggregates (count, sum, avg, P50/P75/P90), CSV/JSON export
- **Auto-Detected Charts** — 6 Vega-Lite chart types with auto-detection from query result shape
- **Schema Browser** — Live schema tree, search, type badges, context menus, drag-and-drop into editor
- **Query History** — IndexedDB-backed history with full result recall
- **Dark & Light Themes** — System preference detection, fully customizable color injection
- **Dependency Injection** — All external concerns (auth, colors, clusters) injected via props

## Packages

| Package | Description |
|---------|-------------|
| `traverse-core` | Component library — Explorer, KQL editor, results table, charts, schema browser |
| `traverse-web` | Standalone web SPA with MSAL authentication |
| `traverse-desktop` | Tauri 2 desktop wrapper with MSAL authentication |

## Quick Start

```bash
git clone https://github.com/MJuma/traverse.git
cd traverse
pnpm install
pnpm serve:web
```

### Embed in your app

```tsx
import { Explorer, createKustoClient, KustoClientContext } from 'traverse-core';
import { FluentProvider, webDarkTheme } from '@fluentui/react-components';

const client = createKustoClient({
    defaultTarget: { clusterUrl: 'https://help.kusto.windows.net', database: 'Samples' },
    getToken: async (clusterUrl) => fetchMyToken(clusterUrl),
    stateService,
});

<FluentProvider theme={webDarkTheme}>
    <KustoClientContext.Provider value={client}>
        <Explorer isDark={true} kustoClient={client} colors={colors} clusters={clusters} />
    </KustoClientContext.Provider>
</FluentProvider>
```

### Standalone app with MSAL

```tsx
import { bootstrapExplorer } from 'traverse-core';

bootstrapExplorer({
    msalClientId: 'your-client-id',
    tenantId: 'your-tenant-id',
    redirectUri: 'http://localhost:3000',
    clusterUrl: 'https://help.kusto.windows.net',
    database: 'Samples',
});
```

## Development

```bash
pnpm build          # Build all packages
pnpm lint           # Lint all packages
pnpm test           # Test all packages (716 tests, 85%+ coverage)

pnpm build:core     # Build traverse-core only
pnpm test:core      # Test traverse-core only
pnpm serve:web      # Run the web app locally
pnpm docs:dev       # Preview docs site locally
```

## Documentation

Full documentation at [mjuma.github.io/traverse](https://mjuma.github.io/traverse/).

## License

[MIT](LICENSE)
