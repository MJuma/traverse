import { describe, it, expect, vi, beforeEach } from 'vitest';

import { groupSchemaByKindAndFolder, filterSchemaBySearch, computeExpandAllState } from './SchemaSidebar.logic';
import type { SchemaGroup } from './SchemaSidebar.logic';
import type { SchemaTable } from '../../services/schema';

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

function makeTable(name: string, kind: SchemaTable['kind'], folder = '', columns: { name: string; type: string }[] = []): SchemaTable {
    return { name, kind, folder, description: '', columns };
}

// ---------------------------------------------------------------------------
// groupSchemaByKindAndFolder
// ---------------------------------------------------------------------------

describe('groupSchemaByKindAndFolder', () => {
    it('groups tables by kind', () => {
        const schema: SchemaTable[] = [
            makeTable('T1', 'table'),
            makeTable('F1', 'function'),
            makeTable('MV1', 'materializedView'),
        ];
        const groups = groupSchemaByKindAndFolder(schema);

        const labels = groups.map((g) => g.label);
        expect(labels).toContain('Tables');
        expect(labels).toContain('Functions');
        expect(labels).toContain('Materialized Views');
    });

    it('omits kinds with no items', () => {
        const schema: SchemaTable[] = [makeTable('T1', 'table')];
        const groups = groupSchemaByKindAndFolder(schema);

        expect(groups).toHaveLength(1);
        expect(groups[0].label).toBe('Tables');
    });

    it('groups items by folder within each kind', () => {
        const schema: SchemaTable[] = [
            makeTable('T1', 'table', 'FolderA'),
            makeTable('T2', 'table', 'FolderB'),
            makeTable('T3', 'table', 'FolderA'),
        ];
        const groups = groupSchemaByKindAndFolder(schema);
        const tableGroup = groups.find((g) => g.kind === 'table')!;

        expect(Object.keys(tableGroup.folders)).toHaveLength(2);
        expect(tableGroup.folders['FolderA']).toHaveLength(2);
        expect(tableGroup.folders['FolderB']).toHaveLength(1);
    });

    it('uses empty string key for items without a folder', () => {
        const schema: SchemaTable[] = [makeTable('T1', 'table', '')];
        const groups = groupSchemaByKindAndFolder(schema);
        const tableGroup = groups.find((g) => g.kind === 'table')!;

        expect(tableGroup.folders['']).toHaveLength(1);
    });

    it('returns empty array for empty schema', () => {
        expect(groupSchemaByKindAndFolder([])).toEqual([]);
    });

    it('handles external tables', () => {
        const schema: SchemaTable[] = [makeTable('ET1', 'externalTable', 'External')];
        const groups = groupSchemaByKindAndFolder(schema);

        expect(groups).toHaveLength(1);
        expect(groups[0].label).toBe('External Tables');
        expect(groups[0].kind).toBe('externalTable');
    });

    it('maintains kind order: Functions, MVs, Tables, External Tables', () => {
        const schema: SchemaTable[] = [
            makeTable('T1', 'table'),
            makeTable('ET1', 'externalTable'),
            makeTable('F1', 'function'),
            makeTable('MV1', 'materializedView'),
        ];
        const groups = groupSchemaByKindAndFolder(schema);
        const labels = groups.map((g) => g.label);

        expect(labels).toEqual(['Functions', 'Materialized Views', 'Tables', 'External Tables']);
    });

    it('handles mixed kinds in same folder', () => {
        const schema: SchemaTable[] = [
            makeTable('T1', 'table', 'SharedFolder'),
            makeTable('F1', 'function', 'SharedFolder'),
        ];
        const groups = groupSchemaByKindAndFolder(schema);

        // Each kind gets its own group even if folder names overlap
        expect(groups).toHaveLength(2);
        const tableGroup = groups.find((g) => g.kind === 'table')!;
        const funcGroup = groups.find((g) => g.kind === 'function')!;
        expect(tableGroup.folders['SharedFolder']).toHaveLength(1);
        expect(funcGroup.folders['SharedFolder']).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// filterSchemaBySearch
// ---------------------------------------------------------------------------

describe('filterSchemaBySearch', () => {
    const schema: SchemaTable[] = [
        makeTable('StormEvents', 'table', '', [
            { name: 'StartTime', type: 'datetime' },
            { name: 'EventType', type: 'string' },
        ]),
        makeTable('Heartbeat', 'table', '', [
            { name: 'Computer', type: 'string' },
        ]),
        makeTable('MyFunction', 'function'),
    ];

    it('returns null for empty query', () => {
        expect(filterSchemaBySearch(schema, '')).toBeNull();
    });

    it('returns null for whitespace-only query', () => {
        expect(filterSchemaBySearch(schema, '   ')).toBeNull();
    });

    it('matches by table name (case insensitive)', () => {
        const result = filterSchemaBySearch(schema, 'storm');
        expect(result).not.toBeNull();
        expect(result).toHaveLength(1);
        expect(result![0].name).toBe('StormEvents');
    });

    it('matches by column name (case insensitive)', () => {
        const result = filterSchemaBySearch(schema, 'computer');
        expect(result).not.toBeNull();
        expect(result).toHaveLength(1);
        expect(result![0].name).toBe('Heartbeat');
    });

    it('matches partial table name', () => {
        const result = filterSchemaBySearch(schema, 'heart');
        expect(result).not.toBeNull();
        expect(result).toHaveLength(1);
        expect(result![0].name).toBe('Heartbeat');
    });

    it('matches partial column name', () => {
        const result = filterSchemaBySearch(schema, 'event');
        expect(result).not.toBeNull();
        // Matches StormEvents (table name) and its EventType column
        expect(result!.some((t) => t.name === 'StormEvents')).toBe(true);
    });

    it('returns empty array for no matches', () => {
        const result = filterSchemaBySearch(schema, 'zzzzz');
        expect(result).not.toBeNull();
        expect(result).toHaveLength(0);
    });

    it('matches function names', () => {
        const result = filterSchemaBySearch(schema, 'myfunc');
        expect(result).not.toBeNull();
        expect(result).toHaveLength(1);
        expect(result![0].name).toBe('MyFunction');
    });
});

// ---------------------------------------------------------------------------
// computeExpandAllState
// ---------------------------------------------------------------------------

describe('computeExpandAllState', () => {
    it('returns all folder and table names', () => {
        const schema: SchemaTable[] = [
            makeTable('T1', 'table', 'FolderA'),
            makeTable('T2', 'table', 'FolderB'),
            makeTable('F1', 'function', ''),
        ];
        const groups: SchemaGroup[] = [
            { label: 'Functions', kind: 'function', folders: { '': [schema[2]] } },
            { label: 'Tables', kind: 'table', folders: { FolderA: [schema[0]], FolderB: [schema[1]] } },
        ];

        const { allFolders, allTables } = computeExpandAllState(groups, schema);

        expect(allFolders.has('Functions')).toBe(true);
        expect(allFolders.has('Tables')).toBe(true);
        expect(allFolders.has('Tables/FolderA')).toBe(true);
        expect(allFolders.has('Tables/FolderB')).toBe(true);
        expect(allTables.has('T1')).toBe(true);
        expect(allTables.has('T2')).toBe(true);
        expect(allTables.has('F1')).toBe(true);
    });

    it('does not include empty folder string as subfolder', () => {
        const schema: SchemaTable[] = [makeTable('T1', 'table', '')];
        const groups: SchemaGroup[] = [
            { label: 'Tables', kind: 'table', folders: { '': [schema[0]] } },
        ];

        const { allFolders } = computeExpandAllState(groups, schema);

        // 'Tables' should be present but 'Tables/' should not
        expect(allFolders.has('Tables')).toBe(true);
        expect(allFolders.has('Tables/')).toBe(false);
    });

    it('returns empty sets for empty input', () => {
        const { allFolders, allTables } = computeExpandAllState([], []);
        expect(allFolders.size).toBe(0);
        expect(allTables.size).toBe(0);
    });

    it('includes group labels as expandable folders', () => {
        const schema: SchemaTable[] = [
            makeTable('MV1', 'materializedView'),
        ];
        const groups: SchemaGroup[] = [
            { label: 'Materialized Views', kind: 'materializedView', folders: { '': [schema[0]] } },
        ];

        const { allFolders } = computeExpandAllState(groups, schema);
        expect(allFolders.has('Materialized Views')).toBe(true);
    });
});
