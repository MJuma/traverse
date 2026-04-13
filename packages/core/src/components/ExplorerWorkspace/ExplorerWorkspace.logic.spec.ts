import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    DEFAULT_QUERY,
    KEYBOARD_SHORTCUTS,
    createTab,
    formatBytes,
    formatKql,
    getQueryToRun,
    getQueryToRunFromEditor,
    downloadFile,
    exportCsv,
    exportJson,
    loadConnections,
    saveConnections,
    loadActiveConnectionId,
    saveActiveConnectionId,
    shortenClusterUrl,
    DEFAULT_CONNECTION,
    CONNECTION_COLORS,
    parseResultColumns,
    buildSuccessEntry,
    buildErrorEntry,
} from './ExplorerWorkspace.logic';

const mockConnStore = new Map<string, unknown>();
vi.mock('../../services/state-service', () => ({
    stateService: {
        get: (_s: string, key: string) => mockConnStore.get(key) ?? null,
        set: (_s: string, key: string, value: unknown) => { mockConnStore.set(key, value); },
        delete: (_s: string, key: string) => { mockConnStore.delete(key); },
        subscribe: () => () => {},
    },
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('DEFAULT_QUERY', () => {
    it('is a non-empty string', () => {
        expect(typeof DEFAULT_QUERY).toBe('string');
        expect(DEFAULT_QUERY.length).toBeGreaterThan(0);
    });

    it('contains KQL-like content', () => {
        expect(DEFAULT_QUERY).toContain('|');
    });
});

describe('KEYBOARD_SHORTCUTS', () => {
    it('is a non-empty array', () => {
        expect(Array.isArray(KEYBOARD_SHORTCUTS)).toBe(true);
        expect(KEYBOARD_SHORTCUTS.length).toBeGreaterThan(0);
    });

    it('each entry has keys and action', () => {
        for (const shortcut of KEYBOARD_SHORTCUTS) {
            expect(shortcut).toHaveProperty('keys');
            expect(shortcut).toHaveProperty('action');
            expect(typeof shortcut.keys).toBe('string');
            expect(typeof shortcut.action).toBe('string');
        }
    });
});

// ---------------------------------------------------------------------------
// createTab
// ---------------------------------------------------------------------------

describe('createTab', () => {
    it('creates a tab with auto-generated id', () => {
        const tab = createTab();
        expect(tab.id).toMatch(/^tab-\d+$/);
    });

    it('creates a tab with default title', () => {
        const tab = createTab();
        expect(tab.title).toMatch(/^Query \d+$/);
    });

    it('creates a tab with custom title', () => {
        const tab = createTab('', 'My Tab');
        expect(tab.title).toBe('My Tab');
    });

    it('creates a tab with provided kql', () => {
        const tab = createTab('StormEvents | take 10');
        expect(tab.kql).toBe('StormEvents | take 10');
    });

    it('defaults kql to empty string', () => {
        const tab = createTab();
        expect(tab.kql).toBe('');
    });

    it('generates unique IDs for each tab', () => {
        const tab1 = createTab();
        const tab2 = createTab();
        expect(tab1.id).not.toBe(tab2.id);
    });
});

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------

describe('formatBytes', () => {
    it('returns "0 B" for zero bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
    });

    it('returns bytes for values less than 1024', () => {
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(1)).toBe('1 B');
        expect(formatBytes(1023)).toBe('1023 B');
    });

    it('returns KB for values in KB range', () => {
        expect(formatBytes(1024)).toBe('1.0 KB');
        expect(formatBytes(2048)).toBe('2.0 KB');
        expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('returns MB for values in MB range', () => {
        expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
        expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
        expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });
});

// ---------------------------------------------------------------------------
// formatKql
// ---------------------------------------------------------------------------

describe('formatKql', () => {
    it('puts pipes on newlines', () => {
        const result = formatKql('Table | where x > 1 | take 10');
        expect(result).toContain('\n| where x > 1');
        expect(result).toContain('\n| take 10');
    });

    it('handles let statements', () => {
        const result = formatKql('let x = 5;\n\nTable | take 10');
        expect(result).toContain('let x = 5;');
        expect(result).toContain('Table');
        expect(result).toContain('| take 10');
    });

    it('preserves quotes around pipes', () => {
        const result = formatKql("Table | where Name == 'a|b' | take 10");
        expect(result).toContain("'a|b'");
    });

    it('handles empty input', () => {
        expect(formatKql('')).toBe('');
    });

    it('handles single statement without pipes', () => {
        expect(formatKql('Table')).toBe('Table');
    });

    it('handles whitespace-only input', () => {
        expect(formatKql('   ')).toBe('');
    });

    it('handles double-quoted strings with pipes', () => {
        const result = formatKql('Table | where Name == "a|b" | take 10');
        expect(result).toContain('"a|b"');
    });

    it('handles multiple statements separated by blank lines', () => {
        const result = formatKql('let x = 1;\n\nTable | take 10');
        const parts = result.split('\n\n');
        expect(parts.length).toBe(2);
    });

    it('normalizes inner whitespace around pipes', () => {
        const result = formatKql('Table\n    |  where   x > 1\n    |  take   10');
        expect(result).toContain('| where');
        expect(result).toContain('| take');
        // Each pipe segment starts on its own line
        const lines = result.split('\n');
        expect(lines[0]).toBe('Table');
        expect(lines[1]).toMatch(/^\| where/);
        expect(lines[2]).toMatch(/^\| take/);
    });
});

// ---------------------------------------------------------------------------
// getQueryToRun
// ---------------------------------------------------------------------------

describe('getQueryToRun', () => {
    it('returns selected text when selection is non-empty', () => {
        const result = getQueryToRun(
            () => ({ isEmpty: () => false, startLineNumber: 1, endLineNumber: 2 }),
            () => 'SELECT * FROM table',
            () => ({ lineNumber: 1 }),
            () => 5,
            () => '',
        );
        expect(result).not.toBeNull();
        expect(result?.query).toBe('SELECT * FROM table');
        expect(result?.range).toEqual({ startLine: 1, endLine: 2 });
    });

    it('returns null when selection is non-empty but text is whitespace-only', () => {
        const result = getQueryToRun(
            () => ({ isEmpty: () => false, startLineNumber: 1, endLineNumber: 1 }),
            () => '   ',
            () => ({ lineNumber: 1 }),
            () => 1,
            () => '',
        );
        expect(result).toBeNull();
    });

    it('finds current statement block around cursor', () => {
        const lines = ['Table', '| where x > 1', '| take 10', '', 'Other'];
        const result = getQueryToRun(
            () => ({ isEmpty: () => true, startLineNumber: 1, endLineNumber: 1 }),
            () => '',
            () => ({ lineNumber: 2 }),
            () => lines.length,
            (line: number) => lines[line - 1],
        );
        expect(result).not.toBeNull();
        expect(result?.query).toContain('Table');
        expect(result?.query).toContain('| where x > 1');
        expect(result?.query).toContain('| take 10');
        expect(result?.range).toEqual({ startLine: 1, endLine: 3 });
    });

    it('returns null for empty content', () => {
        const result = getQueryToRun(
            () => ({ isEmpty: () => true, startLineNumber: 1, endLineNumber: 1 }),
            () => '',
            () => ({ lineNumber: 1 }),
            () => 1,
            () => '',
        );
        expect(result).toBeNull();
    });

    it('handles cursor at first line of multi-line block', () => {
        const lines = ['Table', '| take 10'];
        const result = getQueryToRun(
            () => ({ isEmpty: () => true, startLineNumber: 1, endLineNumber: 1 }),
            () => '',
            () => ({ lineNumber: 1 }),
            () => lines.length,
            (line: number) => lines[line - 1],
        );
        expect(result?.range).toEqual({ startLine: 1, endLine: 2 });
    });

    it('handles cursor at last line of multi-line block', () => {
        const lines = ['Table', '| take 10'];
        const result = getQueryToRun(
            () => ({ isEmpty: () => true, startLineNumber: 1, endLineNumber: 1 }),
            () => '',
            () => ({ lineNumber: 2 }),
            () => lines.length,
            (line: number) => lines[line - 1],
        );
        expect(result?.range).toEqual({ startLine: 1, endLine: 2 });
    });

    it('handles null selection', () => {
        const lines = ['Table'];
        const result = getQueryToRun(
            () => null,
            () => '',
            () => ({ lineNumber: 1 }),
            () => 1,
            (line: number) => lines[line - 1],
        );
        expect(result?.query).toBe('Table');
    });

    it('defaults to line 1 when getPosition returns null', () => {
        const lines = ['Table', '| take 10', '', 'Other'];
        const result = getQueryToRun(
            () => ({ isEmpty: () => true, startLineNumber: 1, endLineNumber: 1 }),
            () => '',
            () => null,
            () => lines.length,
            (line: number) => lines[line - 1],
        );
        expect(result?.query).toContain('Table');
    });

    it('isolates blocks separated by blank lines', () => {
        const lines = ['Block1', '', 'Block2', '| take 5'];
        const result = getQueryToRun(
            () => ({ isEmpty: () => true, startLineNumber: 1, endLineNumber: 1 }),
            () => '',
            () => ({ lineNumber: 3 }),
            () => lines.length,
            (line: number) => lines[line - 1],
        );
        expect(result?.query).toBe('Block2\n| take 5');
        expect(result?.range).toEqual({ startLine: 3, endLine: 4 });
    });
});

// ---------------------------------------------------------------------------
// getQueryToRunFromEditor
// ---------------------------------------------------------------------------

describe('getQueryToRunFromEditor', () => {
    it('returns null when model is null', () => {
        const ed = {
            getSelection: () => null,
            getModel: () => null,
            getPosition: () => ({ lineNumber: 1 }),
        };
        expect(getQueryToRunFromEditor(ed)).toBeNull();
    });

    it('delegates to getQueryToRun with model accessors', () => {
        const lines = ['Table', '| take 10'];
        const ed = {
            getSelection: () => ({ isEmpty: () => true, startLineNumber: 1, endLineNumber: 1 }),
            getModel: () => ({
                getValueInRange: () => '',
                getLineCount: () => lines.length,
                getLineContent: (line: number) => lines[line - 1],
            }),
            getPosition: () => ({ lineNumber: 1 }),
        };
        const result = getQueryToRunFromEditor(ed);
        expect(result).not.toBeNull();
        expect(result?.query).toContain('Table');
        expect(result?.query).toContain('| take 10');
    });

    it('uses selection when non-empty', () => {
        const ed = {
            getSelection: () => ({ isEmpty: () => false, startLineNumber: 1, endLineNumber: 1 }),
            getModel: () => ({
                getValueInRange: () => 'selected text',
                getLineCount: () => 1,
                getLineContent: () => 'Table',
            }),
            getPosition: () => ({ lineNumber: 1 }),
        };
        const result = getQueryToRunFromEditor(ed);
        expect(result?.query).toBe('selected text');
    });
});

// ---------------------------------------------------------------------------
// downloadFile, exportCsv, exportJson
// ---------------------------------------------------------------------------

describe('downloadFile', () => {
    let clickSpy: ReturnType<typeof vi.fn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
    let createObjectURLSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        clickSpy = vi.fn();
        revokeObjectURLSpy = vi.fn();
        createObjectURLSpy = vi.fn(() => 'blob:mock-url');

        vi.stubGlobal('URL', {
            createObjectURL: createObjectURLSpy,
            revokeObjectURL: revokeObjectURLSpy,
        });

        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: clickSpy,
        } as unknown as HTMLAnchorElement);
    });

    it('creates a blob, triggers download, and revokes URL', () => {
        downloadFile('content', 'file.txt', 'text/plain');
        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });
});

describe('exportCsv', () => {
    let clickSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        clickSpy = vi.fn();
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock-url'),
            revokeObjectURL: vi.fn(),
        });
        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: clickSpy,
        } as unknown as HTMLAnchorElement);
    });

    it('generates CSV and triggers download', () => {
        const cols = ['Name', 'Age'];
        const rows = [
            { Name: 'Alice', Age: 30 },
            { Name: 'Bob', Age: 25 },
        ];
        exportCsv(cols, rows);
        expect(clickSpy).toHaveBeenCalled();
    });

    it('escapes CSV values with commas and quotes', () => {
        const cols = ['Name'];
        const rows = [{ Name: 'O"Brien, Jr.' }];
        exportCsv(cols, rows);
        expect(clickSpy).toHaveBeenCalled();
    });
});

describe('exportJson', () => {
    let clickSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        clickSpy = vi.fn();
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock-url'),
            revokeObjectURL: vi.fn(),
        });
        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: clickSpy,
        } as unknown as HTMLAnchorElement);
    });

    it('generates JSON and triggers download', () => {
        const rows = [{ Name: 'Alice' }];
        exportJson(['Name'], rows);
        expect(clickSpy).toHaveBeenCalled();
    });
});

describe('loadConnections', () => {
    const defaultClusters = [{ ...DEFAULT_CONNECTION }];

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockConnStore.clear();
    });

    it('returns default connection when store is empty', () => {
        const conns = loadConnections(defaultClusters);
        expect(conns.length).toBeGreaterThanOrEqual(1);
        expect(conns[0].id).toBe(DEFAULT_CONNECTION.id);
    });

    it('returns stored connections from stateService', () => {
        const stored = [{ id: 'c1', name: 'C1', clusterUrl: 'https://c1.kusto.windows.net', database: 'DB1', color: '#aaa' }];
        mockConnStore.set('list', stored);
        const conns = loadConnections(defaultClusters);
        expect(conns.length).toBeGreaterThanOrEqual(1);
        expect(conns[0].id).toBe('c1');
    });

    it('returns default connection when store has empty array', () => {
        mockConnStore.set('list', []);
        const conns = loadConnections(defaultClusters);
        expect(conns.length).toBeGreaterThanOrEqual(1);
        expect(conns[0].id).toBe(DEFAULT_CONNECTION.id);
    });
});

describe('saveConnections', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockConnStore.clear();
    });

    it('saves connections to stateService', () => {
        const conns = [{ id: 'c1', name: 'C1', clusterUrl: 'https://c1.kusto.windows.net', database: 'DB1', color: '#aaa' }];
        saveConnections(conns);
        expect(mockConnStore.get('list')).toEqual(conns);
    });
});

describe('loadActiveConnectionId', () => {
    const connections = [
        { id: 'c1', name: 'C1', clusterUrl: 'https://c1.kusto.windows.net', database: 'DB1', color: '#aaa' },
        { id: 'c2', name: 'C2', clusterUrl: 'https://c2.kusto.windows.net', database: 'DB2', color: '#bbb' },
    ];

    beforeEach(() => {
        mockConnStore.clear();
    });

    it('returns the stored active connection when it exists', () => {
        mockConnStore.set('explorer-active-connection', 'c2');
        expect(loadActiveConnectionId(connections)).toBe('c2');
    });

    it('falls back to the first connection when the stored connection is missing', () => {
        mockConnStore.set('explorer-active-connection', 'missing');
        expect(loadActiveConnectionId(connections)).toBe('c1');
    });
});

describe('saveActiveConnectionId', () => {
    beforeEach(() => {
        mockConnStore.clear();
    });

    it('persists the active connection id', () => {
        saveActiveConnectionId('c2');
        expect(mockConnStore.get('explorer-active-connection')).toBe('c2');
    });
});

describe('shortenClusterUrl', () => {
    it('removes https:// prefix and .kusto.windows.net suffix', () => {
        expect(shortenClusterUrl('https://mycluster.kusto.windows.net')).toBe('mycluster');
    });

    it('removes http:// prefix', () => {
        expect(shortenClusterUrl('http://mycluster.kusto.windows.net')).toBe('mycluster');
    });

    it('handles URL without kusto suffix', () => {
        expect(shortenClusterUrl('https://example.com')).toBe('example.com');
    });
});

describe('CONNECTION_COLORS', () => {
    it('exports an array of color strings', () => {
        expect(Array.isArray(CONNECTION_COLORS)).toBe(true);
        expect(CONNECTION_COLORS.length).toBeGreaterThan(0);
        expect(CONNECTION_COLORS[0]).toMatch(/^#/);
    });
});

describe('parseResultColumns', () => {
    it('extracts column names and types', () => {
        const cols = [
            { ColumnName: 'Id', ColumnType: 'int' },
            { ColumnName: 'Name', ColumnType: 'string' },
        ];
        const result = parseResultColumns(cols);
        expect(result.columns).toEqual(['Id', 'Name']);
        expect(result.columnTypes).toEqual({ Id: 'int', Name: 'string' });
    });

    it('handles empty columns', () => {
        const result = parseResultColumns([]);
        expect(result.columns).toEqual([]);
        expect(result.columnTypes).toEqual({});
    });
});

describe('buildSuccessEntry', () => {
    it('creates a success history entry', () => {
        const entry = buildSuccessEntry('test query', 'key1', 42, ['A'], [{ A: 1 }]);
        expect(entry.key).toBe('key1');
        expect(entry.query).toBe('test query');
        expect(entry.elapsed).toBe(42);
        expect(entry.rowCount).toBe(1);
        expect(entry.columnCount).toBe(1);
        expect(entry.status).toBe('success');
        expect(entry.columns).toEqual(['A']);
        expect(entry.rows).toEqual([{ A: 1 }]);
    });
});

describe('buildErrorEntry', () => {
    it('creates an error history entry', () => {
        const entry = buildErrorEntry('bad query', 'key2', 'Syntax error');
        expect(entry.key).toBe('key2');
        expect(entry.status).toBe('error');
        expect(entry.error).toBe('Syntax error');
        expect(entry.elapsed).toBeNull();
        expect(entry.rowCount).toBeNull();
    });
});
