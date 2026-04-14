/**
 * Pure functions for the ResultsTable component.
 * No React dependencies — fully unit-testable.
 */

// --- Types ---

export type SortDir = 'asc' | 'desc' | null;

export interface CellRange {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
}

export interface HighlightExpr {
    column: string;
    op: string;
    value: string;
}

// --- Cell formatting ---

export function serializeCellValue(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    try {
        const serialized = JSON.stringify(value);
        return serialized === undefined ? String(value) : serialized;
    } catch {
        return String(value);
    }
}

export function formatCellDisplayValue(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toLocaleString();
    }
    return serializeCellValue(value);
}

// --- Cell selection ---

export function isCellInRange(row: number, col: number, range: CellRange): boolean {
    return row >= Math.min(range.startRow, range.endRow) && row <= Math.max(range.startRow, range.endRow)
        && col >= Math.min(range.startCol, range.endCol) && col <= Math.max(range.startCol, range.endCol);
}

export function buildSelectionTsv(rows: Record<string, unknown>[], columns: string[], selection: CellRange | null): string {
    if (!selection || rows.length === 0 || columns.length === 0) {
        return '';
    }
    const minRow = Math.max(0, Math.min(selection.startRow, selection.endRow));
    const maxRow = Math.min(rows.length - 1, Math.max(selection.startRow, selection.endRow));
    const minCol = Math.max(0, Math.min(selection.startCol, selection.endCol));
    const maxCol = Math.min(columns.length - 1, Math.max(selection.startCol, selection.endCol));

    const lines: string[] = [];
    for (let rowIdx = minRow; rowIdx <= maxRow; rowIdx++) {
        const row = rows[rowIdx];
        const cells: string[] = [];
        for (let colIdx = minCol; colIdx <= maxCol; colIdx++) {
            cells.push(serializeCellValue(row?.[columns[colIdx]]));
        }
        lines.push(cells.join('\t'));
    }
    return lines.join('\n');
}

// --- Highlight expression parsing ---

export function parseHighlightExpr(expr: string): HighlightExpr | null {
    const match = expr.match(/^\s*(\w+)\s*(==|!=|>=|<=|>|<|contains|!contains)\s*(.+?)\s*$/i);
    if (!match) {
        return null;
    }
    return { column: match[1], op: match[2].toLowerCase(), value: match[3].replace(/^["']|["']$/g, '') };
}

export function matchesHighlight(row: Record<string, unknown>, expr: HighlightExpr): boolean {
    const raw = row[expr.column];
    const strVal = serializeCellValue(raw);
    const numVal = Number(raw);
    const exprNum = Number(expr.value);
    switch (expr.op) {
        case '==': return strVal === expr.value || (!isNaN(numVal) && !isNaN(exprNum) && numVal === exprNum);
        case '!=': return strVal !== expr.value;
        case '>': return !isNaN(numVal) && !isNaN(exprNum) && numVal > exprNum;
        case '<': return !isNaN(numVal) && !isNaN(exprNum) && numVal < exprNum;
        case '>=': return !isNaN(numVal) && !isNaN(exprNum) && numVal >= exprNum;
        case '<=': return !isNaN(numVal) && !isNaN(exprNum) && numVal <= exprNum;
        case 'contains': return strVal.toLowerCase().includes(expr.value.toLowerCase());
        case '!contains': return !strVal.toLowerCase().includes(expr.value.toLowerCase());
        default: return false;
    }
}

// --- Selection aggregates ---

function fmt(n: number) {
    return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function computeAggregates(values: number[]): Record<string, string> {
    if (values.length === 0) {
        return {};
    }
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((s, v) => s + v, 0);
    const pct = (p: number) => {
        const idx = (p / 100) * (sorted.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    };
    return {
        Count: values.length.toLocaleString(),
        Sum: fmt(sum),
        Avg: fmt(sum / values.length),
        Min: fmt(sorted[0]),
        Max: fmt(sorted[sorted.length - 1]),
        P50: fmt(pct(50)),
        P75: fmt(pct(75)),
        P90: fmt(pct(90)),
    };
}

// --- Datetime delta ---

export function computeDateDelta(values: string[]): string | null {
    const dates = values.map((v) => new Date(v).getTime()).filter((t) => !isNaN(t));
    if (dates.length < 2) {
        return null;
    }
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const deltaMs = max - min;
    if (deltaMs < 1000) {
        return `${deltaMs}ms`;
    }
    if (deltaMs < 60000) {
        return `${(deltaMs / 1000).toFixed(1)}s`;
    }
    if (deltaMs < 3600000) {
        return `${(deltaMs / 60000).toFixed(1)}m`;
    }
    if (deltaMs < 86400000) {
        return `${(deltaMs / 3600000).toFixed(1)}h`;
    }
    return `${(deltaMs / 86400000).toFixed(1)}d`;
}

// --- Kusto type shortening ---

const KUSTO_TYPE_MAP: Record<string, string> = {
    'System.String': 'string',
    'System.Int64': 'long',
    'System.Int32': 'int',
    'System.Double': 'real',
    'System.Single': 'real',
    'System.Boolean': 'bool',
    'System.DateTime': 'datetime',
    'System.TimeSpan': 'timespan',
    'System.Guid': 'guid',
    'System.Object': 'dynamic',
    'System.SByte': 'bool',
};

export function shortType(t: string): string {
    if (t.startsWith('System.')) {
        return KUSTO_TYPE_MAP[t] ?? t.split('.').pop()?.toLowerCase() ?? t;
    }
    return t;
}

// --- Column width computation ---

export function computeColumnWidths(columns: string[], rows: Record<string, unknown>[], columnTypes?: Record<string, string>): number[] {
    return columns.map((col) => {
        const headerLen = col.length + (columnTypes?.[col] ? shortType(columnTypes[col]).length + 1 : 0);
        let maxLen = headerLen;
        const sampleSize = Math.min(rows.length, 100);
        for (let i = 0; i < sampleSize; i++) {
            const v = rows[i][col];
            const len = v === null || v === undefined ? 4 : formatCellDisplayValue(v).length;
            if (len > maxLen) {
                maxLen = len;
            }
        }
        return Math.min(Math.max(maxLen * 8 + 24, 60), 500);
    });
}

// --- Sorting ---

export function sortRows(rows: Record<string, unknown>[], sortColumn: string | null, sortDir: SortDir): Record<string, unknown>[] {
    if (!sortColumn || !sortDir) {
        return rows;
    }
    return [...rows].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        if (aVal === null || aVal === undefined) {
            return sortDir === 'asc' ? -1 : 1;
        }
        if (bVal === null || bVal === undefined) {
            return sortDir === 'asc' ? 1 : -1;
        }
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
        }
        const aStr = serializeCellValue(aVal);
        const bStr = serializeCellValue(bVal);
        return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
}

// --- Filtering ---

export function filterRows(rows: Record<string, unknown>[], columns: string[], globalSearch: string, columnFilters: Record<string, string>): Record<string, unknown>[] {
    let filtered = rows;
    if (globalSearch) {
        const lower = globalSearch.toLowerCase();
        filtered = filtered.filter((row) =>
            columns.some((col) => {
                const v = row[col];
                return v !== null && v !== undefined && serializeCellValue(v).toLowerCase().includes(lower);
            }),
        );
    }
    for (const [col, filter] of Object.entries(columnFilters)) {
        if (!filter) {
            continue;
        }
        const lower = filter.toLowerCase();
        filtered = filtered.filter((row) => {
            const v = row[col];
            return v !== null && v !== undefined && serializeCellValue(v).toLowerCase().includes(lower);
        });
    }
    return filtered;
}

// --- Empty column detection ---

export function findEmptyColumns(columns: string[], rows: Record<string, unknown>[]): Set<string> {
    const empty = new Set<string>();
    for (const col of columns) {
        if (rows.every((r) => { const v = r[col]; return v === null || v === undefined || v === ''; })) {
            empty.add(col);
        }
    }
    return empty;
}
