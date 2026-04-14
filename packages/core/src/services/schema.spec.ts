import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { parseSchema, loadSchema, reloadSchema, getSchema, getSchemaFolders, listDatabases, getPersistedDatabases, persistDatabases, KQL_FUNCTIONS, KQL_AGGREGATIONS, KQL_SCALAR_FUNCTIONS } from './schema';
import type { KustoSchemaDb } from './schema';
import type { KustoClient } from './kusto';

const mockStore = new Map<string, unknown>();
vi.mock('./state-service', () => ({
    stateService: {
        get: (_store: string, key: string) => mockStore.get(key) ?? null,
        set: (_store: string, key: string, value: unknown) => { mockStore.set(key, value); },
        delete: (_store: string, key: string) => { mockStore.delete(key); },
    },
}));

function createMockClient(mgmtResult?: { columns: { ColumnName: string; ColumnType?: string }[]; rows: Record<string, unknown>[] }): KustoClient {
    return {
        queryKusto: vi.fn(),
        queryKustoMgmt: vi.fn().mockResolvedValue(mgmtResult ?? { columns: [], rows: [] }),
        clearQueryCache: vi.fn(),
        getQueryCacheSize: vi.fn().mockReturnValue(0),
    };
}

beforeEach(() => {
    mockStore.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('parseSchema', () => {
    it('parses tables with folder, description, and columns', () => {
        const db: KustoSchemaDb = {
            Tables: {
                MyTable: {
                    Folder: 'Analytics',
                    DocString: 'A test table',
                    OrderedColumns: [
                        { Name: 'Id', CslType: 'long' },
                        { Name: 'Name', CslType: 'string' },
                    ],
                },
            },
        };

        const result = parseSchema(db);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            name: 'MyTable',
            folder: 'Analytics',
            description: 'A test table',
            columns: [
                { name: 'Id', type: 'long' },
                { name: 'Name', type: 'string' },
            ],
            kind: 'table',
        });
    });

    it('parses materialized views', () => {
        const db: KustoSchemaDb = {
            Tables: {},
            MaterializedViews: {
                MyView: {
                    Folder: 'Views',
                    DocString: 'A materialized view',
                    OrderedColumns: [
                        { Name: 'Ts', CslType: 'datetime' },
                    ],
                },
            },
        };

        const result = parseSchema(db);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            name: 'MyView',
            folder: 'Views',
            description: 'A materialized view',
            columns: [{ name: 'Ts', type: 'datetime' }],
            kind: 'materializedView',
        });
    });

    it('parses functions without columns', () => {
        const db: KustoSchemaDb = {
            Tables: {},
            Functions: {
                MyFunc: {
                    Folder: 'Helpers',
                    DocString: 'A function',
                },
            },
        };

        const result = parseSchema(db);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            name: 'MyFunc',
            folder: 'Helpers',
            description: 'A function',
            columns: [],
            kind: 'function',
        });
    });

    it('defaults folder to empty string for tables without Folder', () => {
        const db: KustoSchemaDb = {
            Tables: {
                NoFolder: {
                    DocString: 'No folder',
                    OrderedColumns: [],
                },
            },
        };

        const result = parseSchema(db);
        expect(result[0].folder).toBe('');
    });

    it('defaults folder to empty string for materialized views without Folder', () => {
        const db: KustoSchemaDb = {
            Tables: {},
            MaterializedViews: {
                NoFolder: {},
            },
        };

        const result = parseSchema(db);
        expect(result[0].folder).toBe('');
    });

    it('defaults folder to empty string for functions without Folder', () => {
        const db: KustoSchemaDb = {
            Tables: {},
            Functions: {
                NoFolder: {},
            },
        };

        const result = parseSchema(db);
        expect(result[0].folder).toBe('');
    });

    it('defaults description to empty string for tables', () => {
        const db: KustoSchemaDb = {
            Tables: {
                NoDoc: {},
            },
        };

        const result = parseSchema(db);
        expect(result[0].description).toBe('');
    });

    it('defaults description to "Materialized view" for MVs without DocString', () => {
        const db: KustoSchemaDb = {
            Tables: {},
            MaterializedViews: {
                NoDoc: {},
            },
        };

        const result = parseSchema(db);
        expect(result[0].description).toBe('Materialized view');
    });

    it('handles missing OrderedColumns', () => {
        const db: KustoSchemaDb = {
            Tables: {
                NoCols: { Folder: 'Test' },
            },
        };

        const result = parseSchema(db);
        expect(result[0].columns).toEqual([]);
    });

    it('sorts by folder first, then kind order, then name', () => {
        const db: KustoSchemaDb = {
            Tables: {
                BTable: { Folder: 'Alpha' },
                ATable: { Folder: 'Alpha' },
                ZTable: { Folder: 'Beta' },
            },
            MaterializedViews: {
                AlphaMV: { Folder: 'Alpha' },
            },
            Functions: {
                AlphaFunc: { Folder: 'Alpha' },
            },
        };

        const result = parseSchema(db);
        const names = result.map((t) => t.name);

        // Alpha folder items should come first, sorted by kind: function → MV → table
        expect(names.indexOf('AlphaFunc')).toBeLessThan(names.indexOf('AlphaMV'));
        expect(names.indexOf('AlphaMV')).toBeLessThan(names.indexOf('ATable'));
        expect(names.indexOf('ATable')).toBeLessThan(names.indexOf('BTable'));

        // Beta folder should come after Alpha
        expect(names.indexOf('BTable')).toBeLessThan(names.indexOf('ZTable'));
    });

    it('sorts lookup tables between MVs and regular tables', () => {
        const db: KustoSchemaDb = {
            Tables: {
                RegularTable: { Folder: 'Same' },
                LookupTable: { Folder: 'Lookup' },
            },
            MaterializedViews: {
                SameMV: { Folder: 'Lookup' },
            },
        };

        const result = parseSchema(db);
        const lookupItems = result.filter((t) => t.folder === 'Lookup');
        const lookupNames = lookupItems.map((t) => t.name);

        // Within the Lookup folder: MV → lookup table (kind order 1.5) 
        expect(lookupNames.indexOf('SameMV')).toBeLessThan(lookupNames.indexOf('LookupTable'));
    });

    it('handles empty database', () => {
        const db: KustoSchemaDb = {
            Tables: {},
        };

        const result = parseSchema(db);
        expect(result).toEqual([]);
    });

    it('handles database with all sections empty', () => {
        const db: KustoSchemaDb = {
            Tables: {},
            MaterializedViews: {},
            Functions: {},
        };

        const result = parseSchema(db);
        expect(result).toEqual([]);
    });

    it('alphabetizes items of the same kind in the same folder', () => {
        const db: KustoSchemaDb = {
            Tables: {
                Zebra: { Folder: 'Zoo' },
                Apple: { Folder: 'Zoo' },
                Mango: { Folder: 'Zoo' },
            },
        };

        const result = parseSchema(db);
        const names = result.map((t) => t.name);
        expect(names).toEqual(['Apple', 'Mango', 'Zebra']);
    });
});

describe('loadSchema', () => {
    it('loads schema from client.queryKustoMgmt and caches it', async () => {
        const mockDb: KustoSchemaDb = {
            Tables: {
                TestTable: {
                    Folder: 'Test',
                    DocString: 'A test',
                    OrderedColumns: [{ Name: 'Col1', CslType: 'string' }],
                },
            },
        };
        const client = createMockClient({
            rows: [{ DatabaseSchema: JSON.stringify({ Databases: { mydb: mockDb } }) }],
            columns: [],
        });

        await loadSchema(client);

        const schema = getSchema();
        expect(schema.length).toBeGreaterThan(0);
        expect(schema.find((t) => t.name === 'TestTable')).toBeDefined();
    });

    it('does not re-fetch if already cached', async () => {
        const mockDb: KustoSchemaDb = {
            Tables: {
                CachedTable: { Folder: 'Cache', OrderedColumns: [] },
            },
        };
        const client = createMockClient({
            rows: [{ DatabaseSchema: JSON.stringify({ Databases: { db: mockDb } }) }],
            columns: [],
        });

        // Force a fresh load first
        await reloadSchema(client);
        vi.mocked(client.queryKustoMgmt).mockClear();

        // Second load should be a no-op (cached)
        await loadSchema(client);

        expect(client.queryKustoMgmt).toHaveBeenCalledTimes(0);
    });

    it('handles empty result rows', async () => {
        const client = createMockClient({ rows: [], columns: [] });

        // Reset default schema cache first
        await reloadSchema(client);

        const schema = getSchema();
        expect(schema).toEqual([]);
    });
});

describe('reloadSchema', () => {
    it('clears cache and reloads', async () => {
        const mockDb: KustoSchemaDb = {
            Tables: {
                ReloadedTable: { Folder: 'Reload', OrderedColumns: [] },
            },
        };
        const client = createMockClient({
            rows: [{ DatabaseSchema: JSON.stringify({ Databases: { db: mockDb } }) }],
            columns: [],
        });

        await reloadSchema(client);

        const schema = getSchema();
        expect(schema.find((t) => t.name === 'ReloadedTable')).toBeDefined();
    });
});

describe('getSchema', () => {
    it('returns empty when no schema is loaded for default target', () => {
        // After previous tests may have loaded something, check non-default target
        const schema = getSchema({ clusterUrl: 'https://unknown.kusto.windows.net', database: 'UnknownDB' });
        expect(schema).toEqual([]);
    });
});

describe('getSchemaFolders', () => {
    it('returns folders from current schema', async () => {
        const mockDb: KustoSchemaDb = {
            Tables: {
                T1: { Folder: 'FolderA', OrderedColumns: [] },
                T2: { Folder: 'FolderB', OrderedColumns: [] },
            },
        };
        const client = createMockClient({
            rows: [{ DatabaseSchema: JSON.stringify({ Databases: { db: mockDb } }) }],
            columns: [],
        });
        await reloadSchema(client);

        const folders = getSchemaFolders();
        expect(Array.isArray(folders)).toBe(true);
        expect(folders).toContain('FolderA');
        expect(folders).toContain('FolderB');
    });
});

describe('KQL constants', () => {
    it('KQL_FUNCTIONS contains expected keywords', () => {
        expect(KQL_FUNCTIONS).toContain('where');
        expect(KQL_FUNCTIONS).toContain('project');
        expect(KQL_FUNCTIONS).toContain('summarize');
        expect(KQL_FUNCTIONS).toContain('join');
        expect(KQL_FUNCTIONS).toContain('union');
    });

    it('KQL_AGGREGATIONS contains expected functions', () => {
        expect(KQL_AGGREGATIONS).toContain('count');
        expect(KQL_AGGREGATIONS).toContain('sum');
        expect(KQL_AGGREGATIONS).toContain('avg');
        expect(KQL_AGGREGATIONS).toContain('dcount');
        expect(KQL_AGGREGATIONS).toContain('percentile');
    });

    it('KQL_SCALAR_FUNCTIONS contains expected functions', () => {
        expect(KQL_SCALAR_FUNCTIONS).toContain('ago');
        expect(KQL_SCALAR_FUNCTIONS).toContain('now');
        expect(KQL_SCALAR_FUNCTIONS).toContain('strlen');
        expect(KQL_SCALAR_FUNCTIONS).toContain('iif');
        expect(KQL_SCALAR_FUNCTIONS).toContain('parse_json');
    });
});

describe('per-cluster schema', () => {
    it('getSchema returns empty for unknown target', () => {
        const schema = getSchema({ clusterUrl: 'https://unknown.kusto.windows.net', database: 'UnknownDB' });
        expect(schema).toEqual([]);
    });

    it('getSchemaFolders returns empty for unknown target', () => {
        const folders = getSchemaFolders({ clusterUrl: 'https://unknown.kusto.windows.net', database: 'UnknownDB' });
        expect(folders).toEqual([]);
    });

    it('loadSchema passes target to client.queryKustoMgmt', async () => {
        const target = { clusterUrl: 'https://test.kusto.windows.net', database: 'TestDB' };
        const client = createMockClient({ rows: [], columns: [] });
        await loadSchema(client, target);
        expect(client.queryKustoMgmt).toHaveBeenCalledWith('.show database schema as json', target);
    });

    it('reloadSchema clears cache and reloads for target', async () => {
        const target = { clusterUrl: 'https://test2.kusto.windows.net', database: 'TestDB2' };
        const client = createMockClient({ rows: [], columns: [] });
        await reloadSchema(client, target);
        expect(client.queryKustoMgmt).toHaveBeenCalledWith('.show database schema as json', target);
    });
});

describe('listDatabases', () => {
    it('returns database names from .show databases query', async () => {
        const client = createMockClient({
            rows: [
                { DatabaseName: 'Telemetry' },
                { DatabaseName: 'Analytics' },
                { DatabaseName: 'Logs' },
            ],
            columns: [],
        });

        const result = await listDatabases(client, 'https://mycluster.kusto.windows.net');
        expect(result).toEqual(['Analytics', 'Logs', 'Telemetry']);
        expect(client.queryKustoMgmt).toHaveBeenCalledWith(
            '.show databases | project DatabaseName',
            { clusterUrl: 'https://mycluster.kusto.windows.net', database: 'NetDefaultDB' },
        );
    });

    it('returns empty array on error', async () => {
        const client = createMockClient();
        vi.mocked(client.queryKustoMgmt).mockRejectedValue(new Error('network error'));

        const result = await listDatabases(client, 'https://badcluster.kusto.windows.net');
        expect(result).toEqual([]);
    });

    it('filters out empty database names', async () => {
        const client = createMockClient({
            rows: [
                { DatabaseName: 'ValidDB' },
                { DatabaseName: '' },
            ],
            columns: [],
        });

        const result = await listDatabases(client, 'https://mycluster.kusto.windows.net');
        expect(result).toEqual(['ValidDB']);
    });
});

describe('loadSchema auto-discovery', () => {
    it('auto-discovers database when target has empty database', async () => {
        const mockDb: KustoSchemaDb = {
            Tables: { DiscoveredTable: { Folder: 'Test', OrderedColumns: [] } },
        };
        const client = createMockClient();
        vi.mocked(client.queryKustoMgmt)
            .mockResolvedValueOnce({
                rows: [{ DatabaseName: 'AutoDB' }],
                columns: [],
                resultSets: [],
            })
            .mockResolvedValueOnce({
                rows: [{ DatabaseSchema: JSON.stringify({ Databases: { AutoDB: mockDb } }) }],
                columns: [],
                resultSets: [],
            });

        const target = { clusterUrl: 'https://auto.kusto.windows.net', database: '' };
        await loadSchema(client, target);

        expect(vi.mocked(client.queryKustoMgmt).mock.calls[0][0]).toBe('.show databases | project DatabaseName');
        expect(vi.mocked(client.queryKustoMgmt).mock.calls[1][0]).toBe('.show database schema as json');

        const schema = getSchema({ clusterUrl: 'https://auto.kusto.windows.net', database: 'AutoDB' });
        expect(schema.find((t) => t.name === 'DiscoveredTable')).toBeDefined();
    });

    it('caches schema under both discovered and original keys', async () => {
        const mockDb: KustoSchemaDb = {
            Tables: { DualCacheTable: { Folder: 'Dual', OrderedColumns: [] } },
        };
        const client = createMockClient();
        vi.mocked(client.queryKustoMgmt)
            .mockResolvedValueOnce({
                rows: [{ DatabaseName: 'FoundDB' }],
                columns: [],
                resultSets: [],
            })
            .mockResolvedValueOnce({
                rows: [{ DatabaseSchema: JSON.stringify({ Databases: { FoundDB: mockDb } }) }],
                columns: [],
                resultSets: [],
            });

        const target = { clusterUrl: 'https://dual.kusto.windows.net', database: '' };
        await loadSchema(client, target);

        const schemaOriginal = getSchema(target);
        const schemaDiscovered = getSchema({ clusterUrl: 'https://dual.kusto.windows.net', database: 'FoundDB' });
        expect(schemaOriginal.find((t) => t.name === 'DualCacheTable')).toBeDefined();
        expect(schemaDiscovered.find((t) => t.name === 'DualCacheTable')).toBeDefined();
    });

    it('returns early if auto-discovery finds no databases', async () => {
        const client = createMockClient({ rows: [], columns: [] });

        const target = { clusterUrl: 'https://empty.kusto.windows.net', database: '' };
        await loadSchema(client, target);

        expect(client.queryKustoMgmt).toHaveBeenCalledTimes(1);
    });
});

describe('getSchema for non-default targets', () => {
    it('returns empty array for non-default target without cached data', () => {
        const schema = getSchema({ clusterUrl: 'https://no-cache.kusto.windows.net', database: 'NoDB' });
        expect(schema).toEqual([]);
    });

    it('getSchemaFolders returns empty for non-default target without cached data', () => {
        const folders = getSchemaFolders({ clusterUrl: 'https://no-cache.kusto.windows.net', database: 'NoDB' });
        expect(folders).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// getPersistedDatabases / persistDatabases
// ---------------------------------------------------------------------------

describe('getPersistedDatabases', () => {
    beforeEach(() => {
        mockStore.clear();
    });

    it('returns null when no databases are cached', () => {
        expect(getPersistedDatabases('https://uncached.kusto.windows.net')).toBeNull();
    });

    it('returns cached databases after persistDatabases', () => {
        const clusterUrl = 'https://persist-test.kusto.windows.net';
        persistDatabases(clusterUrl, ['DB1', 'DB2']);
        const result = getPersistedDatabases(clusterUrl);
        expect(result).toEqual(['DB1', 'DB2']);
    });
});

describe('persistDatabases', () => {
    beforeEach(() => {
        mockStore.clear();
    });

    it('stores databases and retrieves them', () => {
        const clusterUrl = 'https://store-test.kusto.windows.net';
        persistDatabases(clusterUrl, ['Alpha', 'Beta']);
        expect(getPersistedDatabases(clusterUrl)).toEqual(['Alpha', 'Beta']);
    });

    it('overwrites previously persisted databases', () => {
        const clusterUrl = 'https://overwrite.kusto.windows.net';
        persistDatabases(clusterUrl, ['Old']);
        persistDatabases(clusterUrl, ['New']);
        expect(getPersistedDatabases(clusterUrl)).toEqual(['New']);
    });
});

// ---------------------------------------------------------------------------
// listDatabases with forceRefresh
// ---------------------------------------------------------------------------

describe('listDatabases with forceRefresh', () => {
    beforeEach(() => {
        mockStore.clear();
    });

    it('uses cached databases when forceRefresh is false', async () => {
        const clusterUrl = 'https://cached-dbs.kusto.windows.net';
        persistDatabases(clusterUrl, ['CachedDB']);
        const client = createMockClient();

        const result = await listDatabases(client, clusterUrl);
        expect(result).toEqual(['CachedDB']);
        expect(client.queryKustoMgmt).not.toHaveBeenCalled();
    });

    it('bypasses cache when forceRefresh is true', async () => {
        const clusterUrl = 'https://force-refresh.kusto.windows.net';
        persistDatabases(clusterUrl, ['OldDB']);
        const client = createMockClient({
            rows: [{ DatabaseName: 'FreshDB' }],
            columns: [],
        });

        const result = await listDatabases(client, clusterUrl, true);
        expect(result).toEqual(['FreshDB']);
        expect(client.queryKustoMgmt).toHaveBeenCalled();
    });

    it('persists newly fetched databases', async () => {
        const clusterUrl = 'https://persist-after-fetch.kusto.windows.net';
        const client = createMockClient({
            rows: [{ DatabaseName: 'NewDB' }],
            columns: [],
        });

        await listDatabases(client, clusterUrl, true);
        expect(getPersistedDatabases(clusterUrl)).toEqual(['NewDB']);
    });
});
