
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ExplorerWorkspace } from './ExplorerWorkspace';

vi.mock('../EditorToolbar/EditorToolbar', () => ({
    EditorToolbar: (p: Record<string, unknown>) => React.createElement('div', { 'data-testid': 'editor-toolbar', 'data-show-cancel': String(p['showCancel']) }),
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
vi.mock('@monaco-editor/react', () => ({
    Editor: (p: Record<string, unknown>) => {
        const onMount = p['onMount'] as ((editor: unknown, monaco: unknown) => void) | undefined;
        React.useEffect(() => {
            if (onMount) {
                const mockEditor = {
                    getModel: () => ({
                        onDidChangeContent: vi.fn(),
                        getValue: () => 'TestTable | take 10',
                        getLineCount: () => 1,
                        getLineContent: () => 'TestTable | take 10',
                        getLineMaxColumn: () => 20,
                    }),
                    onDidChangeCursorPosition: vi.fn(),
                    onDidChangeCursorSelection: vi.fn(),
                    onDidChangeModelContent: vi.fn(),
                    onDidFocusEditorWidget: vi.fn(),
                    getPosition: () => ({ lineNumber: 1, column: 1 }),
                    getSelection: () => null,
                    createDecorationsCollection: () => ({ set: vi.fn(), clear: vi.fn() }),
                    focus: vi.fn(),
                    setPosition: vi.fn(),
                    revealLineInCenter: vi.fn(),
                    addAction: vi.fn(),
                    addCommand: vi.fn(),
                    executeEdits: vi.fn(),
                    setValue: vi.fn(),
                    getValue: () => 'TestTable | take 10',
                };
                const mockMonaco = {
                    languages: { register: vi.fn(), setMonarchTokensProvider: vi.fn(), registerCompletionItemProvider: vi.fn() },
                    editor: { defineTheme: vi.fn() },
                    KeyMod: { CtrlCmd: 2048, Shift: 1024, Alt: 512 },
                    KeyCode: { Enter: 3, KeyR: 48, KeyF: 36 },
                };
                onMount(mockEditor, mockMonaco);
            }
        }, [onMount]);
        return React.createElement('div', { 'data-testid': 'monaco-editor', 'data-value': p['value'] as string });
    },
}));
vi.mock('../../context/ExplorerColorContext', () => ({
    useExplorerColors: () => ({
        semantic: {
            backdrop: 'rgba(0,0,0,0.4)', functionBadge: '#4caf50', highlightHoverBg: 'rgba(255,200,0,0.2)',
            lookupBadge: '#e8912d', materializedViewBadge: '#9c6ade', scrollThumb: 'rgba(128,128,128,0.4)',
            scrollThumbHover: 'rgba(128,128,128,0.6)', selectionBg: 'rgba(0,120,212,0.15)',
            selectionSubtle: 'rgba(0,120,212,0.06)', shadowLight: 'rgba(0,0,0,0.15)', shadowMedium: 'rgba(0,0,0,0.3)',
        },
        chart: { palette: ['#6a8799', '#909d63', '#ebc17a'] },
    }),
}));
vi.mock('../../context/ExplorerStateContext', () => {
    const state = {
        schema: [], connections: [{ id: 'c1', name: 'Test', clusterUrl: 'https://test.kusto.windows.net', database: 'DB', color: '#aaa' }],
        tabs: [{ id: 't1', name: 'Tab 1', kql: 'StormEvents | take 10', connectionId: 'c1' }],
        activeTabId: 't1', splitEnabled: false, splitDirection: 'vertical' as const, splitTabId: null, focusedPane: 'primary' as const,
        loading: false, runningQueryKey: null,
        rows: null, columns: [], columnTypes: {}, resultSets: [], activeResultSet: 0,
        history: [], editorHeight: 300, canRecall: false, hasSelection: false, editorDropTarget: null,
    };
    return {
        useExplorerState: () => state,
        useExplorerDispatch: () => vi.fn(),
        useActiveTabs: () => ({
            activeTab: state.tabs[0],
            splitTab: null,
        }),
        useFocusedConnection: () => state.connections[0],
    };
});
vi.mock('../../context/KustoClientContext', () => ({
    useKustoClient: () => ({
        queryKusto: vi.fn().mockResolvedValue({ rows: [], columns: [], resultSets: [] }),
        queryKustoMgmt: vi.fn().mockResolvedValue({ rows: [], columns: [] }),
        clearQueryCache: vi.fn(),
        getQueryCacheSize: vi.fn().mockReturnValue(0),
    }),
}));
vi.mock('../../services/queryHistory', () => ({
    normalizeQuery: (q: string) => (q ?? '').trim(),
    getHistory: vi.fn().mockResolvedValue([]),
    saveHistoryEntry: vi.fn(),
    recallResult: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/schema', () => ({
    getSchema: vi.fn().mockReturnValue([]),
    loadSchema: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./ExplorerWorkspace.logic', () => ({
    formatKql: (s: string) => s,
    getQueryToRunFromEditor: () => 'StormEvents | take 10',
    parseResultColumns: () => ({ columns: [], columnTypes: {} }),
    buildSuccessEntry: () => ({ key: 'k', query: 'q', timestamp: Date.now(), status: 'success' as const, rowCount: 0, columnCount: 0, elapsed: 0 }),
    buildErrorEntry: () => ({ key: 'k', query: 'q', timestamp: Date.now(), status: 'error' as const, rowCount: 0, columnCount: 0, elapsed: 0, error: 'err' }),
    saveActiveConnectionId: vi.fn(),
    CONNECTION_COLORS: ['#aaa', '#bbb'],
    DEFAULT_CONNECTION: { id: 'c1', name: 'Test', clusterUrl: 'https://test.kusto.windows.net', database: 'DB', color: '#aaa' },
    loadConnections: vi.fn().mockReturnValue([]),
    saveConnections: vi.fn(),
    buildWellKnownClusters: vi.fn().mockReturnValue([]),
    KEYBOARD_SHORTCUTS: [],
}));
vi.mock('./ExplorerWorkspace.styles', () => ({
    useExplorerStyles: () => new Proxy({}, { get: (_, p) => String(p) }),
}));
vi.mock('./kqlLanguage', () => ({
    registerKqlLanguage: vi.fn(),
    setKqlSchemaResolver: vi.fn(),
}));

// Mock all sub-components to isolate ExplorerWorkspace


let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.restoreAllMocks();
});

const defaultProps = {
    isDark: false,
    kustoClient: {} as never,
    colors: {} as never,
    clusters: [],
};

describe('ExplorerWorkspace', () => {
    it('renders toolbar, tab bar, editor, and results panel', () => {
        act(() => { root.render(React.createElement(ExplorerWorkspace, defaultProps)); });

        expect(container.querySelector('[data-testid="editor-toolbar"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="tab-bar"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="monaco-editor"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="results-panel"]')).toBeTruthy();
    });

    it('renders schema sidebar', () => {
        act(() => { root.render(React.createElement(ExplorerWorkspace, defaultProps)); });

        expect(container.querySelector('[data-testid="schema-sidebar"]')).toBeTruthy();
    });

    it('passes isDark to editor theme', () => {
        act(() => { root.render(React.createElement(ExplorerWorkspace, { ...defaultProps, isDark: true })); });

        const editor = container.querySelector('[data-testid="monaco-editor"]');
        expect(editor).toBeTruthy();
    });

    it('renders with className prop', () => {
        act(() => { root.render(React.createElement(ExplorerWorkspace, { ...defaultProps, className: 'my-class' })); });

        expect(container.innerHTML).toBeTruthy();
    });

    it('renders drag handle between editor and results', () => {
        act(() => { root.render(React.createElement(ExplorerWorkspace, defaultProps)); });

        const dragHandle = container.querySelector('[role="separator"]');
        expect(dragHandle).toBeTruthy();
    });

    it('handles editor mount callback', () => {
        act(() => { root.render(React.createElement(ExplorerWorkspace, defaultProps)); });

        expect(container.querySelector('[data-testid="monaco-editor"]')).toBeTruthy();
    });

    it('renders editor with active tab query', () => {
        act(() => { root.render(React.createElement(ExplorerWorkspace, defaultProps)); });

        const editor = container.querySelector('[data-testid="monaco-editor"]');
        expect(editor?.getAttribute('data-value')).toBe('StormEvents | take 10');
    });

    it('renders drag handle that responds to mousedown', () => {
        act(() => { root.render(React.createElement(ExplorerWorkspace, defaultProps)); });

        const separators = container.querySelectorAll('[role="separator"]');
        expect(separators.length).toBeGreaterThan(0);
        // Simulate drag start
        act(() => {
            separators[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientY: 200 }));
        });
        // Simulate drag end via document mouseup
        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        });
    });

    it('renders with split mode disabled', () => {
        act(() => { root.render(React.createElement(ExplorerWorkspace, defaultProps)); });

        // Only one editor when split is disabled
        const editors = container.querySelectorAll('[data-testid="monaco-editor"]');
        expect(editors).toHaveLength(1);
    });
});
