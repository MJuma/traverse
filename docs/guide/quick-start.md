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

## Using @mhjuma/traverse in your app

Install the package and its peer dependencies. For Vite hosts also install
`vite-plugin-node-polyfills` (used in Step 2 below):

```bash
pnpm add @mhjuma/traverse monaco-editor@0.52 @monaco-editor/react @kusto/monaco-kusto
pnpm add -D vite-plugin-node-polyfills
```

> `monaco-editor` must be pinned to `0.52.x` until `@kusto/monaco-kusto`
> publishes a release compatible with `0.55+` (the worker API changed there
> in ways that break the kusto language plugin's `createWebWorker` integration).
> The traverse package's `peerDependencies` declares `monaco-editor: ^0.52.0`
> so pnpm will warn if you install an incompatible version.

### Step 1: Wire Monaco workers (one source file)

Create `src/monacoWorkers.ts` and side-effect import it from wherever
`<Explorer>` is mounted:

```ts
// src/monacoWorkers.ts
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import KustoWorker from '@kusto/monaco-kusto/release/esm/kusto.worker.js?worker';
import { configureTraverseMonacoWorkers } from '@mhjuma/traverse';

configureTraverseMonacoWorkers({
    getEditorWorker: () => new EditorWorker(),
    getKustoWorker: () => new KustoWorker(),
});
```

```tsx
// src/App.tsx (or wherever you mount Explorer)
import './monacoWorkers';
import { Explorer } from '@mhjuma/traverse';
// ...
```

This boilerplate has to live in your own source tree — Vite's `?worker`
import suffix is bundler-specific and doesn't work when shipped from a
`node_modules` package (Vite's dep optimizer can't bundle `?worker` imports
inside a dependency).

> If you forget this step, `<Explorer>` won't render the editor — it shows
> an actionable placeholder banner with the exact snippet you need.
> Configure once, banner goes away.

### Step 2: Configure Vite (`vite.config.ts`)

```ts
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { traverseVitePlugin } from '@mhjuma/traverse/vite-plugin';

export default defineConfig({
    plugins: [
        /* ...your plugins... */
        // `@kusto/language-service` references Node globals (Buffer, process).
        // Without these polyfills the kusto worker fails to evaluate.
        nodePolyfills({ overrides: { fs: null } }),
        // Bridge.NET CJS shim + `optimizeDeps.include` for the kusto worker
        // entries and their transitive CJS sub-deps.
        traverseVitePlugin(),
    ],
});
```

`@mhjuma/traverse/vite-plugin` exports a single function that:

- **Pre-bundles the kusto worker's transitive CJS deps** (`xregexp` and the
  four Bridge.NET IIFEs) via `optimizeDeps.include`. Vite's dep scanner only
  walks the main-thread import graph in dev — worker import chains are NOT
  followed, so without this they're served as raw CJS and fail to evaluate
  as ES modules inside the worker.

- **Patches the Bridge.NET IIFEs with a CJS-context shim** so they route
  globals to `globalThis` instead of throwing `TypeError: Cannot set
  properties of undefined` in strict ESM context.

`vite-plugin-node-polyfills` stays a separate plugin so you can tune the
polyfill set without forking the traverse plugin.

### Step 3: Mount the Explorer

```tsx
import { Explorer, createKustoClient, KustoClientContext, stateService } from '@mhjuma/traverse';
import type { ExplorerColorConfig } from '@mhjuma/traverse';
import { FluentProvider, webDarkTheme } from '@fluentui/react-components';

import './monacoWorkers';

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

For standalone apps with MSAL authentication, use the `bootstrapExplorer`
helper. Don't forget to side-effect import `./monacoWorkers` first:

```tsx
import './monacoWorkers';
import { bootstrapExplorer } from '@mhjuma/traverse';

bootstrapExplorer({
    msalClientId: 'your-client-id',
    tenantId: 'your-tenant-id',
    redirectUri: 'http://localhost:3000',
    clusterUrl: 'https://help.kusto.windows.net',
    database: 'Samples',
});
```

This handles MSAL initialization (popup + redirect post-back via the MSAL
redirect bridge), StateService hydration, theme management, and renders
the Explorer into `#root`.

## Non-Vite bundlers

For Webpack, Next.js, or other non-Vite bundlers, you still call
`configureTraverseMonacoWorkers` from `monacoWorkers.ts` — just use your
bundler's worker emitter to construct the workers. The
`@mhjuma/traverse/vite-plugin` is Vite-only; non-Vite bundlers need an
equivalent build-time integration to:

- Pre-bundle the kusto worker's CJS sub-deps (`xregexp` + the four
  Bridge.NET IIFEs) as ESM.
- Polyfill `Buffer` / `process` globals inside the worker (Webpack's
  `node` config or a plugin like `node-polyfill-webpack-plugin`).
- Patch the Bridge.NET IIFE files so their CJS escape hatch fires under
  strict ESM (Webpack's `imports-loader` can prepend the same one-line
  shim the traverse Vite plugin uses).

### Perceived-perf: pre-warm the kusto worker

The kusto worker's top-level evaluation (Bridge.NET, ~MB of generated code)
is the slowest single step in the editor's startup path. By default Monaco
only constructs the worker on first kusto-model interaction, so semantic
syntax-highlighting "pops in" a beat after the editor first paints.

Pre-warm both workers eagerly during `requestIdleCallback` to overlap that
evaluation with React render + auth init. The `<Explorer>` host hands the
warm worker back to Monaco when it finally asks:

```ts
// src/monacoWorkers.ts (pre-warmed variant)
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

configureTraverseMonacoWorkers({
    getEditorWorker: () => takeWarmWorker('editor'),
    getKustoWorker: () => takeWarmWorker('kusto'),
});

if (typeof window !== 'undefined') {
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

`@mhjuma/traverse` itself complements this by pre-bootstrapping the kusto
language inside `monacoLoader.ts` (registers Monarch tokens + themes during
module load), so first paint already shows colored keywords and strings —
no consumer wiring needed for that piece.
