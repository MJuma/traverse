import { describe, it, expect, beforeEach, vi } from 'vitest';

import { configureTraverseMonacoWorkers, getMonacoWorkerConfigurationError, __resetWorkerConfigForTests } from './monacoWorkers';

interface GlobalWithMonaco {
    MonacoEnvironment?: { getWorker?: (workerId: string, label: string) => Worker };
}

function getMonacoEnvironment(): GlobalWithMonaco['MonacoEnvironment'] {
    return (globalThis as unknown as GlobalWithMonaco).MonacoEnvironment;
}

describe('configureTraverseMonacoWorkers', () => {
    beforeEach(() => {
        __resetWorkerConfigForTests();
    });

    it('installs MonacoEnvironment.getWorker on first call', () => {
        expect(getMonacoEnvironment()).toBeUndefined();
        configureTraverseMonacoWorkers({});
        expect(getMonacoEnvironment()?.getWorker).toBeTypeOf('function');
    });

    it('dispatches the "kusto" label to getKustoWorker', () => {
        const kustoWorker = {} as Worker;
        const editorWorker = {} as Worker;
        const getKusto = vi.fn(() => kustoWorker);
        const getEditor = vi.fn(() => editorWorker);
        configureTraverseMonacoWorkers({ getKustoWorker: getKusto, getEditorWorker: getEditor });

        const w = getMonacoEnvironment()!.getWorker!('id-1', 'kusto');
        expect(w).toBe(kustoWorker);
        expect(getKusto).toHaveBeenCalledTimes(1);
        expect(getEditor).not.toHaveBeenCalled();
    });

    it('dispatches any non-kusto label to getEditorWorker', () => {
        const editorWorker = {} as Worker;
        const getEditor = vi.fn(() => editorWorker);
        configureTraverseMonacoWorkers({ getEditorWorker: getEditor });

        const a = getMonacoEnvironment()!.getWorker!('id-1', 'editorWorkerService');
        const b = getMonacoEnvironment()!.getWorker!('id-2', 'css');
        expect(a).toBe(editorWorker);
        expect(b).toBe(editorWorker);
        expect(getEditor).toHaveBeenCalledTimes(2);
    });

    it('throws a helpful error when the Kusto worker factory is missing', () => {
        configureTraverseMonacoWorkers({});
        expect(() => getMonacoEnvironment()!.getWorker!('id-1', 'kusto')).toThrow(/Kusto worker factory/);
    });

    it('throws a helpful error when the editor worker factory is missing and no pre-existing handler is present', () => {
        configureTraverseMonacoWorkers({});
        expect(() => getMonacoEnvironment()!.getWorker!('id-1', 'editorWorkerService'))
            .toThrow(/No Monaco worker factory configured for label "editorWorkerService"/);
    });

    it('reconfigure swaps the active factories without re-installing the environment', () => {
        const w1 = {} as Worker;
        const w2 = {} as Worker;
        configureTraverseMonacoWorkers({ getKustoWorker: () => w1 });
        const env1 = getMonacoEnvironment();
        configureTraverseMonacoWorkers({ getKustoWorker: () => w2 });
        const env2 = getMonacoEnvironment();
        expect(env1).toBe(env2);
        expect(env2!.getWorker!('id', 'kusto')).toBe(w2);
    });

    it('falls back to a pre-existing host MonacoEnvironment.getWorker for unknown labels', () => {
        const hostWorker = {} as Worker;
        const hostGetWorker = vi.fn(() => hostWorker);
        (globalThis as unknown as GlobalWithMonaco).MonacoEnvironment = { getWorker: hostGetWorker };

        configureTraverseMonacoWorkers({});
        const w = getMonacoEnvironment()!.getWorker!('id-1', 'editorWorkerService');
        expect(w).toBe(hostWorker);
        expect(hostGetWorker).toHaveBeenCalledWith('id-1', 'editorWorkerService');
    });
});

describe('getMonacoWorkerConfigurationError', () => {
    beforeEach(() => {
        __resetWorkerConfigForTests();
    });

    it('returns an error when configureTraverseMonacoWorkers was never called', () => {
        const err = getMonacoWorkerConfigurationError();
        expect(err).not.toBeNull();
        expect(err!.kind).toBe('missing-kusto-worker');
        expect(err!.summary).toMatch(/not configured/i);
        // The hint must show the consumer the actual snippet to copy.
        expect(err!.hint).toContain('configureTraverseMonacoWorkers');
        expect(err!.hint).toContain('getKustoWorker');
        expect(err!.hint).toContain("'monaco-editor/esm/vs/editor/editor.worker.js?worker'");
        expect(err!.hint).toContain("'@kusto/monaco-kusto/release/esm/kusto.worker.js?worker'");
    });

    it('returns an error when configure was called but getKustoWorker is missing', () => {
        // Edge case: host calls configure with only an editor worker.
        configureTraverseMonacoWorkers({ getEditorWorker: () => ({}) as Worker });
        const err = getMonacoWorkerConfigurationError();
        expect(err).not.toBeNull();
        expect(err!.kind).toBe('missing-kusto-worker');
    });

    it('returns missing-editor-worker when getKustoWorker is set but getEditorWorker is missing and no host fallback exists', () => {
        configureTraverseMonacoWorkers({ getKustoWorker: () => ({}) as Worker });
        const err = getMonacoWorkerConfigurationError();
        expect(err).not.toBeNull();
        expect(err!.kind).toBe('missing-editor-worker');
        expect(err!.hint).toContain('getEditorWorker');
        expect(err!.hint).toContain("'monaco-editor/esm/vs/editor/editor.worker.js?worker'");
    });

    it('does NOT return missing-editor-worker if a host MonacoEnvironment.getWorker was installed BEFORE configure', () => {
        // Host (e.g. another editor wrapper) installed its own getWorker.
        // Configure-with-only-kusto is fine in this case because the host
        // handles non-kusto labels via the fallback chain.
        (globalThis as unknown as GlobalWithMonaco).MonacoEnvironment = {
            getWorker: () => ({}) as Worker,
        };
        configureTraverseMonacoWorkers({ getKustoWorker: () => ({}) as Worker });
        expect(getMonacoWorkerConfigurationError()).toBeNull();
    });

    it('returns null when both workers are configured', () => {
        configureTraverseMonacoWorkers({
            getEditorWorker: () => ({}) as Worker,
            getKustoWorker: () => ({}) as Worker,
        });
        expect(getMonacoWorkerConfigurationError()).toBeNull();
    });

    it('does NOT trust a host-installed MonacoEnvironment.getWorker — must be configured via traverse', () => {
        // Pretend the host installed its own getWorker (e.g. for its own
        // non-kusto editors). That doesn't mean kusto is set up.
        (globalThis as unknown as GlobalWithMonaco).MonacoEnvironment = {
            getWorker: () => ({}) as Worker,
        };
        const err = getMonacoWorkerConfigurationError();
        expect(err).not.toBeNull();
        expect(err!.kind).toBe('missing-kusto-worker');
    });
});
