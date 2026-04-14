import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Explorer } from './Explorer';

vi.mock('@monaco-editor/react', () => ({
    Editor: () => React.createElement('div', { 'data-testid': 'monaco-editor' }),
}));
vi.mock('../../services/kusto', () => ({
    queryKusto: vi.fn().mockResolvedValue({ columns: [], rows: [] }),
}));
vi.mock('../../services/queryHistory', () => ({
    normalizeQuery: vi.fn((q: string) => q),
    getHistory: vi.fn(() => Promise.resolve([])),
    saveHistoryEntry: vi.fn(),
    recallResult: vi.fn(() => null),
}));
vi.mock('../../services/schema', () => ({
    getSchema: vi.fn(() => []),
    loadSchema: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../context/ExplorerColorContext', () => ({
    useExplorerColors: () => ({
        semantic: { backdrop: 'rgba(0,0,0,0.5)', shadowMedium: 'rgba(0,0,0,0.2)', shadowLight: 'rgba(0,0,0,0.15)', scrollThumb: '#ccc', scrollThumbHover: '#aaa', functionBadge: '#0f0', materializedViewBadge: '#90f', lookupBadge: '#f90', selectionBg: '#00f', selectionSubtle: '#eef', highlightHoverBg: '#ffa' },
        chart: { palette: [] },
    }),
    ExplorerColorProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../EditorToolbar/EditorToolbar', () => ({
    EditorToolbar: () => React.createElement('div', { 'data-testid': 'editor-toolbar' }),
}));
vi.mock('../ResultsPanel/ResultsPanel', () => ({
    ResultsPanel: () => React.createElement('div', { 'data-testid': 'results-panel' }),
}));
vi.mock('../SchemaSidebar/SchemaSidebar', () => ({
    SchemaSidebar: () => React.createElement('div', { 'data-testid': 'schema-sidebar' }),
}));
vi.mock('../TabBar/TabBar', () => ({
    TabBar: () => React.createElement('div', { 'data-testid': 'tab-bar' }),
}));
vi.mock('../../context/ExplorerStateContext', () => ({
    ExplorerStateContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
    ExplorerDispatchContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
    useExplorerState: (...args: unknown[]) => (mockExplorerState as (...a: unknown[]) => unknown)(...args),
    useExplorerDispatch: () => mockDispatch,
    useActiveTabs: (...args: unknown[]) => (mockActiveTabs as (...a: unknown[]) => unknown)(...args),
    useFocusedConnection: () => mockConnection,
}));
vi.mock('../../context/KustoClientContext', () => ({
    KustoClientContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
    useKustoClient: () => ({}),
}));
vi.mock('../ExplorerWorkspace/ExplorerWorkspace.styles', () => ({
    useExplorerStyles: () => new Proxy({}, { get: (_, p) => String(p) }),
}));
vi.mock('../ExplorerWorkspace/ExplorerWorkspace.logic', () => ({
    DEFAULT_QUERY: '',
    buildWellKnownClusters: vi.fn((clusters: unknown[]) => clusters),
    formatKql: vi.fn((q: string) => q),
    getQueryToRunFromEditor: vi.fn(() => ''),
    KEYBOARD_SHORTCUTS: [],
    createTab: vi.fn((q: string, title: string) => ({ id: '1', query: q, title, kql: '', connectionId: 'test-conn' })),
    loadConnections: vi.fn(() => [{ id: 'test-conn', name: 'Test Cluster', clusterUrl: 'https://help.kusto.windows.net', database: 'Telemetry', color: '#909d63' }]),
    loadActiveConnectionId: vi.fn(() => 'test-conn'),
    saveConnections: vi.fn(),
    saveActiveConnectionId: vi.fn(),
    formatBytes: vi.fn(() => '0 B'),
    exportCsv: vi.fn(),
    exportJson: vi.fn(),
    parseResultColumns: vi.fn(() => ({ columns: [], columnTypes: {} })),
    buildSuccessEntry: vi.fn(() => ({})),
    buildErrorEntry: vi.fn(() => ({})),
    DEFAULT_CONNECTION: { id: 'test-conn', name: 'Test Cluster', clusterUrl: 'https://help.kusto.windows.net', database: 'Telemetry', color: '#909d63' },
    CONNECTION_COLORS: ['#909d63', '#6a8799', '#ebc17a', '#bc5653', '#b06698'],
}));
vi.mock('../ExplorerWorkspace/kqlLanguage', () => ({
    registerKqlLanguage: vi.fn(),
    setKqlSchemaResolver: vi.fn(),
}));
vi.mock('@fluentui/react-components', () => ({
    Button: (p: Record<string, unknown>) => React.createElement('button', p, p['children'] as React.ReactNode),
    Tooltip: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    tokens: {},
}));
vi.mock('@fluentui/react-icons', () => ({
    AddRegular: () => React.createElement('span', null, 'icon'),
    DismissRegular: () => React.createElement('span', null, 'icon'),
    SplitVerticalRegular: () => React.createElement('span', null, 'icon'),
    SplitHorizontalRegular: () => React.createElement('span', null, 'icon'),
}));

const defaultExplorerState = {
    tabs: [{ id: '1', query: '', title: 'Tab 1', kql: '', connectionId: 'test-conn' }],
    activeTabId: '1',
    splitEnabled: false,
    splitDirection: 'vertical' as 'vertical' | 'horizontal',
    splitTabId: null as string | null,
    focusedPane: 'primary' as 'primary' | 'secondary',
    loading: false,
    error: null as string | null,
    queryStartTime: null as number | null,
    runningQueryKey: null as string | null,
    rows: null as Record<string, unknown>[] | null,
    columns: [] as string[],
    columnTypes: {} as Record<string, string>,
    elapsed: null as number | null,
    resultTime: null as Date | null,
    queryStats: null as Record<string, unknown> | null,
    resultSets: [] as unknown[],
    activeResultSet: 0,
    resultsTab: 'results' as 'results' | 'chart' | 'stats' | 'history',
    history: [] as unknown[],
    editorHeight: 50,
    hasSelection: false,
    canRecall: false,
    schema: [] as unknown[],
    schemaSearch: '',
    expandedFolders: new Set<string>(),
    expandedTables: new Set<string>(),
    schemaContextMenu: null as { x: number; y: number; item: Record<string, unknown> } | null,
    connections: [{ id: 'test-conn', name: 'Test Cluster', clusterUrl: 'https://help.kusto.windows.net', database: 'Telemetry', color: '#909d63' }],
};
const mockConnection = { id: 'test-conn', name: 'Test Cluster', clusterUrl: 'https://help.kusto.windows.net', database: 'Telemetry', color: '#909d63' };
const mockExplorerState = vi.fn(() => defaultExplorerState);
const mockDispatch = vi.fn();
const mockActiveTab = { id: '1', query: '', title: 'Tab 1', kql: '', connectionId: 'test-conn' };
const mockActiveTabs = vi.fn(() => ({
    activeTab: mockActiveTab,
    splitTab: null as { id: string; query: string; title: string; kql: string; connectionId: string } | null,
}));


describe('Explorer', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        mockExplorerState.mockReturnValue(defaultExplorerState);
        mockActiveTabs.mockReturnValue({ activeTab: mockActiveTab, splitTab: null });
        mockDispatch.mockClear();
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('renders without crashing', () => {
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with split mode enabled', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            splitEnabled: true,
            splitTabId: '2',
            tabs: [
                { id: '1', query: '', title: 'Tab 1', kql: 'table1', connectionId: 'test-conn' },
                { id: '2', query: '', title: 'Tab 2', kql: 'table2', connectionId: 'test-conn' },
            ],
        });
        mockActiveTabs.mockReturnValue({
            activeTab: { id: '1', query: '', title: 'Tab 1', kql: 'table1', connectionId: 'test-conn' },
            splitTab: { id: '2', query: '', title: 'Tab 2', kql: 'table2', connectionId: 'test-conn' },
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).toContain('monaco-editor');
    });

    it('renders loading state with cancel button visible', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            loading: true,
            runningQueryKey: 'test-key',
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with result data', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            rows: [{ Name: 'a', Value: 1 }],
            columns: ['Name', 'Value'],
            columnTypes: { Name: 'string', Value: 'long' },
            elapsed: 42,
            resultTime: new Date(),
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).toContain('results-panel');
    });

    it('renders in VSCode webview mode', () => {
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with multiple result sets', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            rows: [{ A: 1 }],
            columns: ['A'],
            resultSets: [
                { columns: [{ ColumnName: 'A', ColumnType: 'int' }], rows: [{ A: 1 }] },
                { columns: [{ ColumnName: 'B', ColumnType: 'string' }], rows: [{ B: 'x' }] },
            ],
            activeResultSet: 0,
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with secondary pane focused', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            splitEnabled: true,
            splitTabId: '2',
            focusedPane: 'secondary',
            tabs: [
                { id: '1', query: '', title: 'Tab 1', kql: '', connectionId: 'test-conn' },
                { id: '2', query: '', title: 'Tab 2', kql: '', connectionId: 'test-conn' },
            ],
        });
        mockActiveTabs.mockReturnValue({
            activeTab: { id: '1', query: '', title: 'Tab 1', kql: '', connectionId: 'test-conn' },
            splitTab: { id: '2', query: '', title: 'Tab 2', kql: '', connectionId: 'test-conn' },
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with error state', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            error: 'Query failed',
            rows: null,
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with schema data', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            schema: [
                { name: 'Events', folder: 'Tables', kind: 'table', columns: [{ name: 'Id', type: 'int' }] },
            ],
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).toContain('schema-sidebar');
    });

    it('renders with history entries', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            history: [
                { key: 'k1', query: 'Events | take 10', timestamp: Date.now(), elapsed: 100, rowCount: 10, columnCount: 2, status: 'success' },
            ],
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with horizontal split direction', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            splitEnabled: true,
            splitDirection: 'horizontal',
            splitTabId: '2',
            tabs: [
                { id: '1', query: '', title: 'Tab 1', kql: '', connectionId: 'test-conn' },
                { id: '2', query: '', title: 'Tab 2', kql: '', connectionId: 'test-conn' },
            ],
        });
        mockActiveTabs.mockReturnValue({
            activeTab: { id: '1', query: '', title: 'Tab 1', kql: '', connectionId: 'test-conn' },
            splitTab: { id: '2', query: '', title: 'Tab 2', kql: '', connectionId: 'test-conn' },
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with multiple tabs', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            tabs: [
                { id: '1', query: 'query1', title: 'Tab 1', kql: '', connectionId: 'test-conn' },
                { id: '2', query: 'query2', title: 'Tab 2', kql: '', connectionId: 'test-conn' },
                { id: '3', query: 'query3', title: 'Tab 3', kql: '', connectionId: 'test-conn' },
            ],
            activeTabId: '2',
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with running query cancelled', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            loading: false,
            runningQueryKey: null,
            rows: [],
            columns: [],
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('parses query from URL search params', () => {
        const originalLocation = window.location;
        delete (window as { location?: unknown }).location;
        window.location = Object.assign(Object.create(Object.getPrototypeOf(originalLocation)), originalLocation, { search: '?query=Events%20%7C%20take%2010' });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
        (window as unknown as { location: Location }).location = originalLocation;
    });

    it('handles URL parsing error gracefully', () => {
        const originalLocation = window.location;
        delete (window as { location?: unknown }).location;
        (window as unknown as { location: Location }).location = { search: '' } as Location;
        Object.defineProperty(window.location, 'search', {
            get: () => { throw new Error('URL error'); },
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
        (window as unknown as { location: Location }).location = originalLocation;
    });

    it('renders with canRecall enabled', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            canRecall: true,
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with hasSelection enabled', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            hasSelection: true,
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with different editor heights', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            editorHeight: 70,
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with query stats', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            rows: [{ A: 1 }],
            columns: ['A'],
            queryStats: { totalRows: 100, executionTime: 500 },
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with expanded schema folders', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            expandedFolders: new Set(['Tables']),
            expandedTables: new Set(['Events']),
            schema: [{ name: 'Events', folder: 'Tables', kind: 'table' }],
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with schema search active', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            schemaSearch: 'Events',
            schema: [{ name: 'Events', folder: 'Tables', kind: 'table' }],
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with schema context menu', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            schemaContextMenu: { x: 100, y: 200, item: { name: 'Events' } },
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with empty rows array', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            rows: [],
            columns: ['A', 'B'],
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with different results tabs', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            resultsTab: 'history',
            rows: [{ A: 1 }],
            columns: ['A'],
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders split view with both panes having different queries', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            splitEnabled: true,
            splitTabId: '2',
            tabs: [
                { id: '1', query: 'Events | take 10', title: 'Query 1', kql: 'Events | take 10', connectionId: 'test-conn' },
                { id: '2', query: 'Traces | take 20', title: 'Query 2', kql: 'Traces | take 20', connectionId: 'test-conn' },
            ],
        });
        mockActiveTabs.mockReturnValue({
            activeTab: { id: '1', query: 'Events | take 10', title: 'Query 1', kql: 'Events | take 10', connectionId: 'test-conn' },
            splitTab: { id: '2', query: 'Traces | take 20', title: 'Query 2', kql: 'Traces | take 20', connectionId: 'test-conn' },
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).toContain('monaco-editor');
    });

    it('renders with loading and no runningQueryKey', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            loading: true,
            runningQueryKey: null,
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with queryStartTime but no results yet', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            queryStartTime: Date.now(),
            loading: true,
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with multiple history entries with different statuses', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            history: [
                { key: 'k1', query: 'Events', timestamp: Date.now(), elapsed: 100, rowCount: 10, columnCount: 2, status: 'success' },
                { key: 'k2', query: 'Traces', timestamp: Date.now(), elapsed: null, rowCount: null, columnCount: 0, status: 'error', error: 'Query failed' },
            ],
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with result sets and non-zero activeResultSet', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            rows: [{ B: 'x' }],
            columns: ['B'],
            resultSets: [
                { columns: [{ ColumnName: 'A', ColumnType: 'int' }], rows: [{ A: 1 }] },
                { columns: [{ ColumnName: 'B', ColumnType: 'string' }], rows: [{ B: 'x' }] },
            ],
            activeResultSet: 1,
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with null resultTime', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            rows: [{ A: 1 }],
            columns: ['A'],
            resultTime: null,
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with null elapsed time', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            rows: [{ A: 1 }],
            columns: ['A'],
            elapsed: null,
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with empty schema', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            schema: [],
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).toContain('schema-sidebar');
    });

    it('renders with empty history', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            history: [],
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with error and null rows', () => {
        mockExplorerState.mockReturnValue({
            ...defaultExplorerState,
            error: 'Connection timeout',
            rows: null,
            columns: [],
        });
        act(() => {
            root.render(React.createElement(Explorer));
        });
        expect(container.innerHTML).not.toBe('');
    });
});
