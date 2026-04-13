import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import type { KustoClient } from './kusto';

function createMockClient(result?: { rows: unknown[]; columns: unknown[] }): KustoClient {
    return {
        queryKusto: vi.fn().mockResolvedValue(result ?? { rows: [{ id: 1 }], columns: [{ ColumnName: 'id' }], resultSets: [] }),
        queryKustoMgmt: vi.fn().mockResolvedValue(result ?? { rows: [{ id: 1 }], columns: [{ ColumnName: 'id' }], resultSets: [] }),
        clearQueryCache: vi.fn(),
        getQueryCacheSize: vi.fn().mockReturnValue(0),
    };
}

function renderHookAsync<T>(
    hook: () => T,
): { getResult: () => T; container: HTMLDivElement; root: ReturnType<typeof createRoot> } {
    let result: T;
    function TestComponent() {
        result = hook();
        return null;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(createElement(TestComponent));
    });
    return {
        getResult: () => result!,
        container,
        root,
    };
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useKustoQuery', () => {
    // Dynamic import to avoid hoisting issues
    it('returns loading state initially then data', async () => {
        const { useKustoQuery } = await import('./useKustoQuery');
        const client = createMockClient({ rows: [{ name: 'test' }], columns: [{ ColumnName: 'name' }] });
        const { getResult, container, root } = renderHookAsync(() => useKustoQuery('MyTable | take 1', { client }));

        // Initially loading
        expect(getResult().loading).toBe(true);
        expect(getResult().kql).toBe('MyTable | take 1');

        // Wait for async resolution
        await act(async () => {
            await vi.dynamicImportSettled();
        });

        // After resolution
        expect(getResult().loading).toBe(false);
        expect(getResult().data).toEqual([{ name: 'test' }]);
        expect(getResult().error).toBeNull();

        act(() => { root.unmount(); });
        container.remove();
    });

    it('returns null data for empty kql', async () => {
        const { useKustoQuery } = await import('./useKustoQuery');
        const client = createMockClient();
        const { getResult, container, root } = renderHookAsync(() => useKustoQuery('', { client }));

        expect(getResult().loading).toBe(false);
        expect(getResult().data).toBeNull();

        act(() => { root.unmount(); });
        container.remove();
    });

    it('handles errors', async () => {
        const { useKustoQuery } = await import('./useKustoQuery');
        const client = createMockClient();
        vi.mocked(client.queryKusto).mockRejectedValue(new Error('Query failed'));

        const { getResult, container, root } = renderHookAsync(() => useKustoQuery('bad query', { client }));

        await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });

        expect(getResult().loading).toBe(false);
        expect(getResult().error).toBe('Query failed');
        expect(getResult().data).toBeNull();

        act(() => { root.unmount(); });
        container.remove();
    });
});

describe('useKustoMgmtQuery', () => {
    it('fetches management query results', async () => {
        const { useKustoMgmtQuery } = await import('./useKustoQuery');
        const client = createMockClient({ rows: [{ TableName: 'T1' }], columns: [{ ColumnName: 'TableName' }] });
        const { getResult, container, root } = renderHookAsync(() => useKustoMgmtQuery('.show tables', { client }));

        await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });

        expect(getResult().loading).toBe(false);
        expect(getResult().data).toEqual([{ TableName: 'T1' }]);

        act(() => { root.unmount(); });
        container.remove();
    });

    it('handles management query errors', async () => {
        const { useKustoMgmtQuery } = await import('./useKustoQuery');
        const client = createMockClient();
        vi.mocked(client.queryKustoMgmt).mockRejectedValue(new Error('mgmt failed'));
        const { getResult, container, root } = renderHookAsync(() => useKustoMgmtQuery('.bad command', { client }));

        await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });

        expect(getResult().loading).toBe(false);
        expect(getResult().error).toBe('mgmt failed');

        act(() => { root.unmount(); });
        container.remove();
    });
});

describe('useDeferredKustoQuery', () => {
    it('does not query until element is visible', async () => {
        const { useDeferredKustoQuery } = await import('./useKustoQuery');
        const client = createMockClient();
        const { getResult, container, root } = renderHookAsync(() => useDeferredKustoQuery('MyTable | take 1', { client }));

        // Initially not visible — should not query
        expect(getResult().loading).toBe(false);
        expect(getResult().data).toBeNull();
        expect(getResult().containerRef).toBeDefined();

        act(() => { root.unmount(); });
        container.remove();
    });

    it('queries after IntersectionObserver fires', async () => {
        // Mock IntersectionObserver
        let observerCallback: (entries: { isIntersecting: boolean }[]) => void = () => {};
        const mockObserve = vi.fn();
        const mockDisconnect = vi.fn();
        vi.stubGlobal('IntersectionObserver', class {
            constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { observerCallback = cb; }
            observe = mockObserve;
            disconnect = mockDisconnect;
        });

        const { useDeferredKustoQuery } = await import('./useKustoQuery');
        const client = createMockClient({ rows: [{ a: 1 }], columns: [{ ColumnName: 'a' }] });
        let refValue: HTMLDivElement | null = null;

        function TestComp() {
            const result = useDeferredKustoQuery('Q | take 1', { client });
            // Simulate attaching ref
            if (result.containerRef && !refValue) {
                refValue = document.createElement('div');
                (result.containerRef as React.MutableRefObject<HTMLDivElement | null>).current = refValue;
            }
            return null;
        }

        const testContainer = document.createElement('div');
        document.body.appendChild(testContainer);
        const testRoot = createRoot(testContainer);
        act(() => { testRoot.render(createElement(TestComp)); });

        // Trigger intersection
        act(() => { observerCallback([{ isIntersecting: true }]); });

        await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });

        expect(client.queryKusto).toHaveBeenCalled();

        act(() => { testRoot.unmount(); });
        testContainer.remove();
        vi.unstubAllGlobals();
    });
});

describe('useKustoQuery refresh', () => {
    it('re-executes query on refresh', async () => {
        const { useKustoQuery } = await import('./useKustoQuery');
        const client = createMockClient({ rows: [{ a: 1 }], columns: [{ ColumnName: 'a' }] });
        let refreshFn: (() => void) | undefined;

        function TestComp() {
            const result = useKustoQuery('Q | take 1', { client });
            refreshFn = result.refresh;
            return null;
        }

        const testContainer = document.createElement('div');
        document.body.appendChild(testContainer);
        const testRoot = createRoot(testContainer);
        act(() => { testRoot.render(createElement(TestComp)); });

        await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });

        expect(client.queryKusto).toHaveBeenCalledTimes(1);

        // Trigger refresh
        act(() => { refreshFn?.(); });

        await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });

        expect(client.queryKusto).toHaveBeenCalledTimes(2);

        act(() => { testRoot.unmount(); });
        testContainer.remove();
    });
});
