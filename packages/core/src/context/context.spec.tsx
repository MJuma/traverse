import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { KustoClientContext, useKustoClient } from './KustoClientContext';
import { ExplorerColorProvider, useExplorerColors } from './ExplorerColorContext';
import { ExplorerStateContext, ExplorerDispatchContext, useExplorerState, useExplorerDispatch, useActiveTabs, useConnection, useFocusedConnection } from './ExplorerStateContext';
import type { ExplorerColorConfig } from '../colors';
import { DEFAULT_CONNECTION } from '../components/ExplorerWorkspace/ExplorerWorkspace.logic';

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

function renderHook<T>(hook: () => T, wrapper?: React.FC<{ children: React.ReactNode }>): T {
    let result: T;
    function TestComponent() {
        result = hook();
        return null;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const el = createElement(TestComponent);
    act(() => {
        root.render(wrapper ? createElement(wrapper, null, el) : el);
    });
    act(() => {
        root.unmount();
    });
    container.remove();
    return result!;
}

describe('KustoClientContext', () => {
    it('throws when used outside provider', () => {
        expect(() => renderHook(() => useKustoClient())).toThrow('KustoClientContext not provided');
    });

    it('returns client when provided', () => {
        const mockClient = { queryKusto: () => {}, queryKustoMgmt: () => {}, clearQueryCache: () => {}, getQueryCacheSize: () => 0 };
        const client = renderHook(
            () => useKustoClient(),
            ({ children }) => createElement(KustoClientContext.Provider, { value: mockClient as never }, children),
        );
        expect(client).toBe(mockClient);
    });
});

describe('ExplorerColorContext', () => {
    it('throws when used outside provider', () => {
        expect(() => renderHook(() => useExplorerColors())).toThrow('ExplorerColorProvider not provided');
    });

    it('returns colors when provided', () => {
        const mockColors: ExplorerColorConfig = {
            semantic: {
                backdrop: 'a', functionBadge: 'b', highlightHoverBg: 'c', lookupBadge: 'd',
                materializedViewBadge: 'e', scrollThumb: 'f', scrollThumbHover: 'g',
                selectionBg: 'h', selectionSubtle: 'i', shadowLight: 'j', shadowMedium: 'k',
            },
            chart: { palette: ['#1'] },
        };
        const colors = renderHook(
            () => useExplorerColors(),
            ({ children }) => createElement(ExplorerColorProvider, { value: mockColors }, children),
        );
        expect(colors).toBe(mockColors);
    });
});

describe('ExplorerStateContext', () => {
    it('useExplorerState throws when used outside provider', () => {
        expect(() => renderHook(() => useExplorerState())).toThrow('useExplorerState must be used within ExplorerProvider');
    });

    it('useExplorerDispatch throws when used outside provider', () => {
        expect(() => renderHook(() => useExplorerDispatch())).toThrow('useExplorerDispatch must be used within ExplorerProvider');
    });

    it('returns state when provided', () => {
        const mockState = { tabs: [], activeTabId: '1', connections: [], splitEnabled: false, splitTabId: null, focusedPane: 'primary' as const };
        const state = renderHook(
            () => useExplorerState(),
            ({ children }) => createElement(ExplorerStateContext.Provider, { value: mockState as never }, children),
        );
        expect(state).toBe(mockState);
    });

    it('returns dispatch when provided', () => {
        const mockDispatch = () => {};
        const dispatch = renderHook(
            () => useExplorerDispatch(),
            ({ children }) => createElement(ExplorerDispatchContext.Provider, { value: mockDispatch as never }, children),
        );
        expect(dispatch).toBe(mockDispatch);
    });

    it('useActiveTabs returns active and split tabs', () => {
        const tabs = [
            { id: 't1', name: 'Tab 1', query: '', connectionId: 'c1' },
            { id: 't2', name: 'Tab 2', query: '', connectionId: 'c1' },
        ];
        const mockState = {
            tabs, activeTabId: 't1', splitEnabled: true, splitTabId: 't2',
            connections: [], focusedPane: 'primary' as const,
        };
        const result = renderHook(
            () => useActiveTabs(),
            ({ children }) => createElement(ExplorerStateContext.Provider, { value: mockState as never }, children),
        );
        expect(result.activeTab.id).toBe('t1');
        expect(result.splitTab?.id).toBe('t2');
    });

    it('useActiveTabs returns null splitTab when split disabled', () => {
        const tabs = [{ id: 't1', name: 'Tab 1', query: '', connectionId: 'c1' }];
        const mockState = {
            tabs, activeTabId: 't1', splitEnabled: false, splitTabId: null,
            connections: [], focusedPane: 'primary' as const,
        };
        const result = renderHook(
            () => useActiveTabs(),
            ({ children }) => createElement(ExplorerStateContext.Provider, { value: mockState as never }, children),
        );
        expect(result.activeTab.id).toBe('t1');
        expect(result.splitTab).toBeNull();
    });

    it('useConnection returns connection by id', () => {
        const connections = [
            { id: 'c1', name: 'Cluster 1', clusterUrl: 'https://c1.kusto.windows.net', database: 'DB1', color: '#red' },
            { id: 'c2', name: 'Cluster 2', clusterUrl: 'https://c2.kusto.windows.net', database: 'DB2', color: '#blue' },
        ];
        const mockState = {
            tabs: [], activeTabId: '', splitEnabled: false, splitTabId: null,
            connections, focusedPane: 'primary' as const,
        };
        const conn = renderHook(
            () => useConnection('c2'),
            ({ children }) => createElement(ExplorerStateContext.Provider, { value: mockState as never }, children),
        );
        expect(conn.id).toBe('c2');
    });

    it('useConnection falls back to DEFAULT_CONNECTION', () => {
        const mockState = {
            tabs: [], activeTabId: '', splitEnabled: false, splitTabId: null,
            connections: [], focusedPane: 'primary' as const,
        };
        const conn = renderHook(
            () => useConnection('nonexistent'),
            ({ children }) => createElement(ExplorerStateContext.Provider, { value: mockState as never }, children),
        );
        expect(conn.id).toBe(DEFAULT_CONNECTION.id);
    });

    it('useFocusedConnection returns focused pane connection', () => {
        const connections = [
            { id: 'c1', name: 'C1', clusterUrl: 'u1', database: 'd1', color: '#1' },
            { id: 'c2', name: 'C2', clusterUrl: 'u2', database: 'd2', color: '#2' },
        ];
        const tabs = [
            { id: 't1', name: 'Tab 1', query: '', connectionId: 'c1' },
            { id: 't2', name: 'Tab 2', query: '', connectionId: 'c2' },
        ];
        const mockState = {
            tabs, activeTabId: 't1', splitEnabled: true, splitTabId: 't2',
            connections, focusedPane: 'split' as const,
        };
        const conn = renderHook(
            () => useFocusedConnection(),
            ({ children }) => createElement(ExplorerStateContext.Provider, { value: mockState as never }, children),
        );
        expect(conn.id).toBe('c2');
    });
});
