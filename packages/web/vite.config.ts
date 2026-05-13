import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// `@kusto/monaco-kusto`'s worker entry side-effect-imports four Bridge.NET
// IIFE scripts (bridge.min.js, Kusto.JavaScript.Client.min.js,
// newtonsoft.json.min.js, Kusto.Language.Bridge.min.js). They populate the
// global object via `(function(n){ ... n.Bridge=Bridge; ... })(this)` where
// `n` is the IIFE's first argument. In script context, `this` resolves to
// the global object (window/self/globalThis) so globals get polluted as
// expected. In strict ESM module context (which Vite 8 forces for `?worker`
// imports in dev — `worker.format` is ignored at dev time), top-level `this`
// is `undefined`, so `n.Bridge = Bridge` throws a TypeError and the worker
// silently fails with `Uncaught Event { target: Worker }`. Each Bridge.NET
// file has a CJS escape hatch
// `typeof module!="undefined" && module.exports && (n=global)`. The shim
// below provides a faked CJS context so the escape hatch fires and routes
// `n` to `globalThis`. This is a defense-in-depth safety net for code paths
// where Vite serves these files individually (not through the optimizer's
// CJS-to-ESM wrapper).
const BRIDGE_NET_FILE_PATTERN =
    /[\\/]@kusto[\\/](language-service|language-service-next)[\\/](bridge\.min|Kusto\.JavaScript\.Client\.min|newtonsoft\.json\.min|Kusto\.Language\.Bridge\.min)\.js(\?|$)/;

function kustoBridgeShim(): Plugin {
    return {
        name: 'traverse:kusto-bridge-shim',
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

export default defineConfig({
    root: 'src',
    plugins: [
        react(),
        // `@kusto/language-service` references Node globals (Buffer, process,
        // etc.). Without these polyfills the kusto worker fails to evaluate.
        // Recommended by the official `@kusto/monaco-kusto` Vite sample.
        nodePolyfills({ overrides: { fs: null } }),
        kustoBridgeShim(),
    ],
    server: {
        port: 3000,
        strictPort: true,
    },
    build: {
        outDir: '../dist',
    },
    // Vite's dep optimizer only auto-scans the main-thread import graph in
    // dev — worker `import` chains are NOT walked. We must explicitly list
    // every worker entry plus its CJS sub-deps so they get pre-bundled into
    // proper ESM (with Bridge.NET wrapped via esbuild's CJS-to-ESM adapter).
    // Mirrors the upstream pattern at
    // https://github.com/Azure/monaco-kusto/blob/master/samples/esm-vite/vite.config.js
    // — the `parent > child` form is required here because pnpm's strict
    // resolution keeps these transitive deps out of the project root.
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
