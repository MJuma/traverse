# Quick Start

## Prerequisites

- Node.js 22+
- pnpm 10+

## Installation

```bash
git clone https://github.com/MJuma/traverse.git
cd traverse
pnpm install
```

## Development

```bash
# Build all packages
pnpm build

# Run the web app
pnpm serve:web

# Run tests
pnpm test:core

# Lint
pnpm lint
```

## Using traverse-core in your app

Install the package:

```bash
pnpm add traverse-core
```

### Basic embedding

```tsx
import { Explorer, createKustoClient, KustoClientContext } from 'traverse-core';
import type { ExplorerColorConfig } from 'traverse-core';
import { FluentProvider, webDarkTheme } from '@fluentui/react-components';

const colors: ExplorerColorConfig = {
    semantic: {
        backdrop: 'rgba(0, 0, 0, 0.4)',
        functionBadge: '#4caf50',
        highlightHoverBg: 'rgba(255, 200, 0, 0.2)',
        lookupBadge: '#e8912d',
        materializedViewBadge: '#9c6ade',
        scrollThumb: 'rgba(128, 128, 128, 0.4)',
        scrollThumbHover: 'rgba(128, 128, 128, 0.6)',
        selectionBg: 'rgba(0, 120, 212, 0.15)',
        selectionSubtle: 'rgba(0, 120, 212, 0.06)',
        shadowLight: 'rgba(0, 0, 0, 0.15)',
        shadowMedium: 'rgba(0, 0, 0, 0.3)',
    },
    chart: {
        palette: ['#6a8799', '#909d63', '#ebc17a', '#bc5653', '#b06698'],
    },
};

const client = createKustoClient({
    defaultTarget: { clusterUrl: 'https://help.kusto.windows.net', database: 'Samples' },
    getToken: async (clusterUrl) => {
        // Your auth logic here
        return 'bearer-token';
    },
    stateService,
});

function App() {
    return (
        <FluentProvider theme={webDarkTheme}>
            <KustoClientContext.Provider value={client}>
                <Explorer
                    isDark={true}
                    kustoClient={client}
                    colors={colors}
                    clusters={[{ id: 'help', name: 'help (Samples)', clusterUrl: 'https://help.kusto.windows.net', database: 'Samples' }]}
                />
            </KustoClientContext.Provider>
        </FluentProvider>
    );
}
```

### Using bootstrapExplorer

For standalone apps with MSAL authentication, use the `bootstrapExplorer` helper:

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

This handles MSAL initialization, redirect auth flow, StateService hydration, theme management, and renders the Explorer into `#root`.
