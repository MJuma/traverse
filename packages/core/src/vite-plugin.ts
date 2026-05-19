/**
 * Vite plugin that wires up `@mhjuma/traverse`'s build-time requirements:
 *
 * 1. **Bridge.NET CJS shim** — `@kusto/monaco-kusto`'s worker entry side-effect
 *    imports four Bridge.NET IIFE scripts (`bridge.min.js`,
 *    `Kusto.JavaScript.Client.min.js`, `newtonsoft.json.min.js`,
 *    `Kusto.Language.Bridge.min.js`). These reference Node-style globals
 *    (`module`, `exports`, `global`) via a CJS escape hatch
 *    (`typeof module !== "undefined" && module.exports && (n = global)`).
 *    Without those globals defined, the IIFE's other branch fires
 *    (`(function(n) { n.Bridge = Bridge; })(this)`) where `this` is
 *    `undefined` in strict ESM context, throwing `TypeError: Cannot set
 *    properties of undefined`. The shim prepends a 1-line CJS context so
 *    the escape hatch fires and routes globals to `globalThis`.
 *
 * 2. **`optimizeDeps.include` for worker entries** — Vite's dep scanner
 *    only walks the main-thread import graph in dev. Worker `import`
 *    chains are NOT followed, so the kusto worker's CJS sub-dependencies
 *    (Bridge.NET scripts, xregexp) never get pre-bundled into proper ESM
 *    unless we list them explicitly. The `parent > child` form is required
 *    here because pnpm's strict resolution keeps these transitive deps out
 *    of the project root.
 *
 * **Not handled here**: `Buffer` / `process` Node globals. The kusto
 * worker's deeper code paths reference these and there's no good way to
 * polyfill them from a plugin without taking on
 * `vite-plugin-node-polyfills` as a peer dependency. Consumers must add
 * `nodePolyfills({ overrides: { fs: null } })` themselves alongside this
 * plugin. See `docs/guide/quick-start.md` for the full Vite setup.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { nodePolyfills } from 'vite-plugin-node-polyfills';
 * import { traverseVitePlugin } from '@mhjuma/traverse/vite-plugin';
 *
 * export default defineConfig({
 *     plugins: [
 *         // ... your own plugins ...
 *         nodePolyfills({ overrides: { fs: null } }),
 *         traverseVitePlugin(),
 *     ],
 * });
 * ```
 */

// Use a structural `Plugin` shape rather than `import type { Plugin } from 'vite'`
// so this module typechecks for consumers that haven't installed `vite` as a
// devDependency. The cost is a tiny duplicated type; the win is we don't
// require `vite` as a peerDep that would force webpack/Rollup-only consumers
// to install it for no reason.
interface ViteLikePlugin {
    name: string;
    enforce?: 'pre' | 'post';
    config?: () => { optimizeDeps?: { include?: readonly string[] } } | undefined;
    transform?: (code: string, id: string) => { code: string; map: null } | null;
}

/**
 * Pattern matching the four Bridge.NET IIFE scripts inside
 * `@kusto/language-service{,-next}` that need the CJS context shim.
 *
 * Matches both posix and Windows path separators. The trailing `(\?|$)` lets
 * us match either the file path itself or one with a query-string suffix
 * (Vite uses `?import`, `?worker_file`, etc).
 */
const BRIDGE_NET_FILE_PATTERN =
    /[\\/]@kusto[\\/](language-service|language-service-next)[\\/](bridge\.min|Kusto\.JavaScript\.Client\.min|newtonsoft\.json\.min|Kusto\.Language\.Bridge\.min)\.js(\?|$)/;

/** The shim prepended to each Bridge.NET IIFE. Kept as a constant so consumers
 *  reading the source can see exactly what we inject. */
const BRIDGE_NET_SHIM =
    'var global=globalThis;var module={exports:{}};var exports=module.exports;\n';

/**
 * Worker entry points and their CJS sub-dependencies that Vite's dep
 * scanner won't discover on its own. Kept as a separate exported constant so
 * tests can assert on it without re-implementing the wiring, and so callers
 * who construct their own plugin can reuse it.
 */
export const TRAVERSE_OPTIMIZE_DEPS_INCLUDE: readonly string[] = Object.freeze([
    'monaco-editor/esm/vs/editor/editor.worker',
    '@kusto/monaco-kusto/release/esm/kusto.worker',
    '@kusto/monaco-kusto > xregexp',
    '@kusto/monaco-kusto > @kusto/language-service/bridge.min',
    '@kusto/monaco-kusto > @kusto/language-service/Kusto.JavaScript.Client.min',
    '@kusto/monaco-kusto > @kusto/language-service/newtonsoft.json.min',
    '@kusto/monaco-kusto > @kusto/language-service-next/Kusto.Language.Bridge.min',
]);

/**
 * Construct the Vite plugin. Idempotent across multiple calls (each call
 * returns a fresh plugin object — Vite deduplicates by `name`).
 */
export function traverseVitePlugin(): ViteLikePlugin {
    return {
        name: '@mhjuma/traverse',
        enforce: 'pre',
        config() {
            return {
                optimizeDeps: {
                    include: [...TRAVERSE_OPTIMIZE_DEPS_INCLUDE],
                },
            };
        },
        transform(code, id) {
            if (!BRIDGE_NET_FILE_PATTERN.test(id)) {
                return null;
            }
            return { code: BRIDGE_NET_SHIM + code, map: null };
        },
    };
}
