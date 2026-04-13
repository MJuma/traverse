/**
 * Pure functions and types for the Explorer page.
 * No React dependencies — fully unit-testable.
 */

// Re-export config items that other files import from here
export type { KustoConnection, WellKnownCluster } from '../../config';
export { CONNECTION_COLORS, DEFAULT_CONNECTION, buildWellKnownClusters, DEFAULT_QUERY, KEYBOARD_SHORTCUTS } from '../../config';

import type { KustoConnection } from '../../config';
import { DEFAULT_CONNECTION } from '../../config';
import { stateService } from '../../services/state-service';

export interface QueryTab {
    id: string;
    title: string;
    kql: string;
    connectionId: string;
}

export function loadConnections(defaultClusters: KustoConnection[]): KustoConnection[] {
    const stored = stateService.get<KustoConnection[]>('explorerConnections', 'list');
    if (stored && Array.isArray(stored) && stored.length > 0) {
        return stored;
    }
    return defaultClusters;
}

export function saveConnections(connections: KustoConnection[]): void {
    stateService.set('explorerConnections', 'list', connections);
}

const EXPLORER_ACTIVE_CONNECTION_KEY = 'explorer-active-connection';

export function loadActiveConnectionId(connections: KustoConnection[]): string {
    const stored = stateService.get<string>('config', EXPLORER_ACTIVE_CONNECTION_KEY);
    if (stored && connections.some((connection) => connection.id === stored)) {
        return stored;
    }
    return connections[0]?.id ?? DEFAULT_CONNECTION.id;
}

export function saveActiveConnectionId(connectionId: string): void {
    stateService.set('config', EXPLORER_ACTIVE_CONNECTION_KEY, connectionId);
}

// --- Pure functions ---

let tabCounter = 1;
export function createTab(kql = '', title?: string, connectionId = ''): QueryTab {
    const id = `tab-${tabCounter++}`;
    return { id, title: title ?? `Query ${tabCounter - 1}`, kql, connectionId };
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) {
        return '0 B';
    }
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function escapeCsvValue(v: string) {
    return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
}

export function exportCsv(cols: string[], rows: Record<string, unknown>[]): void {
    const csv = [cols.map(escapeCsvValue).join(','), ...rows.map((r) => cols.map((c) => escapeCsvValue(String((r[c] ?? '') as string | number))).join(','))].join('\n');
    downloadFile(csv, `query-results-${Date.now()}.csv`, 'text/csv');
}

export function exportJson(_cols: string[], rows: Record<string, unknown>[]): void {
    downloadFile(JSON.stringify(rows, null, 2), `query-results-${Date.now()}.json`, 'application/json');
}

/**
 * Format a KQL query: newline before each `|`, indent continuation lines,
 * normalize whitespace, and preserve `let` statements and comments.
 */
export function formatKql(kql: string): string {
    const statements = kql.split(/\n\s*\n/);
    return statements.map((stmt) => {
        const trimmed = stmt.trim();
        if (!trimmed) {
            return '';
        }
        const flat = trimmed.split('\n').map((l) => l.trim()).join(' ');
        const parts: string[] = [];
        let current = '';
        let inSingle = false;
        let inDouble = false;
        for (const ch of flat) {
            if (ch === "'" && !inDouble) {
                inSingle = !inSingle;
            }
            else if (ch === '"' && !inSingle) {
                inDouble = !inDouble;
            }
            else if (ch === '|' && !inSingle && !inDouble) {
                parts.push(current.trim());
                current = '';
                continue;
            }
            current += ch;
        }
        if (current.trim()) {
            parts.push(current.trim());
        }

        if (parts.length <= 1) {
            return trimmed;
        }
        return parts[0] + '\n' + parts.slice(1).map((p) => '| ' + p).join('\n');
    }).join('\n\n');
}

// --- Query result helpers (pure, testable without React) ---

export interface KustoColumnDef {
    ColumnName: string;
    ColumnType: string;
}

/** Parse Kusto result columns into column names and type maps. */
export function parseResultColumns(kustoColumns: KustoColumnDef[]): { columns: string[]; columnTypes: Record<string, string> } {
    const columns = kustoColumns.map((c) => c.ColumnName);
    const columnTypes: Record<string, string> = {};
    kustoColumns.forEach((c) => { columnTypes[c.ColumnName] = c.ColumnType; });
    return { columns, columnTypes };
}

/** Build a success history entry from query results. */
export function buildSuccessEntry(query: string, normalizedKey: string, elapsed: number, columns: string[], rows: Record<string, unknown>[]) {
    return {
        key: normalizedKey,
        query,
        timestamp: Date.now(),
        elapsed,
        rowCount: rows.length,
        columnCount: columns.length,
        status: 'success' as const,
        columns,
        rows,
    };
}

/** Build an error history entry. */
export function buildErrorEntry(query: string, normalizedKey: string, errorMsg: string) {
    return {
        key: normalizedKey,
        query,
        timestamp: Date.now(),
        elapsed: null,
        rowCount: null,
        columnCount: 0,
        status: 'error' as const,
        error: errorMsg,
    };
}

export function shortenClusterUrl(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/\.kusto\.windows\.net$/, '');
}

// --- Query detection ---

export interface QueryRange {
    query: string;
    range: { startLine: number; endLine: number };
}

/**
 * Given a Monaco editor model and cursor position, returns the query text to
 * execute: selected text if any, otherwise the "current statement" — the
 * contiguous block of non-blank lines around the cursor, matching ADX behavior.
 */
export function getQueryToRun(
    getSelection: () => { isEmpty: () => boolean; startLineNumber: number; endLineNumber: number } | null,
    getValueInRange: (sel: { startLineNumber: number; endLineNumber: number }) => string,
    getPosition: () => { lineNumber: number } | null,
    getLineCount: () => number,
    getLineContent: (line: number) => string,
): QueryRange | null {
    const selection = getSelection();

    // If there's a non-empty selection, use that
    if (selection && !selection.isEmpty()) {
        const text = getValueInRange(selection).trim();
        if (text) {
            return {
                query: text,
                range: { startLine: selection.startLineNumber, endLine: selection.endLineNumber },
            };
        }
    }

    // Otherwise find the current statement block around the cursor
    const cursorLine = getPosition()?.lineNumber ?? 1;
    const totalLines = getLineCount();

    let startLine = cursorLine;
    while (startLine > 1 && getLineContent(startLine - 1).trim() !== '') {
        startLine--;
    }

    let endLine = cursorLine;
    while (endLine < totalLines && getLineContent(endLine + 1).trim() !== '') {
        endLine++;
    }

    const lines: string[] = [];
    for (let i = startLine; i <= endLine; i++) {
        lines.push(getLineContent(i));
    }
    const text = lines.join('\n').trim();
    if (!text) {
        return null;
    }

    return { query: text, range: { startLine, endLine } };
}

/**
 * Helper to extract QueryRange from a Monaco editor instance.
 * Wraps getQueryToRun with Monaco-specific accessors.
 */
export function getQueryToRunFromEditor(
    ed: { getSelection: () => unknown; getModel: () => unknown; getPosition: () => unknown },
): QueryRange | null {
    const model = ed.getModel() as {
        getValueInRange: (sel: unknown) => string;
        getLineCount: () => number;
        getLineContent: (line: number) => string;
    } | null;
    if (!model) {
        return null;
    }

    const selection = ed.getSelection() as { isEmpty: () => boolean; startLineNumber: number; endLineNumber: number } | null;

    return getQueryToRun(
        () => selection,
        (sel) => model.getValueInRange(sel),
        () => ed.getPosition() as { lineNumber: number } | null,
        () => model.getLineCount(),
        (line) => model.getLineContent(line),
    );
}
