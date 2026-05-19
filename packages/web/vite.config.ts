import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

import { traverseVitePlugin } from '@mhjuma/traverse/vite-plugin';

export default defineConfig({
    root: 'src',
    plugins: [
        react(),
        // `@kusto/language-service` references Node globals (Buffer, process,
        // etc.). Without these polyfills the kusto worker fails to evaluate
        // with `Uncaught Event { target: Worker }`. Recommended by the
        // official `@kusto/monaco-kusto` Vite sample. Kept as a separate
        // plugin (not bundled into `traverseVitePlugin`) so consumers can
        // tune the polyfill set without forking the traverse plugin.
        nodePolyfills({ overrides: { fs: null } }),
        // Bridge.NET CJS shim + `optimizeDeps.include` for the kusto worker
        // entries and their CJS sub-deps. See the plugin's JSDoc for the
        // full rationale.
        traverseVitePlugin(),
    ],
    server: {
        port: 3000,
        strictPort: true,
    },
    build: {
        outDir: '../dist',
    },
});
