import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// See packages/web/vite.config.ts for the rationale behind this shim.
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
        nodePolyfills({ overrides: { fs: null } }),
        kustoBridgeShim(),
    ],
    // Tauri expects a fixed port during dev
    server: {
        port: 5175,
        strictPort: true,
        // Allow connections from other machines (for remote dev from Mac)
        host: '0.0.0.0',
    },
    // Tauri uses env vars to know when building for desktop
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
        outDir: '../dist',
        // Tauri uses Chromium on Windows and WebKit on macOS/Linux
        target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari15',
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_DEBUG,
    },
    // See packages/web/vite.config.ts for the rationale.
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
