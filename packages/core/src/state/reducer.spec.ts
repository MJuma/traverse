import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInitialState, explorerReducer } from './reducer';
import type { ExplorerState, ExplorerAction } from './index';

vi.mock('../services/state-service', () => ({
    stateService: {
        get: (_store: string, key: string) => mockStore.get(key) ?? null,
        set: (_store: string, key: string, value: unknown) => { mockStore.set(key, value); },
        delete: (_store: string, key: string) => { mockStore.delete(key); },
        subscribe: () => () => {},
    },
}));

const mockStore = new Map<string, unknown>();



// ---------------------------------------------------------------------------
// createInitialState
// ---------------------------------------------------------------------------

describe('createInitialState', () => {
    beforeEach(() => {
        mockStore.clear();
    });

    it('creates state with the given initial query', () => {
        const state = createInitialState({ initialQuery: 'Table | take 10', defaultClusters: [] });
        expect(state.tabs).toHaveLength(1);
        expect(state.tabs[0].kql).toBe('Table | take 10');
        expect(state.tabs[0].title).toMatch(/Query/);
    });

    it('sets default values for all fields', () => {
        const state = createInitialState({ initialQuery: '', defaultClusters: [] });
        expect(state.schema).toEqual([]);
        expect(state.schemaSearch).toBe('');
        expect(state.expandedFolders).toBeInstanceOf(Set);
        expect(state.expandedFolders.size).toBe(0);
        expect(state.expandedTables).toBeInstanceOf(Set);
        expect(state.expandedTables.size).toBe(0);
        expect(state.schemaContextMenu).toBeNull();

        expect(state.activeTabId).toBe(state.tabs[0].id);
        expect(state.splitEnabled).toBe(false);
        expect(state.splitDirection).toBe('vertical');
        expect(state.splitTabId).toBeNull();
        expect(state.focusedPane).toBe('primary');

        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.queryStartTime).toBeNull();
        expect(state.runningQueryKey).toBeNull();

        expect(state.rows).toBeNull();
        expect(state.columns).toEqual([]);
        expect(state.columnTypes).toEqual({});
        expect(state.elapsed).toBeNull();
        expect(state.resultTime).toBeNull();
        expect(state.queryStats).toBeNull();
        expect(state.resultSets).toEqual([]);
        expect(state.activeResultSet).toBe(0);
        expect(state.resultsTab).toBe('results');

        expect(state.history).toEqual([]);

        expect(state.editorHeight).toBe(50);
        expect(state.hasSelection).toBe(false);
        expect(state.canRecall).toBe(false);
    });

    it('restores the persisted active connection for the first tab', () => {
        mockStore.set('list', [
            { id: 'conn-1', name: 'Cluster A', clusterUrl: 'https://a.kusto.windows.net', database: 'DbA', color: '#909d63' },
            { id: 'conn-2', name: 'Cluster B', clusterUrl: 'https://b.kusto.windows.net', database: 'DbB', color: '#6a8799' },
        ]);
        mockStore.set('explorer-active-connection', 'conn-2');

        const state = createInitialState({ initialQuery: 'Table | take 10', defaultClusters: [] });

        expect(state.tabs[0].connectionId).toBe('conn-2');
    });

    it('falls back to the first connection when the persisted active connection is invalid', () => {
        mockStore.set('list', [
            { id: 'conn-1', name: 'Cluster A', clusterUrl: 'https://a.kusto.windows.net', database: 'DbA', color: '#909d63' },
            { id: 'conn-2', name: 'Cluster B', clusterUrl: 'https://b.kusto.windows.net', database: 'DbB', color: '#6a8799' },
        ]);
        mockStore.set('explorer-active-connection', 'missing');

        const state = createInitialState({ initialQuery: 'Table | take 10', defaultClusters: [] });

        expect(state.tabs[0].connectionId).toBe('conn-1');
    });
});

// ---------------------------------------------------------------------------
// explorerReducer
// ---------------------------------------------------------------------------

describe('explorerReducer', () => {
    const makeState = (overrides?: Partial<ExplorerState>): ExplorerState => ({
        ...createInitialState({ initialQuery: '', defaultClusters: [] }),
        ...overrides,
    });

    // --- Schema ---

    describe('SET_SCHEMA', () => {
        it('sets schema', () => {
            const schema = [{ name: 'T1', folder: 'F', description: '', columns: [], kind: 'table' as const }];
            const state = explorerReducer(makeState(), { type: 'SET_SCHEMA', schema });
            expect(state.schema).toBe(schema);
        });
    });

    describe('SET_SCHEMA_SEARCH', () => {
        it('sets search string', () => {
            const state = explorerReducer(makeState(), { type: 'SET_SCHEMA_SEARCH', search: 'foo' });
            expect(state.schemaSearch).toBe('foo');
        });
    });

    describe('TOGGLE_FOLDER', () => {
        it('adds folder to expanded set', () => {
            const state = explorerReducer(makeState(), { type: 'TOGGLE_FOLDER', folder: 'F1' });
            expect(state.expandedFolders.has('F1')).toBe(true);
        });

        it('removes folder from expanded set', () => {
            const initial = makeState({ expandedFolders: new Set(['F1']) });
            const state = explorerReducer(initial, { type: 'TOGGLE_FOLDER', folder: 'F1' });
            expect(state.expandedFolders.has('F1')).toBe(false);
        });
    });

    describe('TOGGLE_TABLE', () => {
        it('adds table to expanded set', () => {
            const state = explorerReducer(makeState(), { type: 'TOGGLE_TABLE', table: 'T1' });
            expect(state.expandedTables.has('T1')).toBe(true);
        });

        it('removes table from expanded set', () => {
            const initial = makeState({ expandedTables: new Set(['T1']) });
            const state = explorerReducer(initial, { type: 'TOGGLE_TABLE', table: 'T1' });
            expect(state.expandedTables.has('T1')).toBe(false);
        });
    });

    describe('EXPAND_ALL_FOLDERS', () => {
        it('expands all folders and tables', () => {
            const schema = [
                { name: 'T1', folder: 'F1', description: '', columns: [], kind: 'table' as const },
                { name: 'T2', folder: 'F2', description: '', columns: [], kind: 'table' as const },
            ];
            const initial = makeState({ schema });
            const state = explorerReducer(initial, { type: 'EXPAND_ALL_FOLDERS', folders: ['F1', 'F2'] });
            expect(state.expandedFolders).toEqual(new Set(['F1', 'F2']));
            expect(state.expandedTables).toEqual(new Set(['T1', 'T2']));
        });
    });

    describe('COLLAPSE_ALL_FOLDERS', () => {
        it('collapses all folders and tables', () => {
            const initial = makeState({
                expandedFolders: new Set(['F1', 'F2']),
                expandedTables: new Set(['T1', 'T2']),
            });
            const state = explorerReducer(initial, { type: 'COLLAPSE_ALL_FOLDERS' });
            expect(state.expandedFolders.size).toBe(0);
            expect(state.expandedTables.size).toBe(0);
        });
    });

    describe('SET_SCHEMA_CONTEXT_MENU', () => {
        it('sets context menu', () => {
            const menu = { tableName: 'T1', x: 100, y: 200 };
            const state = explorerReducer(makeState(), { type: 'SET_SCHEMA_CONTEXT_MENU', menu });
            expect(state.schemaContextMenu).toEqual(menu);
        });

        it('clears context menu with null', () => {
            const initial = makeState({ schemaContextMenu: { tableName: 'T1', x: 0, y: 0 } });
            const state = explorerReducer(initial, { type: 'SET_SCHEMA_CONTEXT_MENU', menu: null });
            expect(state.schemaContextMenu).toBeNull();
        });
    });

    // --- Tabs ---

    describe('ADD_TAB', () => {
        it('adds a new tab and makes it active', () => {
            const initial = makeState();
            const state = explorerReducer(initial, { type: 'ADD_TAB' });
            expect(state.tabs).toHaveLength(2);
            expect(state.activeTabId).toBe(state.tabs[1].id);
        });
    });

    describe('CLOSE_TAB', () => {
        it('does not close the last tab', () => {
            const initial = makeState();
            const state = explorerReducer(initial, { type: 'CLOSE_TAB', tabId: initial.tabs[0].id });
            expect(state.tabs).toHaveLength(1);
        });

        it('closes a non-active tab', () => {
            const initial = makeState();
            const withTwo = explorerReducer(initial, { type: 'ADD_TAB' });
            const state = explorerReducer(withTwo, { type: 'CLOSE_TAB', tabId: withTwo.tabs[0].id });
            expect(state.tabs).toHaveLength(1);
            expect(state.tabs[0].id).toBe(withTwo.tabs[1].id);
        });

        it('updates active tab when closing active tab', () => {
            const initial = makeState();
            const withTwo = explorerReducer(initial, { type: 'ADD_TAB' });
            const state = explorerReducer(withTwo, { type: 'CLOSE_TAB', tabId: withTwo.activeTabId });
            expect(state.tabs).toHaveLength(1);
            expect(state.activeTabId).toBe(state.tabs[0].id);
        });

        it('disables split when closing split tab', () => {
            const initial = makeState();
            const withTwo = explorerReducer(initial, { type: 'ADD_TAB' });
            const withSplit: ExplorerState = {
                ...withTwo,
                splitEnabled: true,
                splitTabId: withTwo.tabs[1].id,
            };
            const state = explorerReducer(withSplit, { type: 'CLOSE_TAB', tabId: withTwo.tabs[1].id });
            expect(state.splitEnabled).toBe(false);
            expect(state.splitTabId).toBeNull();
            expect(state.focusedPane).toBe('primary');
        });

        it('disables split when closing active tab leaves splitTabId === activeTabId', () => {
            const initial = makeState();
            const s1 = explorerReducer(initial, { type: 'ADD_TAB' });
            const s2 = explorerReducer(s1, { type: 'ADD_TAB' });
            // tabs: [0, 1, 2], active = 2, split = 0
            const withSplit: ExplorerState = {
                ...s2,
                splitEnabled: true,
                splitTabId: s2.tabs[0].id,
                activeTabId: s2.tabs[1].id,
            };
            // Closing tab[1] (active) should set active to tab[0], which matches splitTabId
            const state = explorerReducer(withSplit, { type: 'CLOSE_TAB', tabId: s2.tabs[1].id });
            if (state.activeTabId === state.splitTabId) {
                expect(state.splitEnabled).toBe(false);
            }
        });
    });

    describe('SWITCH_TAB', () => {
        it('switches active tab in primary pane', () => {
            const initial = makeState();
            const withTwo = explorerReducer(initial, { type: 'ADD_TAB' });
            const state = explorerReducer(
                { ...withTwo, focusedPane: 'primary' },
                { type: 'SWITCH_TAB', tabId: withTwo.tabs[0].id },
            );
            expect(state.activeTabId).toBe(withTwo.tabs[0].id);
        });

        it('switches split tab in secondary pane', () => {
            const initial = makeState();
            const withTwo = explorerReducer(initial, { type: 'ADD_TAB' });
            const state = explorerReducer(
                { ...withTwo, focusedPane: 'secondary', splitTabId: withTwo.tabs[0].id },
                { type: 'SWITCH_TAB', tabId: withTwo.tabs[1].id },
            );
            expect(state.splitTabId).toBe(withTwo.tabs[1].id);
        });
    });

    describe('UPDATE_TAB_KQL', () => {
        it('updates KQL for specified tab', () => {
            const initial = makeState();
            const tabId = initial.tabs[0].id;
            const state = explorerReducer(initial, { type: 'UPDATE_TAB_KQL', tabId, kql: 'new query' });
            expect(state.tabs[0].kql).toBe('new query');
        });

        it('does not affect other tabs', () => {
            const initial = makeState();
            const withTwo = explorerReducer(initial, { type: 'ADD_TAB' });
            const state = explorerReducer(withTwo, {
                type: 'UPDATE_TAB_KQL',
                tabId: withTwo.tabs[0].id,
                kql: 'updated',
            });
            expect(state.tabs[1].kql).toBe(withTwo.tabs[1].kql);
        });
    });

    describe('RENAME_TAB', () => {
        it('renames specified tab', () => {
            const initial = makeState();
            const tabId = initial.tabs[0].id;
            const state = explorerReducer(initial, { type: 'RENAME_TAB', tabId, title: 'My Query' });
            expect(state.tabs[0].title).toBe('My Query');
        });
    });

    describe('REORDER_TABS', () => {
        it('moves a tab from one position to another', () => {
            const initial = makeState();
            const s1 = explorerReducer(initial, { type: 'ADD_TAB' });
            const s2 = explorerReducer(s1, { type: 'ADD_TAB' });
            const firstId = s2.tabs[0].id;
            const state = explorerReducer(s2, { type: 'REORDER_TABS', fromIdx: 0, toIdx: 2 });
            expect(state.tabs[2].id).toBe(firstId);
        });
    });

    // --- Split ---

    describe('TOGGLE_SPLIT', () => {
        it('enables split and creates new tab if needed', () => {
            const initial = makeState();
            const state = explorerReducer(initial, { type: 'TOGGLE_SPLIT', direction: 'vertical' });
            expect(state.splitEnabled).toBe(true);
            expect(state.splitDirection).toBe('vertical');
            expect(state.splitTabId).not.toBeNull();
            expect(state.tabs.length).toBeGreaterThan(initial.tabs.length);
        });

        it('toggles off when same direction and already enabled', () => {
            const initial = makeState();
            const enabled = explorerReducer(initial, { type: 'TOGGLE_SPLIT', direction: 'vertical' });
            const state = explorerReducer(enabled, { type: 'TOGGLE_SPLIT', direction: 'vertical' });
            expect(state.splitEnabled).toBe(false);
            expect(state.splitTabId).toBeNull();
            expect(state.focusedPane).toBe('primary');
        });

        it('changes direction when different direction and already enabled', () => {
            const initial = makeState();
            const enabled = explorerReducer(initial, { type: 'TOGGLE_SPLIT', direction: 'vertical' });
            const state = explorerReducer(enabled, { type: 'TOGGLE_SPLIT', direction: 'horizontal' });
            expect(state.splitEnabled).toBe(true);
            expect(state.splitDirection).toBe('horizontal');
        });

        it('creates new tab when splitTabId equals activeTabId', () => {
            const initial = makeState();
            const withSplit: ExplorerState = {
                ...initial,
                splitTabId: initial.activeTabId,
            };
            const state = explorerReducer(withSplit, { type: 'TOGGLE_SPLIT', direction: 'horizontal' });
            expect(state.splitEnabled).toBe(true);
            expect(state.splitTabId).not.toBe(initial.activeTabId);
            expect(state.tabs.length).toBeGreaterThan(initial.tabs.length);
        });

        it('keeps existing splitTabId when it differs from activeTabId', () => {
            const initial = makeState();
            const withTwo = explorerReducer(initial, { type: 'ADD_TAB' });
            const withSplit: ExplorerState = {
                ...withTwo,
                splitEnabled: true,
                splitDirection: 'vertical',
                splitTabId: withTwo.tabs[1].id,
                activeTabId: withTwo.tabs[0].id,
            };
            const state = explorerReducer(withSplit, { type: 'TOGGLE_SPLIT', direction: 'horizontal' });
            expect(state.splitDirection).toBe('horizontal');
            expect(state.tabs).toHaveLength(withTwo.tabs.length);
        });
    });

    describe('CLOSE_SPLIT', () => {
        it('disables split', () => {
            const initial = makeState();
            const enabled = explorerReducer(initial, { type: 'TOGGLE_SPLIT', direction: 'vertical' });
            const state = explorerReducer(enabled, { type: 'CLOSE_SPLIT' });
            expect(state.splitEnabled).toBe(false);
            expect(state.splitTabId).toBeNull();
            expect(state.focusedPane).toBe('primary');
        });
    });

    describe('SET_FOCUSED_PANE', () => {
        it('sets focused pane to secondary', () => {
            const state = explorerReducer(makeState(), { type: 'SET_FOCUSED_PANE', pane: 'secondary' });
            expect(state.focusedPane).toBe('secondary');
        });

        it('sets focused pane to primary', () => {
            const initial = makeState({ focusedPane: 'secondary' });
            const state = explorerReducer(initial, { type: 'SET_FOCUSED_PANE', pane: 'primary' });
            expect(state.focusedPane).toBe('primary');
        });
    });

    // --- Query execution ---

    describe('QUERY_START', () => {
        it('sets loading state', () => {
            const state = explorerReducer(makeState(), { type: 'QUERY_START', queryKey: 'q-1' });
            expect(state.loading).toBe(true);
            expect(state.error).toBeNull();
            expect(state.queryStartTime).not.toBeNull();
            expect(state.runningQueryKey).toBe('q-1');
            expect(state.resultsTab).toBe('results');
        });
    });

    describe('QUERY_SUCCESS', () => {
        it('sets results and clears loading', () => {
            const initial = makeState({ loading: true, queryStartTime: Date.now(), runningQueryKey: 'q-1' });
            const state = explorerReducer(initial, {
                type: 'QUERY_SUCCESS',
                rows: [{ a: 1 }],
                columns: ['a'],
                columnTypes: { a: 'System.Int32' },
                elapsed: 123,
                stats: null,
                resultSets: [],
            });
            expect(state.loading).toBe(false);
            expect(state.rows).toEqual([{ a: 1 }]);
            expect(state.columns).toEqual(['a']);
            expect(state.columnTypes).toEqual({ a: 'System.Int32' });
            expect(state.elapsed).toBe(123);
            expect(state.resultTime).toBeInstanceOf(Date);
            expect(state.activeResultSet).toBe(0);
            expect(state.queryStartTime).toBeNull();
            expect(state.runningQueryKey).toBeNull();
        });
    });

    describe('QUERY_ERROR', () => {
        it('sets error and clears loading', () => {
            const initial = makeState({ loading: true });
            const state = explorerReducer(initial, { type: 'QUERY_ERROR', error: 'timeout' });
            expect(state.loading).toBe(false);
            expect(state.error).toBe('timeout');
            expect(state.queryStartTime).toBeNull();
            expect(state.runningQueryKey).toBeNull();
        });
    });

    describe('QUERY_CANCEL', () => {
        it('clears loading without error', () => {
            const initial = makeState({ loading: true, runningQueryKey: 'q-1' });
            const state = explorerReducer(initial, { type: 'QUERY_CANCEL' });
            expect(state.loading).toBe(false);
            expect(state.queryStartTime).toBeNull();
            expect(state.runningQueryKey).toBeNull();
        });
    });

    // --- Results ---

    describe('SET_RESULTS_TAB', () => {
        it('sets results tab', () => {
            const state = explorerReducer(makeState(), { type: 'SET_RESULTS_TAB', tab: 'chart' });
            expect(state.resultsTab).toBe('chart');
        });
    });

    describe('SET_ACTIVE_RESULT_SET', () => {
        it('sets active result set index', () => {
            const state = explorerReducer(makeState(), { type: 'SET_ACTIVE_RESULT_SET', index: 2 });
            expect(state.activeResultSet).toBe(2);
        });
    });

    describe('SET_HISTORY', () => {
        it('sets history entries', () => {
            const history = [{
                key: 'k',
                query: 'q',
                timestamp: 1,
                elapsed: 100,
                rowCount: 5,
                columnCount: 2,
                status: 'success' as const,
            }];
            const state = explorerReducer(makeState(), { type: 'SET_HISTORY', history });
            expect(state.history).toBe(history);
        });
    });

    describe('LOAD_HISTORY_ENTRY', () => {
        it('loads history entry data', () => {
            const state = explorerReducer(makeState(), {
                type: 'LOAD_HISTORY_ENTRY',
                rows: [{ x: 1 }],
                columns: ['x'],
                columnTypes: { x: 'System.Int32' },
                kql: 'T | take 1',
            });
            expect(state.rows).toEqual([{ x: 1 }]);
            expect(state.columns).toEqual(['x']);
            expect(state.columnTypes).toEqual({ x: 'System.Int32' });
            expect(state.resultsTab).toBe('results');
        });
    });

    // --- UI ---

    describe('SET_EDITOR_HEIGHT', () => {
        it('sets editor height', () => {
            const state = explorerReducer(makeState(), { type: 'SET_EDITOR_HEIGHT', height: 75 });
            expect(state.editorHeight).toBe(75);
        });
    });

    describe('SET_HAS_SELECTION', () => {
        it('sets hasSelection', () => {
            const state = explorerReducer(makeState(), { type: 'SET_HAS_SELECTION', hasSelection: true });
            expect(state.hasSelection).toBe(true);
        });
    });

    describe('SET_CAN_RECALL', () => {
        it('sets canRecall', () => {
            const state = explorerReducer(makeState(), { type: 'SET_CAN_RECALL', canRecall: true });
            expect(state.canRecall).toBe(true);
        });
    });

    // --- Default ---

    describe('default case', () => {
        it('returns state unchanged for unknown action', () => {
            const initial = makeState();
            const state = explorerReducer(initial, { type: 'UNKNOWN_ACTION' } as unknown as ExplorerAction);
            expect(state).toBe(initial);
        });
    });

    // --- Connection actions ---

    describe('SET_CONNECTIONS', () => {
        it('replaces connections array', () => {
            const initial = createInitialState({ initialQuery: '', defaultClusters: [] });
            const newConns = [
                { id: 'a', name: 'A', clusterUrl: 'https://a.kusto.windows.net', database: 'db', color: '#f00' },
                { id: 'b', name: 'B', clusterUrl: 'https://b.kusto.windows.net', database: 'db2', color: '#0f0' },
            ];
            const state = explorerReducer(initial, { type: 'SET_CONNECTIONS', connections: newConns });
            expect(state.connections).toHaveLength(2);
            expect(state.connections[0].id).toBe('a');
        });
    });

    describe('SET_TAB_CONNECTION', () => {
        it('updates a specific tab connectionId', () => {
            const initial = createInitialState({ initialQuery: '', defaultClusters: [] });
            const tabId = initial.tabs[0].id;
            const state = explorerReducer(initial, { type: 'SET_TAB_CONNECTION', tabId, connectionId: 'new-conn' });
            expect(state.tabs[0].connectionId).toBe('new-conn');
        });

        it('does not affect other tabs', () => {
            let state = createInitialState({ initialQuery: '', defaultClusters: [] });
            state = explorerReducer(state, { type: 'ADD_TAB' });
            expect(state.tabs).toHaveLength(2);
            const secondTabId = state.tabs[1].id;
            const result = explorerReducer(state, { type: 'SET_TAB_CONNECTION', tabId: secondTabId, connectionId: 'other' });
            expect(result.tabs[0].connectionId).toBe(state.tabs[0].connectionId);
            expect(result.tabs[1].connectionId).toBe('other');
        });
    });

    describe('ADD_TAB inherits connection', () => {
        it('new tab inherits active tab connection', () => {
            let state = createInitialState({ initialQuery: '', defaultClusters: [] });
            state = explorerReducer(state, { type: 'SET_TAB_CONNECTION', tabId: state.tabs[0].id, connectionId: 'custom-conn' });
            state = explorerReducer(state, { type: 'ADD_TAB' });
            const newTab = state.tabs[state.tabs.length - 1];
            expect(newTab.connectionId).toBe('custom-conn');
        });
    });

    describe('createInitialState with connections', () => {
        it('loads connections', () => {
            const state = createInitialState({ initialQuery: '', defaultClusters: [] });
            expect(state.connections.length).toBeGreaterThanOrEqual(1);
            expect(state.connections[0].id).toBeTruthy();
        });

        it('first tab has a connectionId', () => {
            const state = createInitialState({ initialQuery: '', defaultClusters: [] });
            expect(state.tabs[0].connectionId).toBeTruthy();
        });
    });
});
