import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('monaco-editor', () => ({}));

const loaderConfig = vi.fn();
vi.mock('@monaco-editor/react', () => ({
    loader: { config: loaderConfig },
}));

const bootstrapKustoLanguage = vi.fn().mockResolvedValue(undefined);
vi.mock('./bootstrapKustoLanguage', () => ({
    bootstrapKustoLanguage,
}));

describe('monacoLoader', () => {
    beforeEach(() => {
        loaderConfig.mockClear();
        bootstrapKustoLanguage.mockClear();
        vi.resetModules();
    });

    it('calls loader.config with the locally bundled monaco on first import', async () => {
        await import('./monacoLoader');
        expect(loaderConfig).toHaveBeenCalledTimes(1);
        expect(loaderConfig.mock.calls[0]?.[0]).toMatchObject({ monaco: expect.anything() });
    });

    it('does NOT trigger bootstrapKustoLanguage on module load (editor-gated)', async () => {
        await import('./monacoLoader');
        // Pre-loading the kusto language is gated behind preloadKustoLanguage()
        // so non-editor consumers (createKustoClient only) don't pay the cost.
        expect(bootstrapKustoLanguage).not.toHaveBeenCalled();
    });

    it('preloadKustoLanguage triggers bootstrap on first call', async () => {
        const mod = await import('./monacoLoader');
        expect(bootstrapKustoLanguage).not.toHaveBeenCalled();
        mod.preloadKustoLanguage();
        expect(bootstrapKustoLanguage).toHaveBeenCalledTimes(1);
        expect(bootstrapKustoLanguage.mock.calls[0]?.[0]).toBe(loaderConfig.mock.calls[0]?.[0].monaco);
    });

    it('preloadKustoLanguage is idempotent across repeated calls', async () => {
        const mod = await import('./monacoLoader');
        mod.preloadKustoLanguage();
        mod.preloadKustoLanguage();
        mod.preloadKustoLanguage();
        expect(bootstrapKustoLanguage).toHaveBeenCalledTimes(1);
    });

    it('preloadKustoLanguage swallows bootstrap rejections so callers never throw', async () => {
        bootstrapKustoLanguage.mockRejectedValueOnce(new Error('boom'));
        const mod = await import('./monacoLoader');
        // Must not throw synchronously and must not produce an unhandled
        // rejection that fails the test runner — the error is surfaced later
        // via ExplorerWorkspace's mount-time bootstrap on retry.
        expect(() => mod.preloadKustoLanguage()).not.toThrow();
        // Allow the rejection's microtask to drain.
        await Promise.resolve();
        await Promise.resolve();
    });

    it('__resetPreloadStateForTests clears the preload guard', async () => {
        const mod = await import('./monacoLoader');
        mod.preloadKustoLanguage();
        expect(bootstrapKustoLanguage).toHaveBeenCalledTimes(1);
        mod.__resetPreloadStateForTests();
        mod.preloadKustoLanguage();
        expect(bootstrapKustoLanguage).toHaveBeenCalledTimes(2);
    });

    it('is idempotent: configureMonacoLoader is a no-op after the first call', async () => {
        const mod = await import('./monacoLoader');
        // The module-level side-effect call counts as the first invocation.
        loaderConfig.mockClear();
        bootstrapKustoLanguage.mockClear();
        mod.configureMonacoLoader();
        mod.configureMonacoLoader();
        expect(loaderConfig).not.toHaveBeenCalled();
        expect(bootstrapKustoLanguage).not.toHaveBeenCalled();
    });
});
