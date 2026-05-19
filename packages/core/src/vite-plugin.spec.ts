import { describe, it, expect } from 'vitest';

import { traverseVitePlugin, TRAVERSE_OPTIMIZE_DEPS_INCLUDE } from './vite-plugin';

describe('traverseVitePlugin', () => {
    it('returns a plugin with the expected metadata', () => {
        const p = traverseVitePlugin();
        expect(p.name).toBe('@mhjuma/traverse');
        expect(p.enforce).toBe('pre');
    });

    it('config() returns optimizeDeps.include matching the exported constant', () => {
        const p = traverseVitePlugin();
        const cfg = p.config!();
        expect(cfg?.optimizeDeps?.include).toEqual([...TRAVERSE_OPTIMIZE_DEPS_INCLUDE]);
    });

    it('config() returns a fresh array each call (not the frozen constant)', () => {
        // Vite mutates the `include` array internally; returning the frozen
        // singleton would throw later. Verify we hand back a writable copy.
        const cfg = traverseVitePlugin().config!()!;
        expect(() => { (cfg.optimizeDeps!.include as string[]).push('test'); }).not.toThrow();
    });

    describe('transform() — Bridge.NET CJS shim', () => {
        const SHIM_PREFIX = 'var global=globalThis;var module={exports:{}};var exports=module.exports;\n';

        it('prepends the shim to bridge.min.js inside @kusto/language-service', () => {
            const p = traverseVitePlugin();
            const id = '/somewhere/node_modules/@kusto/language-service/bridge.min.js';
            const got = p.transform!('(function(n){n.Bridge=1})(this);', id);
            expect(got).not.toBeNull();
            expect(got!.code).toBe(SHIM_PREFIX + '(function(n){n.Bridge=1})(this);');
            expect(got!.map).toBeNull();
        });

        it('prepends the shim to Kusto.JavaScript.Client.min.js', () => {
            const p = traverseVitePlugin();
            const id = '/n_m/@kusto/language-service/Kusto.JavaScript.Client.min.js';
            const got = p.transform!('orig;', id);
            expect(got!.code).toBe(SHIM_PREFIX + 'orig;');
        });

        it('prepends the shim to newtonsoft.json.min.js', () => {
            const p = traverseVitePlugin();
            const id = '/n_m/@kusto/language-service/newtonsoft.json.min.js';
            const got = p.transform!('orig;', id);
            expect(got!.code).toBe(SHIM_PREFIX + 'orig;');
        });

        it('prepends the shim to Kusto.Language.Bridge.min.js inside @kusto/language-service-next', () => {
            const p = traverseVitePlugin();
            const id = '/n_m/@kusto/language-service-next/Kusto.Language.Bridge.min.js';
            const got = p.transform!('orig;', id);
            expect(got!.code).toBe(SHIM_PREFIX + 'orig;');
        });

        it('matches paths with query-string suffixes (Vite ?import, ?worker_file)', () => {
            const p = traverseVitePlugin();
            const id = '/n_m/@kusto/language-service/bridge.min.js?worker_file&type=module';
            const got = p.transform!('orig;', id);
            expect(got).not.toBeNull();
            expect(got!.code).toBe(SHIM_PREFIX + 'orig;');
        });

        it('matches paths with Windows-style backslashes', () => {
            const p = traverseVitePlugin();
            const id = 'C:\\app\\node_modules\\@kusto\\language-service\\bridge.min.js';
            const got = p.transform!('orig;', id);
            expect(got).not.toBeNull();
        });

        it('does NOT match unrelated files in @kusto', () => {
            const p = traverseVitePlugin();
            const id = '/n_m/@kusto/language-service/index.js';
            expect(p.transform!('orig;', id)).toBeNull();
        });

        it('does NOT match arbitrary .min.js files outside @kusto', () => {
            const p = traverseVitePlugin();
            const id = '/n_m/other/bridge.min.js';
            expect(p.transform!('orig;', id)).toBeNull();
        });

        it('does NOT match a file whose path superficially contains "bridge.min.js" but in wrong scope', () => {
            const p = traverseVitePlugin();
            const id = '/n_m/@kusto/other-package/bridge.min.js';
            expect(p.transform!('orig;', id)).toBeNull();
        });

        it('does NOT touch normal JS files', () => {
            const p = traverseVitePlugin();
            expect(p.transform!('const x = 1;', '/src/foo.js')).toBeNull();
        });
    });

    describe('TRAVERSE_OPTIMIZE_DEPS_INCLUDE', () => {
        it('is frozen so consumers cannot accidentally mutate the canonical list', () => {
            expect(Object.isFrozen(TRAVERSE_OPTIMIZE_DEPS_INCLUDE)).toBe(true);
        });

        it('includes both worker entries', () => {
            expect(TRAVERSE_OPTIMIZE_DEPS_INCLUDE).toContain('monaco-editor/esm/vs/editor/editor.worker');
            expect(TRAVERSE_OPTIMIZE_DEPS_INCLUDE).toContain('@kusto/monaco-kusto/release/esm/kusto.worker');
        });

        it('includes all four Bridge.NET subdeps in the parent > child form', () => {
            expect(TRAVERSE_OPTIMIZE_DEPS_INCLUDE).toContain('@kusto/monaco-kusto > @kusto/language-service/bridge.min');
            expect(TRAVERSE_OPTIMIZE_DEPS_INCLUDE).toContain('@kusto/monaco-kusto > @kusto/language-service/Kusto.JavaScript.Client.min');
            expect(TRAVERSE_OPTIMIZE_DEPS_INCLUDE).toContain('@kusto/monaco-kusto > @kusto/language-service/newtonsoft.json.min');
            expect(TRAVERSE_OPTIMIZE_DEPS_INCLUDE).toContain('@kusto/monaco-kusto > @kusto/language-service-next/Kusto.Language.Bridge.min');
        });

        it('includes xregexp (kusto plugin sub-dep with strict pnpm resolution)', () => {
            expect(TRAVERSE_OPTIMIZE_DEPS_INCLUDE).toContain('@kusto/monaco-kusto > xregexp');
        });
    });
});
