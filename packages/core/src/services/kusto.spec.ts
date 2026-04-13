import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { extractStats, createKustoClient } from './kusto';
import type { QueryStats, KustoClient, KustoStateService } from './kusto';

const KUSTO_CLUSTER = 'https://test-kusto.kusto.windows.net';
const KUSTO_DATABASE = 'TestDB';

function createMockStateService(): KustoStateService {
    const stores = new Map<string, Map<string, unknown>>();
    return {
        get<T>(store: string, key: string): T | null {
            return (stores.get(store)?.get(key) as T) ?? null;
        },
        set<T>(store: string, key: string, value: T): void {
            if (!stores.has(store)) {
                stores.set(store, new Map());
            }
            stores.get(store)!.set(key, value);
        },
        clear(store: string): void {
            stores.get(store)?.clear();
        },
        entryCount(store: string): number {
            return stores.get(store)?.size ?? 0;
        },
    };
}

function createTestClient(): { client: KustoClient; stateService: KustoStateService } {
    const stateService = createMockStateService();
    const client = createKustoClient({
        defaultTarget: { clusterUrl: KUSTO_CLUSTER, database: KUSTO_DATABASE },
        getToken: vi.fn().mockResolvedValue('mock-kusto-token'),
        stateService,
    });
    return { client, stateService };
}

// Helper to build a minimal Kusto v1 response body
function makeKustoResponse(
    primaryRows: unknown[][] = [],
    primaryColumns: { ColumnName: string; ColumnType?: string }[] = [{ ColumnName: 'Col1', ColumnType: 'string' }],
    extraTables: { Columns: { ColumnName: string }[]; Rows: unknown[][] }[] = [],
) {
    const toc = {
        Columns: [
            { ColumnName: 'Ordinal' },
            { ColumnName: 'Kind' },
            { ColumnName: 'Name' },
        ],
        Rows: [[0, 'QueryResult', 'PrimaryResult']],
    };

    return {
        Tables: [
            { Columns: primaryColumns, Rows: primaryRows },
            ...extraTables,
            toc,
        ],
    };
}

function stubFetch(body: unknown, ok = true, status = 200): void {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok,
        status,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
    }));
}

describe('extractStats', () => {
    it('returns empty stats when no matching tables exist', () => {
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [['val']] },
        ];
        const stats = extractStats(tables);
        expect(stats).toEqual({});
    });

    it('extracts executionTime from numeric ExecutionTime', () => {
        const payload = { ExecutionTime: 0.5 };
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [['Stats', JSON.stringify(payload)]],
            },
        ];
        const stats = extractStats(tables);
        expect(stats.executionTime).toBe('500.0 ms');
    });

    it('extracts executionTime from string ExecutionTime', () => {
        const payload = { ExecutionTime: '00:00:01.234' };
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [['Stats', JSON.stringify(payload)]],
            },
        ];
        const stats = extractStats(tables);
        expect(stats.executionTime).toBe('00:00:01.234');
    });

    it('extracts resource_usage cpu and memory', () => {
        const payload = {
            ExecutionTime: null,
            resource_usage: {
                cpu: { 'total cpu': '00:00:02.000' },
                memory: { peak_per_node: 1024 },
            },
        };
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [['Stats', JSON.stringify(payload)]],
            },
        ];
        const stats = extractStats(tables);
        expect(stats.cpuTime).toBe('00:00:02.000');
        expect(stats.memoryPeak).toBe(1024);
    });

    it('extracts cache shard hit/miss bytes', () => {
        const payload = {
            ExecutionTime: null,
            resource_usage: {
                cache: {
                    shards: {
                        hot: { hitbytes: 100, missbytes: 10 },
                        cold: { hitbytes: 50, missbytes: 5 },
                    },
                },
            },
        };
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [['Stats', JSON.stringify(payload)]],
            },
        ];
        const stats = extractStats(tables);
        expect(stats.cacheHitBytes).toBe(150);
        expect(stats.cacheMissBytes).toBe(15);
    });

    it('detects results_cache_origin as fromCache', () => {
        const payload = {
            ExecutionTime: null,
            resource_usage: {
                cache: { results_cache_origin: 'hit' },
            },
        };
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [['Stats', JSON.stringify(payload)]],
            },
        ];
        const stats = extractStats(tables);
        expect(stats.fromCache).toBe(true);
    });

    it('extracts input_dataset_statistics extents and rows', () => {
        const payload = {
            ExecutionTime: null,
            input_dataset_statistics: {
                extents: { scanned: 10, total: 100 },
                rows: { scanned: 500, total: 5000 },
            },
        };
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [['Stats', JSON.stringify(payload)]],
            },
        ];
        const stats = extractStats(tables);
        expect(stats.extentsScanned).toBe(10);
        expect(stats.extentsTotal).toBe(100);
        expect(stats.rowsScanned).toBe(500);
        expect(stats.rowsTotal).toBe(5000);
    });

    it('extracts dataset_statistics result size', () => {
        const payload = {
            ExecutionTime: null,
            dataset_statistics: [{ table_row_count: 42, table_size: 1024 }],
        };
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [['Stats', JSON.stringify(payload)]],
            },
        ];
        const stats = extractStats(tables);
        expect(stats.resultRows).toBe(42);
        expect(stats.resultSize).toBe(1024);
    });

    it('handles malformed JSON in StatusDescription gracefully', () => {
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [['Stats', 'not-json']],
            },
        ];
        const stats = extractStats(tables);
        expect(stats).toEqual({});
    });

    it('skips non-Stats severity rows', () => {
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [
                    ['Info', JSON.stringify({ ExecutionTime: 999 })],
                ],
            },
        ];
        const stats = extractStats(tables);
        expect(stats.executionTime).toBeUndefined();
    });

    it('skips rows where StatusDescription is not a string', () => {
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [['Stats', 42]],
            },
        ];
        const stats = extractStats(tables);
        expect(stats).toEqual({});
    });

    it('handles cache shards without cold data', () => {
        const payload = {
            ExecutionTime: null,
            resource_usage: {
                cache: {
                    shards: {
                        hot: { hitbytes: 200, missbytes: 20 },
                    },
                },
            },
        };
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [['Stats', JSON.stringify(payload)]],
            },
        ];
        const stats = extractStats(tables);
        expect(stats.cacheHitBytes).toBe(200);
        expect(stats.cacheMissBytes).toBe(20);
    });

    it('handles empty dataset_statistics array', () => {
        const payload = {
            ExecutionTime: null,
            dataset_statistics: [],
        };
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [['Stats', JSON.stringify(payload)]],
            },
        ];
        const stats = extractStats(tables);
        expect(stats.resultRows).toBeUndefined();
        expect(stats.resultSize).toBeUndefined();
    });

    it('extracts a comprehensive stats object with all fields', () => {
        const payload = {
            ExecutionTime: 0.123,
            resource_usage: {
                cpu: { 'total cpu': '00:00:05.000' },
                memory: { peak_per_node: 2048 },
                cache: {
                    shards: {
                        hot: { hitbytes: 300, missbytes: 30 },
                        cold: { hitbytes: 100, missbytes: 10 },
                    },
                    results_cache_origin: 'partial',
                },
            },
            input_dataset_statistics: {
                extents: { scanned: 5, total: 50 },
                rows: { scanned: 1000, total: 10000 },
            },
            dataset_statistics: [{ table_row_count: 100, table_size: 4096 }],
        };
        const tables = [
            { Columns: [{ ColumnName: 'Col1' }], Rows: [] },
            {
                Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                Rows: [['Stats', JSON.stringify(payload)]],
            },
        ];
        const stats: QueryStats = extractStats(tables);
        expect(stats.executionTime).toBe('123.0 ms');
        expect(stats.cpuTime).toBe('00:00:05.000');
        expect(stats.memoryPeak).toBe(2048);
        expect(stats.cacheHitBytes).toBe(400);
        expect(stats.cacheMissBytes).toBe(40);
        expect(stats.fromCache).toBe(true);
        expect(stats.extentsScanned).toBe(5);
        expect(stats.extentsTotal).toBe(50);
        expect(stats.rowsScanned).toBe(1000);
        expect(stats.rowsTotal).toBe(10000);
        expect(stats.resultRows).toBe(100);
        expect(stats.resultSize).toBe(4096);
    });
});

describe('clearQueryCache / getQueryCacheSize', () => {
    it('reports 0 after clearing', () => {
        const { client } = createTestClient();
        client.clearQueryCache();
        expect(client.getQueryCacheSize()).toBe(0);
    });
});

describe('queryKusto', () => {
    let client: KustoClient;

    beforeEach(() => {
        vi.useFakeTimers();
        ({ client } = createTestClient());
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('sends a POST request and parses primary result set', async () => {
        const body = makeKustoResponse(
            [['hello', 1]],
            [
                { ColumnName: 'Name', ColumnType: 'string' },
                { ColumnName: 'Value', ColumnType: 'int' },
            ],
        );
        stubFetch(body);

        const result = await client.queryKusto('TestTable | take 1');

        expect(result.columns).toHaveLength(2);
        expect(result.columns[0].ColumnName).toBe('Name');
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toEqual({ Name: 'hello', Value: 1 });
        expect(result.resultSets).toHaveLength(1);
    });

    it('uses cached result on second call', async () => {
        const body = makeKustoResponse([['a']]);
        stubFetch(body);

        const result1 = await client.queryKusto('cached query');
        const result2 = await client.queryKusto('cached query');

        expect(result1).toStrictEqual(result2);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('bypasses cached results and disables server-side query caching when requested', async () => {
        const body = makeKustoResponse([['fresh']]);
        stubFetch(body);

        await client.queryKusto('fresh query');
        await client.queryKusto('fresh query', undefined, undefined, undefined, { bypassCache: true });

        expect(fetch).toHaveBeenCalledTimes(2);
        const fetchBody = JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string);
        expect(JSON.parse(fetchBody.properties).Options.query_results_cache_max_age).toBe('00:00:00');
    });

    it('deduplicates concurrent identical queries', async () => {
        const body = makeKustoResponse([['a']]);
        stubFetch(body);

        const [r1, r2] = await Promise.all([
            client.queryKusto('dedup query'),
            client.queryKusto('dedup query'),
        ]);

        expect(r1).toBe(r2);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('throws on non-ok response', async () => {
        stubFetch({ error: 'bad' }, false, 400);

        await expect(client.queryKusto('bad query')).rejects.toThrow('Kusto query failed: 400');
    });

    it('retries on 429 with exponential backoff', async () => {
        const body = makeKustoResponse([['ok']]);
        const mockFetch = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 429, text: () => Promise.resolve('throttled') })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(body),
                text: () => Promise.resolve(JSON.stringify(body)),
            });
        vi.stubGlobal('fetch', mockFetch);

        const promise = client.queryKusto('retry query');
        // Advance timers for the retry delay
        await vi.advanceTimersByTimeAsync(2000);
        const result = await promise;

        expect(result.rows).toHaveLength(1);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('includes auth header in request', async () => {
        const body = makeKustoResponse([]);
        stubFetch(body);

        await client.queryKusto('auth check');

        const fetchCall = vi.mocked(fetch).mock.calls[0];
        expect(fetchCall[0]).toContain('/v1/rest/query');
        expect((fetchCall[1]!.headers as Record<string, string>)['Authorization']).toBe('Bearer mock-kusto-token');
    });

    it('falls back to index 0 when TOC has no QueryResult kind', async () => {
        const body = {
            Tables: [
                {
                    Columns: [{ ColumnName: 'A', ColumnType: 'string' }],
                    Rows: [['val']],
                },
                {
                    Columns: [{ ColumnName: 'X' }],
                    Rows: [],
                },
            ],
        };
        stubFetch(body);

        const result = await client.queryKusto('no-toc query');
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toEqual({ A: 'val' });
    });

    it('extracts stats when response has multiple tables', async () => {
        const statsPayload = { ExecutionTime: 0.05, dataset_statistics: [{ table_row_count: 1, table_size: 64 }] };
        const body = {
            Tables: [
                { Columns: [{ ColumnName: 'A', ColumnType: 'string' }], Rows: [['v']] },
                {
                    Columns: [{ ColumnName: 'SeverityName' }, { ColumnName: 'StatusDescription' }],
                    Rows: [['Stats', JSON.stringify(statsPayload)]],
                },
                {
                    Columns: [{ ColumnName: 'Ordinal' }, { ColumnName: 'Kind' }, { ColumnName: 'Name' }],
                    Rows: [[0, 'QueryResult', 'PrimaryResult']],
                },
            ],
        };
        stubFetch(body);

        const result = await client.queryKusto('stats query');
        expect(result.stats).toBeDefined();
        expect(result.stats?.executionTime).toBe('50.0 ms');
    });
});

describe('queryKustoMgmt', () => {
    let client: KustoClient;

    beforeEach(() => {
        vi.useFakeTimers();
        ({ client } = createTestClient());
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('sends request to mgmt endpoint and parses result', async () => {
        const body = {
            Tables: [{
                Columns: [
                    { ColumnName: 'TableName', ColumnType: 'string' },
                    { ColumnName: 'Count', ColumnType: 'long' },
                ],
                Rows: [['MyTable', 42]],
            }],
        };
        stubFetch(body);

        const result = await client.queryKustoMgmt('.show tables');

        expect(result.columns).toHaveLength(2);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toEqual({ TableName: 'MyTable', Count: 42 });
        expect(result.resultSets).toHaveLength(1);
    });

    it('uses cached mgmt result on second call', async () => {
        const body = {
            Tables: [{
                Columns: [{ ColumnName: 'A', ColumnType: 'string' }],
                Rows: [['cached']],
            }],
        };
        stubFetch(body);

        const r1 = await client.queryKustoMgmt('.show databases');
        const r2 = await client.queryKustoMgmt('.show databases');

        expect(r1).toStrictEqual(r2);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('throws on non-ok response', async () => {
        stubFetch({ error: 'fail' }, false, 500);

        await expect(client.queryKustoMgmt('.bad command')).rejects.toThrow('Kusto mgmt command failed: 500');
    });

    it('sends request to /v1/rest/mgmt', async () => {
        const body = {
            Tables: [{
                Columns: [{ ColumnName: 'A', ColumnType: 'string' }],
                Rows: [],
            }],
        };
        stubFetch(body);

        await client.queryKustoMgmt('.show version');

        const fetchCall = vi.mocked(fetch).mock.calls[0];
        expect(fetchCall[0]).toContain('/v1/rest/mgmt');
    });

    it('uses custom target cluster and database', async () => {

        const body = {
            Tables: [{
                Columns: [{ ColumnName: 'Val', ColumnType: 'string' }],
                Rows: [['ok']],
            }],
        };
        stubFetch(body);

        const target = { clusterUrl: 'https://custom.westus2.kusto.windows.net', database: 'CustomDB' };
        await client.queryKustoMgmt('.show tables', target);

        const fetchCall = vi.mocked(fetch).mock.calls[0];
        expect(fetchCall[0]).toContain('custom.westus2.kusto.windows.net/v1/rest/mgmt');
        const fetchBody = JSON.parse(fetchCall[1]?.body as string);
        expect(fetchBody.db).toBe('CustomDB');
    });
});

describe('queryKusto with custom target', () => {
    it('passes custom cluster URL and database', async () => {
        const { client } = createTestClient();

        const body = {
            Tables: [{
                Columns: [{ ColumnName: 'Id', ColumnType: 'long' }],
                Rows: [[1]],
            }, {
                Columns: [{ ColumnName: 'Kind' }, { ColumnName: 'Ordinal' }],
                Rows: [['QueryResult', 0]],
            }],
        };
        stubFetch(body);

        const target = { clusterUrl: 'https://other.kusto.windows.net', database: 'OtherDB' };
        await client.queryKusto('OtherTable | take 1', undefined, undefined, target);

        const fetchCall = vi.mocked(fetch).mock.calls[0];
        expect(fetchCall[0]).toContain('other.kusto.windows.net/v1/rest/query');
        const fetchBody = JSON.parse(fetchCall[1]?.body as string);
        expect(fetchBody.db).toBe('OtherDB');
    });
});
