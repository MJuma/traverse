/**
 * Explorer state reducer — pure function, fully unit-testable.
 * All state mutations go through typed actions.
 */

import type { ExplorerState, InitialStateArgs } from './types';
import type { ExplorerAction } from './actions';
import { createTab, nextQueryTitle, loadConnections, loadActiveConnectionId } from '../components/ExplorerWorkspace/ExplorerWorkspace.logic';
import { SUPPORTED_RENDER_TYPES } from '../components/ChartPanel/ChartPanel.logic';

export function createInitialState({ initialQuery, defaultClusters }: InitialStateArgs): ExplorerState {
    const connections = loadConnections(defaultClusters);
    const firstTab = createTab(initialQuery, 'Query 1', loadActiveConnectionId(connections));
    return {
        connections,

        schema: [],
        schemaSearch: '',
        expandedFolders: new Set(),
        expandedTables: new Set(),
        schemaContextMenu: null,

        tabs: [firstTab],
        activeTabId: firstTab.id,
        splitEnabled: false,
        splitDirection: 'vertical',
        splitTabId: null,
        focusedPane: 'primary',

        loading: false,
        error: null,
        queryStartTime: null,
        runningQueryKey: null,

        rows: null,
        columns: [],
        columnTypes: {},
        elapsed: null,
        resultTime: null,
        queryStats: null,
        resultSets: [],
        activeResultSet: 0,
        resultsTab: 'results',

        history: [],

        editorHeight: 50,
        hasSelection: false,
        canRecall: false,
    };
}

export function explorerReducer(state: ExplorerState, action: ExplorerAction): ExplorerState {
    switch (action.type) {
        // Connections
        case 'SET_CONNECTIONS':
            return { ...state, connections: action.connections };
        case 'SET_TAB_CONNECTION':
            return { ...state, tabs: state.tabs.map((t) => t.id === action.tabId ? { ...t, connectionId: action.connectionId } : t) };

        // Schema
        case 'SET_SCHEMA':
            return { ...state, schema: action.schema };
        case 'SET_SCHEMA_SEARCH':
            return { ...state, schemaSearch: action.search };
        case 'TOGGLE_FOLDER': {
            const next = new Set(state.expandedFolders);
            if (next.has(action.folder)) { next.delete(action.folder); } else { next.add(action.folder); }
            return { ...state, expandedFolders: next };
        }
        case 'TOGGLE_TABLE': {
            const next = new Set(state.expandedTables);
            if (next.has(action.table)) { next.delete(action.table); } else { next.add(action.table); }
            return { ...state, expandedTables: next };
        }
        case 'EXPAND_ALL_FOLDERS':
            return { ...state, expandedFolders: new Set(action.folders), expandedTables: new Set(state.schema.map((t) => t.name)) };
        case 'COLLAPSE_ALL_FOLDERS':
            return { ...state, expandedFolders: new Set(), expandedTables: new Set() };
        case 'SET_SCHEMA_CONTEXT_MENU':
            return { ...state, schemaContextMenu: action.menu };

        // Tabs
        case 'ADD_TAB': {
            const activeConn = state.tabs.find((t) => t.id === state.activeTabId)?.connectionId ?? state.connections[0]?.id;
            const title = nextQueryTitle(state.tabs);
            const tab = createTab('', title, activeConn);
            return { ...state, tabs: [...state.tabs, tab], activeTabId: tab.id, splitEnabled: false, splitTabId: null, focusedPane: 'primary' };
        }
        case 'CLOSE_TAB': {
            if (state.tabs.length <= 1) {
                return state;
            }
            const idx = state.tabs.findIndex((t) => t.id === action.tabId);
            const next = state.tabs.filter((t) => t.id !== action.tabId);
            let { activeTabId, splitTabId, splitEnabled, focusedPane } = state;
            if (activeTabId === action.tabId) {
                activeTabId = next[Math.max(0, idx - 1)].id;
                if (splitTabId === activeTabId) { splitEnabled = false; splitTabId = null; focusedPane = 'primary'; }
            }
            if (splitTabId === action.tabId) { splitEnabled = false; splitTabId = null; focusedPane = 'primary'; }
            return { ...state, tabs: next, activeTabId, splitTabId, splitEnabled, focusedPane };
        }
        case 'CLOSE_OTHER_TABS': {
            const kept = state.tabs.filter((t) => t.id === action.tabId);
            if (kept.length === 0) {
                return state;
            }
            return { ...state, tabs: kept, activeTabId: action.tabId, splitEnabled: false, splitTabId: null, focusedPane: 'primary' };
        }
        case 'CLOSE_ALL_TABS': {
            const conn = state.tabs.find((t) => t.id === state.activeTabId)?.connectionId ?? state.connections[0]?.id;
            const tab = createTab('', 'Query 1', conn);
            return { ...state, tabs: [tab], activeTabId: tab.id, splitEnabled: false, splitTabId: null, focusedPane: 'primary' };
        }
        case 'DUPLICATE_TAB': {
            const source = state.tabs.find((t) => t.id === action.tabId);
            if (!source) {
                return state;
            }
            const title = nextQueryTitle(state.tabs);
            const dup = createTab(source.kql, title, source.connectionId);
            const idx = state.tabs.findIndex((t) => t.id === action.tabId);
            const tabs = [...state.tabs];
            tabs.splice(idx + 1, 0, dup);
            return { ...state, tabs, activeTabId: dup.id };
        }
        case 'SWITCH_TAB':
            return state.focusedPane === 'primary'
                ? { ...state, activeTabId: action.tabId }
                : { ...state, splitTabId: action.tabId };
        case 'UPDATE_TAB_KQL':
            return { ...state, tabs: state.tabs.map((t) => t.id === action.tabId ? { ...t, kql: action.kql } : t) };
        case 'RENAME_TAB':
            return { ...state, tabs: state.tabs.map((t) => t.id === action.tabId ? { ...t, title: action.title } : t) };
        case 'REORDER_TABS': {
            const next = [...state.tabs];
            const [moved] = next.splice(action.fromIdx, 1);
            next.splice(action.toIdx, 0, moved);
            return { ...state, tabs: next };
        }
        case 'TOGGLE_SPLIT': {
            if (state.splitEnabled && state.splitDirection === action.direction) {
                return { ...state, splitEnabled: false, splitTabId: null, focusedPane: 'primary' };
            }
            const targetSplitTabId = action.splitTabId ?? state.splitTabId;
            if (!targetSplitTabId || targetSplitTabId === state.activeTabId) {
                const activeConn = state.tabs.find((t) => t.id === state.activeTabId)?.connectionId ?? state.connections[0]?.id;
                const tab = createTab('', undefined, activeConn);
                return { ...state, splitEnabled: true, splitDirection: action.direction, splitTabId: tab.id, tabs: [...state.tabs, tab] };
            }
            return { ...state, splitEnabled: true, splitDirection: action.direction, splitTabId: targetSplitTabId };
        }
        case 'CLOSE_SPLIT':
            return { ...state, splitEnabled: false, splitTabId: null, focusedPane: 'primary' };
        case 'SET_FOCUSED_PANE':
            return { ...state, focusedPane: action.pane };

        // Query execution
        case 'QUERY_START':
            return { ...state, loading: true, error: null, queryStartTime: Date.now(), runningQueryKey: action.queryKey, resultsTab: 'results' };
        case 'QUERY_SUCCESS': {
            const viz = action.resultSets[0]?.visualization;
            const hasChart = viz ? SUPPORTED_RENDER_TYPES.has(viz.type.toLowerCase()) : false;
            return {
                ...state,
                loading: false,
                rows: action.rows,
                columns: action.columns,
                columnTypes: action.columnTypes,
                elapsed: action.elapsed,
                resultTime: new Date(),
                queryStats: action.stats,
                resultSets: action.resultSets,
                activeResultSet: 0,
                queryStartTime: null,
                runningQueryKey: null,
                resultsTab: hasChart ? 'chart' : 'results',
            };
        }
        case 'QUERY_ERROR':
            return { ...state, loading: false, error: action.error, queryStartTime: null, runningQueryKey: null };
        case 'QUERY_CANCEL':
            return { ...state, loading: false, queryStartTime: null, runningQueryKey: null };

        // Results
        case 'SET_RESULTS_TAB':
            return { ...state, resultsTab: action.tab };
        case 'SET_ACTIVE_RESULT_SET':
            return { ...state, activeResultSet: action.index };
        case 'SET_HISTORY':
            return { ...state, history: action.history };
        case 'LOAD_HISTORY_ENTRY':
            return { ...state, rows: action.rows, columns: action.columns, columnTypes: action.columnTypes, resultsTab: 'results' };

        // UI
        case 'SET_EDITOR_HEIGHT':
            return { ...state, editorHeight: action.height };
        case 'SET_HAS_SELECTION':
            return { ...state, hasSelection: action.hasSelection };
        case 'SET_CAN_RECALL':
            return { ...state, canRecall: action.canRecall };

        default:
            return state;
    }
}
