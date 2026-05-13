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
import { Explorer, createKustoClient, KustoClientContext, configureTraverseMonacoWorkers } from 'traverse-core';
import type { ExplorerColorConfig } from 'traverse-core';
import { FluentProvider, webDarkTheme } from '@fluentui/react-components';

// Wire up Monaco workers BEFORE mounting Explorer. With Vite:
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import kustoWorker from '@kusto/monaco-kusto/release/esm/kusto.worker.js?worker';
configureTraverseMonacoWorkers({
    getEditorWorker: () => new editorWorker(),
    getKustoWorker: () => new kustoWorker(),
});

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

## Monaco peer dependencies

`traverse-core` ships KQL IntelliSense via the official `@kusto/monaco-kusto`
language service, which runs the Kusto.Language engine in a Web Worker. To
ensure a single Monaco instance is shared across the editor and the language
plugin, `monaco-editor` and `@monaco-editor/react` are declared as **peer
dependencies** — your host app must install them at compatible versions:

```bash
pnpm add monaco-editor@0.52.2 @monaco-editor/react @kusto/monaco-kusto
```

> `monaco-editor` must be pinned to `0.52.x` until `@kusto/monaco-kusto`
> publishes a release that supports the strict `exports` map introduced in
> `0.55+`.

### Workers in non-Vite hosts

For Webpack, Next.js, or other non-Vite bundlers, call
`configureTraverseMonacoWorkers` with bundler-specific worker constructors
before any editor mounts. The Vite recipe shown above is the most common; for
Webpack, use the `worker-loader` package or your bundler's worker emitter to
return a `Worker` instance from the factory callbacks.

### Vite dev-mode setup

`@kusto/monaco-kusto`'s worker entry has two quirks that bite hard in
Vite's dev server (production builds via Rollup are unaffected):

1. **CommonJS deps in the worker import chain.** Vite's dep optimizer only
   auto-scans the main-thread import graph, so `xregexp` and the four
   Bridge.NET IIFE scripts (`bridge.min`, `Kusto.JavaScript.Client.min`,
   `newtonsoft.json.min`, `Kusto.Language.Bridge.min`) are served as raw
   CJS that fails to evaluate as ES modules inside the worker. Force the
   optimizer to pre-bundle them via `optimizeDeps.include`.
2. **Node-globals.** `@kusto/language-service` references `Buffer`,
   `process`, and friends, so the worker needs `vite-plugin-node-polyfills`.

The shape below mirrors the upstream `samples/esm-vite` config (adapted for
pnpm, where transitive deps require the `parent > child` form):

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
    plugins: [
        /* ...your plugins, */
        nodePolyfills({ overrides: { fs: null } }),
    ],
    optimizeDeps: {
        include: [
            'monaco-editor/esm/vs/editor/editor.worker',
            '@kusto/monaco-kusto/release/esm/kusto.worker',
            '@kusto/monaco-kusto > xregexp',
            '@kusto/monaco-kusto > @kusto/language-service/bridge.min',
            '@kusto/monaco-kusto > @kusto/language-service/Kusto.JavaScript.Client.min',
            '@kusto/monaco-kusto > @kusto/language-service/newtonsoft.json.min',
            '@kusto/monaco-kusto > @kusto/language-service-next/Kusto.Language.Bridge.min',
        ],
    },
});
```

If a host project lifts `@kusto/language-service` and friends to direct
dependencies (or doesn't use pnpm), the bare specifiers from the upstream
sample work directly — drop the `@kusto/monaco-kusto > ` prefix.

#### Defense-in-depth: Bridge.NET shim

The pre-bundled output above wraps Bridge.NET in esbuild's CJS-to-ESM
adapter, which is normally enough. As a safety net for code paths that
serve those files outside the optimizer (e.g. during initial cold-start
before optimization completes), you can also register a tiny `transform`
plugin that primes the IIFE's CJS escape hatch:

```ts
import type { Plugin } from 'vite';

const BRIDGE_NET_FILE_PATTERN =
    /[\\/]@kusto[\\/](language-service|language-service-next)[\\/](bridge\.min|Kusto\.JavaScript\.Client\.min|newtonsoft\.json\.min|Kusto\.Language\.Bridge\.min)\.js(\?|$)/;

function kustoBridgeShim(): Plugin {
    return {
        name: 'kusto-bridge-shim',
        enforce: 'pre',
        transform(code, id) {
            if (!BRIDGE_NET_FILE_PATTERN.test(id)) {
                return null;
            }
            const shim =
                'var global=globalThis;var module={exports:{}};var exports=module.exports;\n';
            return { code: shim + code, map: null };
        },
    };
}
```

### Perceived-perf: pre-warm the kusto worker

The kusto worker's top-level evaluation (Bridge.NET, ~MB of generated code)
is the slowest single step in the editor's startup path. By default Monaco
only constructs the worker on first kusto-model interaction, so semantic
syntax-highlighting "pops in" a beat after the editor first paints.

Pre-warm both workers eagerly during `requestIdleCallback` to overlap that
evaluation with React render + auth init. The `<Explorer>` host can hand
the warm worker back to Monaco when it finally asks:

```ts
// monacoWorkers.ts
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import KustoWorker from '@kusto/monaco-kusto/release/esm/kusto.worker.js?worker';
import { configureTraverseMonacoWorkers } from '@mhjuma/traverse';

let warmEditorWorker: Worker | null = null;
let warmKustoWorker: Worker | null = null;

function takeWarmWorker(label: 'editor' | 'kusto'): Worker {
    if (label === 'editor') {
        const w = warmEditorWorker;
        warmEditorWorker = null;
        return w ?? new EditorWorker();
    }
    const w = warmKustoWorker;
    warmKustoWorker = null;
    return w ?? new KustoWorker();
}

export function configureAppMonacoWorkers(): void {
    configureTraverseMonacoWorkers({
        getEditorWorker: () => takeWarmWorker('editor'),
        getKustoWorker: () => takeWarmWorker('kusto'),
    });
    if (typeof window === 'undefined') return;
    const prewarm = () => {
        try {
            warmEditorWorker ??= new EditorWorker();
            warmKustoWorker ??= new KustoWorker();
        } catch { /* fall back to lazy spawn */ }
    };
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(prewarm, { timeout: 1500 });
    } else {
        setTimeout(prewarm, 0);
    }
}
```

`traverse-core` itself complements this by pre-bootstrapping the kusto
language inside `monacoLoader.ts` (registers Monarch tokens + themes during
module load), so first paint already shows colored keywords and strings —
no consumer wiring needed for that piece.
