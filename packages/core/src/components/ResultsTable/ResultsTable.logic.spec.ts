import { describe, it, expect } from 'vitest';
import {
    isCellInRange,
    serializeCellValue,
    formatCellDisplayValue,
    buildSelectionTsv,
    parseHighlightExpr,
    matchesHighlight,
    computeAggregates,
    computeDateDelta,
    shortType,
    computeColumnWidths,
    sortRows,
    filterRows,
    findEmptyColumns,
} from './ResultsTable.logic';
import type { CellRange, HighlightExpr } from './ResultsTable.logic';

// ---------------------------------------------------------------------------
// isCellInRange
// ---------------------------------------------------------------------------

describe('serializeCellValue', () => {
    it('serializes dynamic objects as JSON', () => {
        expect(serializeCellValue({ foo: 'bar', count: 2 })).toBe('{"foo":"bar","count":2}');
    });

    it('serializes numbers without locale formatting', () => {
        expect(serializeCellValue(1234)).toBe('1234');
    });
});

describe('formatCellDisplayValue', () => {
    it('formats numbers for display', () => {
        expect(formatCellDisplayValue(1234)).toBe('1,234');
    });

    it('formats dynamic arrays for display', () => {
        expect(formatCellDisplayValue(['a', 'b'])).toBe('["a","b"]');
    });
});

describe('isCellInRange', () => {
    const range: CellRange = { startRow: 2, startCol: 3, endRow: 5, endCol: 6 };

    it('returns true for cell inside range', () => {
        expect(isCellInRange(3, 4, range)).toBe(true);
    });

    it('returns true for cell on boundary', () => {
        expect(isCellInRange(2, 3, range)).toBe(true);
        expect(isCellInRange(5, 6, range)).toBe(true);
        expect(isCellInRange(2, 6, range)).toBe(true);
        expect(isCellInRange(5, 3, range)).toBe(true);
    });

    it('returns false for cell outside range', () => {
        expect(isCellInRange(1, 3, range)).toBe(false);
        expect(isCellInRange(6, 3, range)).toBe(false);
        expect(isCellInRange(3, 2, range)).toBe(false);
        expect(isCellInRange(3, 7, range)).toBe(false);
    });

    it('handles inverted range (start > end)', () => {
        const inverted: CellRange = { startRow: 5, startCol: 6, endRow: 2, endCol: 3 };
        expect(isCellInRange(3, 4, inverted)).toBe(true);
        expect(isCellInRange(1, 1, inverted)).toBe(false);
    });
});

describe('buildSelectionTsv', () => {
    it('builds a TSV payload for a rectangular selection', () => {
        const rows = [
            { Name: 'Alice', Meta: { team: 'A' } },
            { Name: 'Bob', Meta: { team: 'B' } },
        ];
        const result = buildSelectionTsv(rows, ['Name', 'Meta'], { startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
        expect(result).toBe('Alice\t{"team":"A"}\nBob\t{"team":"B"}');
    });

    it('returns empty text for an empty selection source', () => {
        expect(buildSelectionTsv([], ['Name'], { startRow: 0, startCol: 0, endRow: 0, endCol: 0 })).toBe('');
    });
});

// ---------------------------------------------------------------------------
// parseHighlightExpr
// ---------------------------------------------------------------------------

describe('parseHighlightExpr', () => {
    it('parses == expression', () => {
        const result = parseHighlightExpr('Name == Alice');
        expect(result).toEqual({ column: 'Name', op: '==', value: 'Alice' });
    });

    it('parses != expression', () => {
        const result = parseHighlightExpr('Status != active');
        expect(result).toEqual({ column: 'Status', op: '!=', value: 'active' });
    });

    it('parses > expression', () => {
        const result = parseHighlightExpr('Age > 30');
        expect(result).toEqual({ column: 'Age', op: '>', value: '30' });
    });

    it('parses < expression', () => {
        const result = parseHighlightExpr('Age < 30');
        expect(result).toEqual({ column: 'Age', op: '<', value: '30' });
    });

    it('parses >= expression', () => {
        const result = parseHighlightExpr('Score >= 90');
        expect(result).toEqual({ column: 'Score', op: '>=', value: '90' });
    });

    it('parses <= expression', () => {
        const result = parseHighlightExpr('Score <= 10');
        expect(result).toEqual({ column: 'Score', op: '<=', value: '10' });
    });

    it('parses contains expression', () => {
        const result = parseHighlightExpr('Name contains ali');
        expect(result).toEqual({ column: 'Name', op: 'contains', value: 'ali' });
    });

    it('parses !contains expression', () => {
        const result = parseHighlightExpr('Name !contains bob');
        expect(result).toEqual({ column: 'Name', op: '!contains', value: 'bob' });
    });

    it('strips quotes from value', () => {
        const result = parseHighlightExpr("Name == 'Alice'");
        expect(result?.value).toBe('Alice');
    });

    it('strips double quotes from value', () => {
        const result = parseHighlightExpr('Name == "Alice"');
        expect(result?.value).toBe('Alice');
    });

    it('returns null for invalid expression', () => {
        expect(parseHighlightExpr('invalid')).toBeNull();
        expect(parseHighlightExpr('')).toBeNull();
        expect(parseHighlightExpr('Name =~ value')).toBeNull();
    });

    it('handles whitespace', () => {
        const result = parseHighlightExpr('  Name   ==   Alice  ');
        expect(result).toEqual({ column: 'Name', op: '==', value: 'Alice' });
    });

    it('is case-insensitive for operators', () => {
        const result = parseHighlightExpr('Name CONTAINS alice');
        expect(result?.op).toBe('contains');
    });
});

// ---------------------------------------------------------------------------
// matchesHighlight
// ---------------------------------------------------------------------------

describe('matchesHighlight', () => {
    it('matches == for exact string', () => {
        const expr: HighlightExpr = { column: 'Name', op: '==', value: 'Alice' };
        expect(matchesHighlight({ Name: 'Alice' }, expr)).toBe(true);
        expect(matchesHighlight({ Name: 'Bob' }, expr)).toBe(false);
    });

    it('matches == for numeric comparison', () => {
        const expr: HighlightExpr = { column: 'Age', op: '==', value: '30' };
        expect(matchesHighlight({ Age: 30 }, expr)).toBe(true);
        expect(matchesHighlight({ Age: 25 }, expr)).toBe(false);
    });

    it('matches != operator', () => {
        const expr: HighlightExpr = { column: 'Name', op: '!=', value: 'Alice' };
        expect(matchesHighlight({ Name: 'Bob' }, expr)).toBe(true);
        expect(matchesHighlight({ Name: 'Alice' }, expr)).toBe(false);
    });

    it('matches > operator', () => {
        const expr: HighlightExpr = { column: 'Age', op: '>', value: '30' };
        expect(matchesHighlight({ Age: 31 }, expr)).toBe(true);
        expect(matchesHighlight({ Age: 30 }, expr)).toBe(false);
        expect(matchesHighlight({ Age: 29 }, expr)).toBe(false);
    });

    it('matches < operator', () => {
        const expr: HighlightExpr = { column: 'Age', op: '<', value: '30' };
        expect(matchesHighlight({ Age: 29 }, expr)).toBe(true);
        expect(matchesHighlight({ Age: 30 }, expr)).toBe(false);
    });

    it('matches >= operator', () => {
        const expr: HighlightExpr = { column: 'Age', op: '>=', value: '30' };
        expect(matchesHighlight({ Age: 30 }, expr)).toBe(true);
        expect(matchesHighlight({ Age: 31 }, expr)).toBe(true);
        expect(matchesHighlight({ Age: 29 }, expr)).toBe(false);
    });

    it('matches <= operator', () => {
        const expr: HighlightExpr = { column: 'Age', op: '<=', value: '30' };
        expect(matchesHighlight({ Age: 30 }, expr)).toBe(true);
        expect(matchesHighlight({ Age: 29 }, expr)).toBe(true);
        expect(matchesHighlight({ Age: 31 }, expr)).toBe(false);
    });

    it('matches contains operator (case-insensitive)', () => {
        const expr: HighlightExpr = { column: 'Name', op: 'contains', value: 'ali' };
        expect(matchesHighlight({ Name: 'Alice' }, expr)).toBe(true);
        expect(matchesHighlight({ Name: 'BOB' }, expr)).toBe(false);
    });

    it('matches !contains operator', () => {
        const expr: HighlightExpr = { column: 'Name', op: '!contains', value: 'ali' };
        expect(matchesHighlight({ Name: 'Bob' }, expr)).toBe(true);
        expect(matchesHighlight({ Name: 'Alice' }, expr)).toBe(false);
    });

    it('handles null/undefined values', () => {
        const expr: HighlightExpr = { column: 'Name', op: '==', value: '' };
        expect(matchesHighlight({ Name: null }, expr)).toBe(true);
        expect(matchesHighlight({ Name: undefined }, expr)).toBe(true);
    });

    it('handles missing column in row', () => {
        const expr: HighlightExpr = { column: 'Missing', op: '==', value: '' };
        expect(matchesHighlight({}, expr)).toBe(true);
    });

    it('returns false for numeric comparison with non-numeric value', () => {
        const expr: HighlightExpr = { column: 'Name', op: '>', value: '30' };
        expect(matchesHighlight({ Name: 'Alice' }, expr)).toBe(false);
    });

    it('returns false for unknown operator', () => {
        const expr: HighlightExpr = { column: 'Name', op: 'like', value: 'A' };
        expect(matchesHighlight({ Name: 'Alice' }, expr)).toBe(false);
    });

    it('matches serialized dynamic values', () => {
        const expr: HighlightExpr = { column: 'Meta', op: 'contains', value: '"team":"A"' };
        expect(matchesHighlight({ Meta: { team: 'A' } }, expr)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// computeAggregates
// ---------------------------------------------------------------------------

describe('computeAggregates', () => {
    it('returns empty object for empty array', () => {
        expect(computeAggregates([])).toEqual({});
    });

    it('computes aggregates for a single value', () => {
        const result = computeAggregates([42]);
        expect(result['Count']).toBe('1');
        expect(result['Sum']).toBeDefined();
        expect(result['Avg']).toBeDefined();
        expect(result['Min']).toBeDefined();
        expect(result['Max']).toBeDefined();
        expect(result['P50']).toBeDefined();
        expect(result['P75']).toBeDefined();
        expect(result['P90']).toBeDefined();
    });

    it('computes correct aggregates for multiple values', () => {
        const values = [10, 20, 30, 40, 50];
        const result = computeAggregates(values);
        expect(result['Count']).toBe('5');
        // Sum = 150
        expect(result['Sum']).toContain('150');
        // Min/Max
        expect(result['Min']).toContain('10');
        expect(result['Max']).toContain('50');
    });

    it('computes percentiles correctly', () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const result = computeAggregates(values);
        expect(result['P50']).toBeDefined();
        expect(result['P75']).toBeDefined();
        expect(result['P90']).toBeDefined();
    });

    it('handles non-integer values in formatting', () => {
        const values = [1.5, 2.5];
        const result = computeAggregates(values);
        expect(result['Avg']).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// computeDateDelta
// ---------------------------------------------------------------------------

describe('computeDateDelta', () => {
    it('returns null for less than 2 values', () => {
        expect(computeDateDelta([])).toBeNull();
        expect(computeDateDelta(['2024-01-01'])).toBeNull();
    });

    it('returns ms for very small deltas', () => {
        const result = computeDateDelta([
            '2024-01-01T00:00:00.000Z',
            '2024-01-01T00:00:00.500Z',
        ]);
        expect(result).toBe('500ms');
    });

    it('returns seconds for delta < 60s', () => {
        const result = computeDateDelta([
            '2024-01-01T00:00:00Z',
            '2024-01-01T00:00:30Z',
        ]);
        expect(result).toBe('30.0s');
    });

    it('returns minutes for delta < 1h', () => {
        const result = computeDateDelta([
            '2024-01-01T00:00:00Z',
            '2024-01-01T00:05:00Z',
        ]);
        expect(result).toBe('5.0m');
    });

    it('returns hours for delta < 1d', () => {
        const result = computeDateDelta([
            '2024-01-01T00:00:00Z',
            '2024-01-01T03:00:00Z',
        ]);
        expect(result).toBe('3.0h');
    });

    it('returns days for delta >= 1d', () => {
        const result = computeDateDelta([
            '2024-01-01T00:00:00Z',
            '2024-01-03T00:00:00Z',
        ]);
        expect(result).toBe('2.0d');
    });

    it('returns null for invalid dates', () => {
        expect(computeDateDelta(['not-a-date', 'also-not'])).toBeNull();
    });

    it('handles mixed valid and invalid dates', () => {
        const result = computeDateDelta([
            '2024-01-01T00:00:00Z',
            'invalid',
            '2024-01-01T00:00:01Z',
        ]);
        expect(result).toBe('1.0s');
    });
});

// ---------------------------------------------------------------------------
// shortType
// ---------------------------------------------------------------------------

describe('shortType', () => {
    it('maps System.String to string', () => {
        expect(shortType('System.String')).toBe('string');
    });

    it('maps System.Int64 to long', () => {
        expect(shortType('System.Int64')).toBe('long');
    });

    it('maps System.Int32 to int', () => {
        expect(shortType('System.Int32')).toBe('int');
    });

    it('maps System.Double to real', () => {
        expect(shortType('System.Double')).toBe('real');
    });

    it('maps System.Single to real', () => {
        expect(shortType('System.Single')).toBe('real');
    });

    it('maps System.Boolean to bool', () => {
        expect(shortType('System.Boolean')).toBe('bool');
    });

    it('maps System.DateTime to datetime', () => {
        expect(shortType('System.DateTime')).toBe('datetime');
    });

    it('maps System.TimeSpan to timespan', () => {
        expect(shortType('System.TimeSpan')).toBe('timespan');
    });

    it('maps System.Guid to guid', () => {
        expect(shortType('System.Guid')).toBe('guid');
    });

    it('maps System.Object to dynamic', () => {
        expect(shortType('System.Object')).toBe('dynamic');
    });

    it('maps System.SByte to bool', () => {
        expect(shortType('System.SByte')).toBe('bool');
    });

    it('returns lowercase last segment for unknown System.* types', () => {
        expect(shortType('System.Decimal')).toBe('decimal');
    });

    it('returns non-System types unchanged', () => {
        expect(shortType('customtype')).toBe('customtype');
        expect(shortType('MyType')).toBe('MyType');
    });
});

// ---------------------------------------------------------------------------
// computeColumnWidths
// ---------------------------------------------------------------------------

describe('computeColumnWidths', () => {
    it('returns widths for basic columns', () => {
        const widths = computeColumnWidths(['Name', 'Age'], [{ Name: 'Alice', Age: 30 }]);
        expect(widths).toHaveLength(2);
        widths.forEach((w) => {
            expect(w).toBeGreaterThanOrEqual(60);
            expect(w).toBeLessThanOrEqual(500);
        });
    });

    it('accounts for column types in header length', () => {
        const withTypes = computeColumnWidths(
            ['Name'],
            [{ Name: 'A' }],
            { Name: 'System.String' },
        );
        const withoutTypes = computeColumnWidths(['Name'], [{ Name: 'A' }]);
        expect(withTypes[0]).toBeGreaterThanOrEqual(withoutTypes[0]);
    });

    it('handles empty rows', () => {
        const widths = computeColumnWidths(['Col'], []);
        expect(widths).toHaveLength(1);
        expect(widths[0]).toBeGreaterThanOrEqual(60);
    });

    it('caps wide values at 500', () => {
        const longValue = 'x'.repeat(200);
        const widths = computeColumnWidths(['Col'], [{ Col: longValue }]);
        expect(widths[0]).toBeLessThanOrEqual(500);
    });

    it('ensures minimum width of 60', () => {
        const widths = computeColumnWidths(['A'], [{ A: '' }]);
        expect(widths[0]).toBeGreaterThanOrEqual(60);
    });

    it('handles null/undefined values in rows', () => {
        const widths = computeColumnWidths(['Col'], [{ Col: null }, { Col: undefined }]);
        expect(widths).toHaveLength(1);
        expect(widths[0]).toBeGreaterThanOrEqual(60);
    });

    it('samples only first 100 rows', () => {
        const rows = Array.from({ length: 200 }, (_, i) => ({ Col: String(i) }));
        const widths = computeColumnWidths(['Col'], rows);
        expect(widths).toHaveLength(1);
    });

    it('accounts for serialized dynamic values', () => {
        const widths = computeColumnWidths(['Meta'], [{ Meta: { team: 'alpha', enabled: true } }]);
        expect(widths[0]).toBeGreaterThan(60);
    });
});

// ---------------------------------------------------------------------------
// sortRows
// ---------------------------------------------------------------------------

describe('sortRows', () => {
    const rows = [
        { Name: 'Charlie', Age: 30 },
        { Name: 'Alice', Age: 25 },
        { Name: 'Bob', Age: 35 },
    ];

    it('sorts ascending by numeric column', () => {
        const sorted = sortRows(rows, 'Age', 'asc');
        expect(sorted.map((r) => r['Age'])).toEqual([25, 30, 35]);
    });

    it('sorts descending by numeric column', () => {
        const sorted = sortRows(rows, 'Age', 'desc');
        expect(sorted.map((r) => r['Age'])).toEqual([35, 30, 25]);
    });

    it('sorts ascending by string column', () => {
        const sorted = sortRows(rows, 'Name', 'asc');
        expect(sorted.map((r) => r['Name'])).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('sorts descending by string column', () => {
        const sorted = sortRows(rows, 'Name', 'desc');
        expect(sorted.map((r) => r['Name'])).toEqual(['Charlie', 'Bob', 'Alice']);
    });

    it('handles null values in ascending sort', () => {
        const withNull = [{ Val: null }, { Val: 10 }, { Val: 5 }];
        const sorted = sortRows(withNull, 'Val', 'asc');
        expect(sorted[0]['Val']).toBeNull();
    });

    it('handles null values in descending sort', () => {
        const withNull = [{ Val: null }, { Val: 10 }, { Val: 5 }];
        const sorted = sortRows(withNull, 'Val', 'desc');
        expect(sorted[sorted.length - 1]['Val']).toBeNull();
    });

    it('handles undefined values', () => {
        const withUndef = [{ Val: undefined }, { Val: 10 }];
        const sorted = sortRows(withUndef, 'Val', 'asc');
        expect(sorted[0]['Val']).toBeUndefined();
    });

    it('returns rows unchanged when sortColumn is null', () => {
        const sorted = sortRows(rows, null, 'asc');
        expect(sorted).toBe(rows);
    });

    it('returns rows unchanged when sortDir is null', () => {
        const sorted = sortRows(rows, 'Name', null);
        expect(sorted).toBe(rows);
    });

    it('does not mutate original array', () => {
        const original = [...rows];
        sortRows(rows, 'Age', 'asc');
        expect(rows).toEqual(original);
    });
});

// ---------------------------------------------------------------------------
// filterRows
// ---------------------------------------------------------------------------

describe('filterRows', () => {
    const columns = ['Name', 'City'];
    const rows = [
        { Name: 'Alice', City: 'Seattle' },
        { Name: 'Bob', City: 'Portland' },
        { Name: 'Charlie', City: 'Seattle' },
    ];

    it('returns all rows when no filters', () => {
        const result = filterRows(rows, columns, '', {});
        expect(result).toEqual(rows);
    });

    it('filters by global search (case-insensitive)', () => {
        const result = filterRows(rows, columns, 'alice', {});
        expect(result).toHaveLength(1);
        expect(result[0]['Name']).toBe('Alice');
    });

    it('filters by column filter', () => {
        const result = filterRows(rows, columns, '', { City: 'seattle' });
        expect(result).toHaveLength(2);
    });

    it('combines global and column filters', () => {
        const result = filterRows(rows, columns, 'seattle', { Name: 'alice' });
        expect(result).toHaveLength(1);
    });

    it('skips empty column filter values', () => {
        const result = filterRows(rows, columns, '', { City: '' });
        expect(result).toEqual(rows);
    });

    it('handles null/undefined values in rows', () => {
        const withNull = [{ Name: null, City: 'Seattle' }, { Name: 'Bob', City: undefined }];
        const result = filterRows(withNull, columns, 'seattle', {});
        expect(result).toHaveLength(1);
    });

    it('is case-insensitive for column filters', () => {
        const result = filterRows(rows, columns, '', { Name: 'ALICE' });
        expect(result).toHaveLength(1);
    });

    it('global search matches any column', () => {
        const result = filterRows(rows, columns, 'port', {});
        expect(result).toHaveLength(1);
        expect(result[0]['Name']).toBe('Bob');
    });

    it('filters serialized dynamic values', () => {
        const result = filterRows(
            [{ Meta: { team: 'Alpha' } }, { Meta: { team: 'Beta' } }],
            ['Meta'],
            'alpha',
            {},
        );
        expect(result).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// findEmptyColumns
// ---------------------------------------------------------------------------

describe('findEmptyColumns', () => {
    it('detects columns with all null values', () => {
        const rows = [{ A: null, B: 1 }, { A: null, B: 2 }];
        const result = findEmptyColumns(['A', 'B'], rows);
        expect(result.has('A')).toBe(true);
        expect(result.has('B')).toBe(false);
    });

    it('detects columns with all undefined values', () => {
        const rows = [{ A: undefined, B: 'x' }];
        const result = findEmptyColumns(['A', 'B'], rows);
        expect(result.has('A')).toBe(true);
    });

    it('detects columns with all empty string values', () => {
        const rows = [{ A: '', B: 'x' }, { A: '', B: 'y' }];
        const result = findEmptyColumns(['A', 'B'], rows);
        expect(result.has('A')).toBe(true);
    });

    it('detects mixed null/undefined/empty as empty', () => {
        const rows = [{ A: null }, { A: undefined }, { A: '' }];
        const result = findEmptyColumns(['A'], rows);
        expect(result.has('A')).toBe(true);
    });

    it('returns empty set when no columns are empty', () => {
        const rows = [{ A: 1, B: 'x' }];
        const result = findEmptyColumns(['A', 'B'], rows);
        expect(result.size).toBe(0);
    });

    it('treats 0 and false as non-empty', () => {
        const rows = [{ A: 0 }, { A: false }];
        const result = findEmptyColumns(['A'], rows as Record<string, unknown>[]);
        expect(result.has('A')).toBe(false);
    });

    it('handles empty rows array', () => {
        const result = findEmptyColumns(['A', 'B'], []);
        expect(result.has('A')).toBe(true);
        expect(result.has('B')).toBe(true);
    });
});
