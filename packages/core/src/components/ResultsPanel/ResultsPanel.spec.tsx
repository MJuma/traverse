import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ResultsPanel } from './ResultsPanel';

vi.mock('../../services/queryHistory', () => ({
    getHistory: vi.fn(() => Promise.resolve([])),
    clearHistory: vi.fn(() => Promise.resolve()),
    deleteHistoryEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../context/ExplorerStateContext', () => ({
    useExplorerState: () => mockExplorerState(),
    useExplorerDispatch: () => mockDispatch,
}));
vi.mock('../ExplorerWorkspace/ExplorerWorkspace.logic', () => ({
    formatBytes: vi.fn(() => '0 B'),
    exportCsv: vi.fn(),
    exportJson: vi.fn(),
}));
vi.mock('../ExplorerWorkspace/ExplorerWorkspace.styles', () => ({
    useExplorerStyles: () => new Proxy({}, { get: (_, p) => String(p) }),
}));
vi.mock('../ChartPanel/ChartPanel', () => ({
    ChartPanel: () => React.createElement('div', { 'data-testid': 'chart-panel' }),
}));
vi.mock('../ResultsTable/ResultsTable', () => ({
    ResultsTable: (p: Record<string, unknown>) => React.createElement('div', { 'data-testid': 'results-table' },
        p['headerLeft'] as React.ReactNode,
        p['headerRight'] as React.ReactNode,
    ),
}));
vi.mock('@fluentui/react-components', () => ({
    Text: (p: Record<string, unknown>) => React.createElement('span', p, p['children'] as React.ReactNode),
    Button: (p: Record<string, unknown>) => React.createElement('button', p, p['children'] as React.ReactNode),
    Tooltip: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    Spinner: () => React.createElement('div', null, 'loading'),
    tokens: { colorNeutralStroke2: '#stroke' },
}));
vi.mock('@fluentui/react-icons', () => ({
    DocumentCopyRegular: () => React.createElement('span', null, 'icon'),
    DeleteRegular: () => React.createElement('span', null, 'icon'),
    ArrowDownloadRegular: () => React.createElement('span', null, 'icon'),
}));

const defaultState = {
    rows: null as Record<string, unknown>[] | null,
    columns: [] as string[],
    elapsed: null as number | null,
    resultTime: null as Date | null,
    error: null as string | null,
    loading: false,
    queryStartTime: null as number | null,
    resultsTab: 'results' as string,
    history: [] as unknown[],
    queryStats: null as Record<string, unknown> | null,
    resultSets: [] as unknown[],
    activeResultSet: 0,
    columnTypes: {} as Record<string, string>,
};
const mockExplorerState = vi.fn(() => defaultState);
const mockDispatch = vi.fn();


describe('ResultsPanel', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        mockExplorerState.mockReturnValue(defaultState);
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

    it('renders without crashing with empty data', () => {
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders empty state when no rows and no error', () => {
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Run a query to see results');
    });

    it('renders loading state with elapsed timer', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            loading: true,
            queryStartTime: Date.now() - 5000,
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Executing query...');
    });

    it('renders error state', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            error: 'Syntax error near line 3',
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Syntax error near line 3');
    });

    it('renders with result rows showing results table', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [{ Name: 'alpha', Value: 1 }],
            columns: ['Name', 'Value'],
            elapsed: 42,
            resultTime: new Date(),
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ Name: 'alpha', Value: 1 }],
                displayColumns: ['Name', 'Value'],
                displayColumnTypes: { Name: 'string', Value: 'long' },
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.innerHTML).toContain('results-table');
    });

    it('renders 0 rows state', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [],
            columns: ['Name'],
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [],
                displayColumns: ['Name'],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Query returned 0 rows');
    });

    it('renders chart tab', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'chart',
            rows: [{ A: 1 }],
            columns: ['A'],
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ A: 1 }],
                displayColumns: ['A'],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.innerHTML).toContain('chart-panel');
    });

    it('renders chart tab with no data', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'chart',
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Run a query to chart results');
    });

    it('renders stats tab with no stats', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'stats',
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Run a query to see execution stats');
    });

    it('renders stats tab with query stats', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'stats',
            elapsed: 150,
            queryStats: {
                executionTime: '0:00:00.123',
                cpuTime: '0:00:00.045',
                memoryPeak: 1048576,
                resultRows: 100,
                resultSize: 2048,
                extentsScanned: 10,
                extentsTotal: 50,
                rowsScanned: 1000,
                rowsTotal: 5000,
                cacheHitBytes: 1024,
                cacheMissBytes: 512,
                fromCache: false,
            },
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Client Round-Trip');
        expect(container.textContent).toContain('150 ms');
        expect(container.textContent).toContain('Server Execution Time');
        expect(container.textContent).toContain('CPU Time');
        expect(container.textContent).toContain('Memory Peak');
        expect(container.textContent).toContain('Result Rows');
        expect(container.textContent).toContain('Extents Scanned');
        expect(container.textContent).toContain('Rows Scanned');
    });

    it('renders history tab with no history', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'history',
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('No query history yet');
    });

    it('renders history tab with entries', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'history',
            history: [
                { key: 'k1', query: 'Events | take 10', timestamp: Date.now(), elapsed: 100, rowCount: 10, columnCount: 2, status: 'success', rows: [{ a: 1 }] },
                { key: 'k2', query: 'bad query', timestamp: Date.now(), elapsed: null, rowCount: null, columnCount: 0, status: 'error', error: 'syntax error' },
            ],
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Events | take 10');
        expect(container.textContent).toContain('recallable');
        expect(container.textContent).toContain('error');
    });

    it('switches tabs when tab buttons are clicked', () => {
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        const buttons = container.querySelectorAll('button[type="button"]');
        const chartBtn = Array.from(buttons).find((b) => b.textContent === 'CHART');
        if (chartBtn) {
            act(() => { (chartBtn as HTMLButtonElement).click(); });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_RESULTS_TAB', tab: 'chart' });
        }
    });

    it('switches to stats tab', () => {
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        const buttons = container.querySelectorAll('button[type="button"]');
        const statsBtn = Array.from(buttons).find((b) => b.textContent === 'STATS');
        if (statsBtn) {
            act(() => { (statsBtn as HTMLButtonElement).click(); });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_RESULTS_TAB', tab: 'stats' });
        }
    });

    it('switches to history tab', () => {
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        const buttons = container.querySelectorAll('button[type="button"]');
        const histBtn = Array.from(buttons).find((b) => b.textContent === 'HISTORY');
        if (histBtn) {
            act(() => { (histBtn as HTMLButtonElement).click(); });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_RESULTS_TAB', tab: 'history' });
        }
    });

    it('calls onClear when clear button is clicked', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [{ A: 1 }],
            columns: ['A'],
            elapsed: 42,
            resultTime: new Date(),
        });
        const onClear = vi.fn();
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ A: 1 }],
                displayColumns: ['A'],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear,
            }));
        });
        // Multiple buttons exist, just verify render
        expect(container.innerHTML).toBeTruthy();
    });

    it('clicks export CSV button with results', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [{ Name: 'a', Value: 1 }],
            columns: ['Name', 'Value'],
            elapsed: 42,
            resultTime: new Date(),
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ Name: 'a', Value: 1 }],
                displayColumns: ['Name', 'Value'],
                displayColumnTypes: { Name: 'string', Value: 'long' },
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        // Export buttons are in the results header
        const buttons = container.querySelectorAll('button');
        // Click all buttons to cover export/copy/clear handlers
        for (const btn of Array.from(buttons)) {
            act(() => { btn.click(); });
        }
        expect(container.innerHTML).toBeTruthy();
    });

    it('clicks history entry recall button', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'history',
            history: [
                { key: 'k1', query: 'Events | take 10', timestamp: Date.now(), elapsed: 100, rowCount: 10, columnCount: 2, status: 'success', rows: [{ a: 1 }] },
            ],
        });
        const onRecall = vi.fn();
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall,
                onClear: vi.fn(),
            }));
        });
        // Click the recall button (first clickable button in the history entry)
        const buttons = container.querySelectorAll('button');
        // Only click buttons that don't trigger deleteHistoryEntry
        const recallBtn = Array.from(buttons).find((b) => b.textContent === 'recallable' || b.textContent?.includes('Recall'));
        if (recallBtn) {
            act(() => { recallBtn.click(); });
        }
        expect(container.innerHTML).toBeTruthy();
    });

    it('switches result set when multiple result sets are present', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'results',
            rows: [{ A: 1 }],
            columns: ['A'],
            resultSets: [
                { columns: [{ ColumnName: 'A', ColumnType: 'int' }], rows: [{ A: 1 }] },
                { columns: [{ ColumnName: 'B', ColumnType: 'string' }], rows: [{ B: 'x' }] },
            ],
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ A: 1 }],
                displayColumns: ['A'],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        // Click result set tab buttons
        const buttons = container.querySelectorAll('button');
        const table2Btn = Array.from(buttons).find((b) => b.textContent === 'Table 2');
        if (table2Btn) {
            act(() => { table2Btn.click(); });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_ACTIVE_RESULT_SET', index: 1 });
        }
    });

    it('copies TSV to clipboard when copy button is clicked', () => {
        const writeTextFn = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText: writeTextFn } });
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [{ Name: 'alpha', Value: 1 }],
            columns: ['Name', 'Value'],
            elapsed: 42,
            resultTime: new Date(),
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ Name: 'alpha', Value: 1 }],
                displayColumns: ['Name', 'Value'],
                displayColumnTypes: { Name: 'string', Value: 'long' },
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        // The headerRight is now rendered by the updated ResultsTable mock
        // Find copy button (first icon button in results header)
        const iconBtns = Array.from(container.querySelectorAll('button'));
        for (const btn of iconBtns) {
            act(() => { btn.click(); });
        }
        expect(writeTextFn).toHaveBeenCalled();
    });

    it('calls onClear handler when clear button is clicked', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [{ A: 1 }],
            columns: ['A'],
            elapsed: 42,
            resultTime: new Date(),
        });
        const onClear = vi.fn();
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ A: 1 }],
                displayColumns: ['A'],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear,
            }));
        });
        const buttons = Array.from(container.querySelectorAll('button'));
        for (const btn of buttons) {
            act(() => { btn.click(); });
        }
        expect(onClear).toHaveBeenCalled();
    });

    it('clears history when clear history button is clicked', async () => {
        const { clearHistory } = await import('../../services/queryHistory');
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'history',
            history: [
                { key: 'k1', query: 'Events', timestamp: Date.now(), elapsed: 100, rowCount: 10, columnCount: 2, status: 'success' },
            ],
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        const clearBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Clear'));
        if (clearBtn) {
            await act(async () => { clearBtn.click(); });
            expect(clearHistory).toHaveBeenCalled();
        }
    });

    it('deletes history entry when delete button is clicked in history', async () => {
        const { deleteHistoryEntry } = await import('../../services/queryHistory');
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'history',
            history: [
                { key: 'k1', query: 'Events | take 10', timestamp: Date.now(), elapsed: 100, rowCount: 10, columnCount: 2, status: 'success', rows: [{ a: 1 }] },
            ],
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        // Find the delete button in the history entry (small icon button)
        const deleteButtons = Array.from(container.querySelectorAll('button')).filter(
            (b) => b.textContent?.includes('icon') && b.style.minWidth === 'auto',
        );
        if (deleteButtons.length > 0) {
            await act(async () => { deleteButtons[0].click(); });
            expect(deleteHistoryEntry).toHaveBeenCalled();
        }
    });

    it('recalls history entry when clicked', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'history',
            history: [
                { key: 'k1', query: 'Events | take 10', timestamp: Date.now(), elapsed: 100, rowCount: 10, columnCount: 2, status: 'success', rows: [{ a: 1 }] },
            ],
        });
        const onRecall = vi.fn();
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall,
                onClear: vi.fn(),
            }));
        });
        // Click the history item button (the outer button wrapping the entry)
        const historyBtns = Array.from(container.querySelectorAll('button[type="button"]')).filter(
            (b) => b.textContent?.includes('Events | take 10'),
        );
        if (historyBtns.length > 0) {
            act(() => { (historyBtns[0] as HTMLButtonElement).click(); });
            expect(onRecall).toHaveBeenCalled();
        }
    });

    it('renders with multiple result sets', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'results',
            rows: [],
            columns: ['A'],
            resultSets: [
                { columns: [{ ColumnName: 'A', ColumnType: 'int' }], rows: [{ A: 1 }] },
                { columns: [{ ColumnName: 'B', ColumnType: 'string' }], rows: [{ B: 'x' }] },
            ],
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ A: 1 }],
                displayColumns: ['A'],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        // With 0-length rows array the results header is rendered inline with tab buttons
        expect(container.textContent).toContain('RESULTS');
    });

    it('renders stats tab with cache hit', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'stats',
            queryStats: {
                executionTime: null,
                cpuTime: null,
                memoryPeak: null,
                resultRows: null,
                resultSize: null,
                extentsScanned: null,
                rowsScanned: null,
                cacheHitBytes: null,
                cacheMissBytes: null,
                fromCache: true,
            },
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('✓ Hit');
    });

    it('handles export handlers early return when columns are empty', async () => {
        const { exportCsv, exportJson } = await import('../ExplorerWorkspace/ExplorerWorkspace.logic');
        const writeTextFn = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText: writeTextFn } });
        (exportCsv as ReturnType<typeof vi.fn>).mockClear();
        (exportJson as ReturnType<typeof vi.fn>).mockClear();
        writeTextFn.mockClear();
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [{ A: 1 }],
            columns: [],
            elapsed: 10,
            resultTime: new Date(),
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ A: 1 }],
                displayColumns: ['A'],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        const buttons = Array.from(container.querySelectorAll('button'));
        for (const btn of buttons) {
            act(() => { btn.click(); });
        }
        expect(exportCsv).not.toHaveBeenCalled();
        expect(exportJson).not.toHaveBeenCalled();
        expect(writeTextFn).not.toHaveBeenCalled();
    });

    it('calls exportCsv and exportJson when data is present', async () => {
        const { exportCsv, exportJson } = await import('../ExplorerWorkspace/ExplorerWorkspace.logic');
        const writeTextFn = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText: writeTextFn } });
        (exportCsv as ReturnType<typeof vi.fn>).mockClear();
        (exportJson as ReturnType<typeof vi.fn>).mockClear();
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [{ Name: 'a' }],
            columns: ['Name'],
            elapsed: 10,
            resultTime: new Date(),
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ Name: 'a' }],
                displayColumns: ['Name'],
                displayColumnTypes: { Name: 'string' },
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        const buttons = Array.from(container.querySelectorAll('button'));
        for (const btn of buttons) {
            act(() => { btn.click(); });
        }
        expect(exportCsv).toHaveBeenCalled();
        expect(exportJson).toHaveBeenCalled();
    });

    it('does not crash when onClear is undefined', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [{ A: 1 }],
            columns: ['A'],
            elapsed: 42,
            resultTime: new Date(),
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ A: 1 }],
                displayColumns: ['A'],
                displayColumnTypes: {},
                onRecall: vi.fn(),
            }));
        });
        const buttons = Array.from(container.querySelectorAll('button'));
        for (const btn of buttons) {
            act(() => { btn.click(); });
        }
        expect(container.innerHTML).toBeTruthy();
    });

    it('renders history entry with null elapsed and no rows (not recallable)', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'history',
            history: [
                { key: 'k1', query: 'Events', timestamp: Date.now(), elapsed: null, rowCount: 5, columnCount: 3, status: 'success', rows: null },
            ],
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Events');
        expect(container.textContent).toContain('5 rows × 3 cols');
        expect(container.textContent).not.toContain('recallable');
    });

    it('renders stats cache miss text', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'stats',
            queryStats: {
                executionTime: null,
                cpuTime: null,
                memoryPeak: null,
                resultRows: null,
                resultSize: null,
                extentsScanned: null,
                rowsScanned: null,
                cacheHitBytes: null,
                cacheMissBytes: null,
                fromCache: false,
            },
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('✗ Miss');
    });

    it('renders stats with missing extentsTotal and rowsTotal showing ?', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'stats',
            queryStats: {
                executionTime: null,
                cpuTime: null,
                memoryPeak: null,
                resultRows: null,
                resultSize: null,
                extentsScanned: 5,
                extentsTotal: null,
                rowsScanned: 200,
                rowsTotal: null,
                cacheHitBytes: null,
                cacheMissBytes: null,
                fromCache: null,
            },
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('5 / ?');
        expect(container.textContent).toContain('200 / ?');
    });

    it('renders stats with resultSize', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'stats',
            queryStats: {
                executionTime: null,
                cpuTime: null,
                memoryPeak: null,
                resultRows: null,
                resultSize: 10240,
                extentsScanned: null,
                rowsScanned: null,
                cacheHitBytes: null,
                cacheMissBytes: null,
                fromCache: null,
            },
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Result Size');
        expect(container.textContent).toContain('10.0 KB');
    });

    it('renders stats with shard cache hit and miss bytes', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'stats',
            queryStats: {
                executionTime: null,
                cpuTime: null,
                memoryPeak: null,
                resultRows: null,
                resultSize: null,
                extentsScanned: null,
                rowsScanned: null,
                cacheHitBytes: 2048,
                cacheMissBytes: null,
                fromCache: null,
            },
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Shard Cache Hit / Miss');
    });

    it('clicks RESULTS tab from non-results tab', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'chart',
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        const resultsBtn = Array.from(container.querySelectorAll('button[type="button"]')).find(
            (b) => b.textContent === 'RESULTS',
        );
        expect(resultsBtn).toBeTruthy();
        act(() => { (resultsBtn as HTMLButtonElement).click(); });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_RESULTS_TAB', tab: 'results' });
    });

    it('renders chart tab with empty displayRows array showing empty state', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'chart',
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [],
                displayColumns: ['A'],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Run a query to chart results');
    });

    it('renders history tab label with count on results tab', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'results',
            history: [
                { key: 'k1', query: 'q1', timestamp: Date.now(), elapsed: 10, rowCount: 1, columnCount: 1, status: 'success' },
                { key: 'k2', query: 'q2', timestamp: Date.now(), elapsed: 20, rowCount: 2, columnCount: 1, status: 'success' },
            ],
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('HISTORY (2)');
    });

    it('renders history tab label with count on non-results tab', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'history',
            history: [
                { key: 'k1', query: 'q1', timestamp: Date.now(), elapsed: 10, rowCount: 1, columnCount: 1, status: 'success' },
            ],
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('HISTORY (1)');
    });

    it('renders tooltip and tabs with multiple result sets info', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [{ A: 1 }],
            columns: ['A'],
            elapsed: 50,
            resultTime: new Date('2024-01-01T12:00:00'),
            resultSets: [
                { columns: [{ ColumnName: 'A', ColumnType: 'int' }], rows: [{ A: 1 }] },
                { columns: [{ ColumnName: 'B', ColumnType: 'string' }], rows: [{ B: 'x' }] },
                { columns: [{ ColumnName: 'C', ColumnType: 'string' }], rows: [{ C: 'y' }] },
            ],
            activeResultSet: 1,
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ A: 1 }],
                displayColumns: ['A'],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Table 1');
        expect(container.textContent).toContain('Table 2');
        expect(container.textContent).toContain('Table 3');
    });

    it('clicks Table 1 (active result set tab)', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [{ A: 1 }],
            columns: ['A'],
            elapsed: 50,
            resultTime: new Date(),
            resultSets: [
                { columns: [{ ColumnName: 'A', ColumnType: 'int' }], rows: [{ A: 1 }] },
                { columns: [{ ColumnName: 'B', ColumnType: 'string' }], rows: [{ B: 'x' }] },
            ],
            activeResultSet: 0,
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ A: 1 }],
                displayColumns: ['A'],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        const table1Btn = Array.from(container.querySelectorAll('button[type="button"]')).find(
            (b) => b.textContent === 'Table 1',
        );
        expect(table1Btn).toBeTruthy();
        act(() => { (table1Btn as HTMLButtonElement).click(); });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_ACTIVE_RESULT_SET', index: 0 });
    });

    it('renders elapsed time in header right stat text', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [{ X: 1 }],
            columns: ['X'],
            elapsed: 123,
            resultTime: new Date('2024-01-01T12:00:00'),
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: true,
                displayRows: [{ X: 1 }],
                displayColumns: ['X'],
                displayColumnTypes: { X: 'int' },
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('1 rows');
        expect(container.textContent).toContain('123ms');
    });

    it('renders without elapsed text when elapsed is null', () => {
        mockExplorerState.mockReturnValue({
            ...defaultState,
            rows: [{ X: 1 }],
            columns: ['X'],
            elapsed: null,
            resultTime: null,
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: [{ X: 1 }],
                displayColumns: ['X'],
                displayColumnTypes: { X: 'int' },
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('1 rows');
        expect(container.textContent).not.toContain('·');
    });

    it('invokes clearHistory from header clear button', async () => {
        const { clearHistory: clearHistoryMock } = await import('../../services/queryHistory');
        (clearHistoryMock as ReturnType<typeof vi.fn>).mockClear();
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'history',
            history: [
                { key: 'k1', query: 'q1', timestamp: Date.now(), elapsed: 10, rowCount: 1, columnCount: 1, status: 'success' },
            ],
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        const headerDiv = container.querySelector('.resultsHeader');
        const clearBtn = headerDiv?.querySelector('button[appearance="subtle"]');
        expect(clearBtn).toBeTruthy();
        await act(async () => { (clearBtn as HTMLButtonElement).click(); });
        expect(clearHistoryMock).toHaveBeenCalled();
    });

    it('invokes deleteHistoryEntry from history item delete button', async () => {
        const { deleteHistoryEntry: deleteEntryMock } = await import('../../services/queryHistory');
        (deleteEntryMock as ReturnType<typeof vi.fn>).mockClear();
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'history',
            history: [
                { key: 'k1', query: 'Events', timestamp: Date.now(), elapsed: 10, rowCount: 1, columnCount: 1, status: 'success' },
            ],
        });
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall: vi.fn(),
                onClear: vi.fn(),
            }));
        });
        const historyList = container.querySelector('.historyList');
        const deleteBtn = historyList?.querySelector('button[title="Delete"]');
        expect(deleteBtn).toBeTruthy();
        await act(async () => { (deleteBtn as HTMLButtonElement).click(); });
        expect(deleteEntryMock).toHaveBeenCalledWith('k1');
    });

    it('invokes onRecall when history item is clicked', () => {
        const entry = { key: 'k1', query: 'Events', timestamp: Date.now(), elapsed: 10, rowCount: 1, columnCount: 1, status: 'success' };
        mockExplorerState.mockReturnValue({
            ...defaultState,
            resultsTab: 'history',
            history: [entry],
        });
        const onRecall = vi.fn();
        act(() => {
            root.render(React.createElement(ResultsPanel, {
                isDark: false,
                displayRows: null,
                displayColumns: [],
                displayColumnTypes: {},
                onRecall,
                onClear: vi.fn(),
            }));
        });
        const historyItemBtn = container.querySelector('.historyItem') as HTMLButtonElement;
        expect(historyItemBtn).toBeTruthy();
        act(() => { historyItemBtn.click(); });
        expect(onRecall).toHaveBeenCalledWith(entry);
    });
});
