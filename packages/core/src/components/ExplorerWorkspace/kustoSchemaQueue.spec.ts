import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as Monaco from 'monaco-editor';

import type { RawShowSchema } from '../../services/schema';

import {
    applyKustoSchema,
    DEBOUNCE_MS,
    __resetKustoSchemaQueueForTests,
} from './kustoSchemaQueue';
import { __resetBootstrapForTests } from './bootstrapKustoLanguage';

const setLanguageSettings = vi.fn();
const setMaximumWorkerIdleTime = vi.fn();
const setSchemaFromShowSchema = vi.fn().mockResolvedValue(undefined);
const workerProxy = { setSchemaFromShowSchema };
const accessor = vi.fn().mockResolvedValue(workerProxy);
const getKustoWorker = vi.fn().mockResolvedValue(accessor);

vi.mock('@kusto/monaco-kusto', () => ({
    kustoDefaults: {
        setLanguageSettings,
        setMaximumWorkerIdleTime,
    },
    getKustoWorker,
}));

interface FakeMonaco {
    languages: { getLanguages: () => { id: string }[] };
    editor: {
        getModels: () => { getLanguageId: () => string; uri: Monaco.Uri }[];
        onDidCreateModel: (cb: (m: { getLanguageId: () => string }) => void) => Monaco.IDisposable;
    };
}

function makeMonaco({
    models = [{ getLanguageId: () => 'kusto', uri: { toString: () => 'inmemory://model/1' } as unknown as Monaco.Uri }],
    languages = [{ id: 'kusto' }],
}: Partial<{ models: { getLanguageId: () => string; uri: Monaco.Uri }[]; languages: { id: string }[] }> = {}): FakeMonaco & { __fireCreate: (m: { getLanguageId: () => string }) => void } {
    const modelListeners: ((m: { getLanguageId: () => string }) => void)[] = [];
    return {
        languages: { getLanguages: () => languages },
        editor: {
            getModels: () => models,
            onDidCreateModel: (cb) => {
                modelListeners.push(cb);
                return { dispose: () => { modelListeners.splice(modelListeners.indexOf(cb), 1); } };
            },
        },
        __fireCreate: (m) => modelListeners.forEach((cb) => cb(m)),
    };
}

const RAW: RawShowSchema = { Plugins: [], Databases: { db: { Name: 'db', Tables: {} } } };

beforeEach(() => {
    vi.useFakeTimers();
    __resetKustoSchemaQueueForTests();
    __resetBootstrapForTests();
    setLanguageSettings.mockClear();
    setMaximumWorkerIdleTime.mockClear();
    setSchemaFromShowSchema.mockClear();
    accessor.mockClear();
    getKustoWorker.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

async function flushAsync(): Promise<void> {
    // Drain pending microtasks while fake timers are active.
    for (let i = 0; i < 32; i++) {
        await Promise.resolve();
    }
}

describe('kustoSchemaQueue', () => {
    it('applies the schema after the debounce window, then calls bootstrap + setSchemaFromShowSchema', async () => {
        const monaco = makeMonaco();

        applyKustoSchema({
            monaco: monaco as unknown as typeof Monaco,
            raw: RAW,
            clusterUri: 'https://c.kusto.windows.net',
            dbName: 'db',
        });

        // Before the debounce window, nothing has fired.
        expect(setSchemaFromShowSchema).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        expect(setLanguageSettings).toHaveBeenCalledTimes(1);
        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(1);
        expect(setSchemaFromShowSchema).toHaveBeenCalledWith(RAW, 'https://c.kusto.windows.net', 'db');
    });

    it('coalesces bursts within the debounce window — only the latest schema is applied', async () => {
        const monaco = makeMonaco();
        const raw2: RawShowSchema = { Plugins: [], Databases: { db: { Name: 'db', Tables: { A: {} } } } };

        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS / 2);
        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: raw2, clusterUri: 'c', dbName: 'db' });

        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(1);
        expect(setSchemaFromShowSchema).toHaveBeenCalledWith(raw2, 'c', 'db');
    });

    it('skips redundant calls when the (cluster, db, raw) hash matches the last applied schema', async () => {
        const monaco = makeMonaco();

        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();
        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(1);

        // Same payload again — no new debounce or worker call.
        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
        await flushAsync();

        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(1);
    });

    it('re-applies when the cluster URI or database changes', async () => {
        const monaco = makeMonaco();

        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c1', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c2', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(2);
        expect(setSchemaFromShowSchema.mock.calls[0][1]).toBe('c1');
        expect(setSchemaFromShowSchema.mock.calls[1][1]).toBe('c2');
    });

    it('defers until a kusto-language model exists, then applies on model creation', async () => {
        const monaco = makeMonaco({ models: [] });

        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        // Bootstrap ran but no worker call yet (no model).
        expect(setLanguageSettings).toHaveBeenCalledTimes(1);
        expect(setSchemaFromShowSchema).not.toHaveBeenCalled();

        // Now a kusto model is created — the deferred flush retries.
        const newModel = { getLanguageId: () => 'kusto', uri: { toString: () => 'inmemory://new' } as Monaco.Uri };
        monaco.editor.getModels = () => [newModel];
        monaco.__fireCreate(newModel);
        await flushAsync();

        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(1);
    });

    it('does not retry on non-kusto model creation', async () => {
        const monaco = makeMonaco({ models: [] });

        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        // Fire a non-kusto model — the watcher should ignore it.
        monaco.__fireCreate({ getLanguageId: () => 'javascript' });
        await flushAsync();

        expect(setSchemaFromShowSchema).not.toHaveBeenCalled();
    });

    it('keeps pending when bootstrap fails so a later call retries', async () => {
        // First attempt with a broken monaco (no kusto language registered).
        const brokenMonaco = makeMonaco({ languages: [{ id: 'javascript' }] });

        applyKustoSchema({ monaco: brokenMonaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        expect(setSchemaFromShowSchema).not.toHaveBeenCalled();

        // Retry with a working monaco. Reset bootstrap (real `bootstrapKustoLanguage` does this
        // automatically on failure, but the queue may have already consumed it).
        __resetBootstrapForTests();
        const monaco = makeMonaco();
        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(1);
    });

    it('re-flushes when a newer schema lands while one is being applied', async () => {
        const monaco = makeMonaco();

        // Slow the worker apply: hold the promise until we resolve it.
        let resolveFirst!: () => void;
        setSchemaFromShowSchema.mockImplementationOnce(() => new Promise<void>((r) => { resolveFirst = r; }));

        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        // While the first apply is in-flight, queue a newer payload.
        const raw2: RawShowSchema = { Plugins: [], Databases: { db: { Name: 'db', Tables: { LATER: {} } } } };
        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: raw2, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        // Now release the first apply.
        resolveFirst();
        await flushAsync();
        await flushAsync();

        // Both apply in order — the in-flight serialize fix guarantees the
        // newer payload comes AFTER the older one, not the other way around.
        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(2);
        expect(setSchemaFromShowSchema.mock.calls[0][0]).toBe(RAW);
        expect(setSchemaFromShowSchema.mock.calls[1][0]).toBe(raw2);
    });

    it('skips immediately when called with the same RawShowSchema reference and target', async () => {
        const monaco = makeMonaco();

        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();
        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(1);

        // Same `raw` reference — cheap skip path, no debounce timer should be scheduled.
        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        // Even an arbitrary wait doesn't trigger another apply because the timer was never set.
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 10);
        await flushAsync();
        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(1);
    });

    it('warns to the console when bootstrap fails', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const monaco = makeMonaco({ languages: [{ id: 'javascript' }] });

        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        const matchingCall = warnSpy.mock.calls.find((c) => String(c[0]).includes('Kusto language bootstrap failed'));
        expect(matchingCall).toBeDefined();
    });

    it('warns to the console when setSchemaFromShowSchema fails', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const monaco = makeMonaco();

        setSchemaFromShowSchema.mockRejectedValueOnce(new Error('worker boom'));
        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        const matchingCall = warnSpy.mock.calls.find((c) => String(c[0]).includes('setSchemaFromShowSchema failed'));
        expect(matchingCall).toBeDefined();
    });

    it('swallows worker errors and leaves pending so the next apply call retries', async () => {
        const monaco = makeMonaco();

        setSchemaFromShowSchema.mockRejectedValueOnce(new Error('worker boom'));
        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(1);

        // Trigger a different hash so identity check doesn't short-circuit.
        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c2', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(2);
    });

    it('skips redundant content even when given a fresh RawShowSchema object with same content', async () => {
        const monaco = makeMonaco();

        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();
        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(1);

        // Fresh object reference (so cheap reference-skip misses) but identical
        // content — the content-hash check in flush must still skip.
        const cloneRaw = JSON.parse(JSON.stringify(RAW)) as RawShowSchema;
        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: cloneRaw, clusterUri: 'c', dbName: 'db' });
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        await flushAsync();

        expect(setSchemaFromShowSchema).toHaveBeenCalledTimes(1);
    });

    it('__resetKustoSchemaQueueForTests clears a pending debounce timer', async () => {
        const monaco = makeMonaco();

        applyKustoSchema({ monaco: monaco as unknown as typeof Monaco, raw: RAW, clusterUri: 'c', dbName: 'db' });
        // Reset BEFORE the debounce fires.
        __resetKustoSchemaQueueForTests();
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
        await flushAsync();

        expect(setSchemaFromShowSchema).not.toHaveBeenCalled();
    });
});
