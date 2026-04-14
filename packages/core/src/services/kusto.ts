/** Minimal state service interface — compatible with any StateService implementation. */
export interface KustoStateService {
    get<T>(store: string, key: string): T | null;
    set<T>(store: string, key: string, value: T, options?: { ttl?: number }): void;
    clear(store: string): void;
    entryCount(store: string): number;
}

import { computeCacheKey } from './cache';
import { ConcurrencyLimiter } from './concurrency';
import type { Priority } from './concurrency';

const MAX_CONCURRENT = 8;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

export interface KustoTarget {
    clusterUrl: string;
    database: string;
}

export interface KustoColumn {
    ColumnName: string;
    ColumnType: string;
}

export interface QueryStats {
    executionTime?: string;
    cpuTime?: string;
    memoryPeak?: number;
    cacheHitBytes?: number;
    cacheMissBytes?: number;
    extentsScanned?: number;
    extentsTotal?: number;
    rowsScanned?: number;
    rowsTotal?: number;
    resultRows?: number;
    resultSize?: number;
    fromCache?: boolean;
}

export interface KustoVisualization {
    type: string;
    xColumn?: string;
    yColumns?: string[];
    series?: string;
    title?: string;
}

export interface KustoResultSet {
    columns: KustoColumn[];
    rows: Record<string, unknown>[];
    visualization?: KustoVisualization;
}

export interface KustoResult<T = Record<string, unknown>> {
    columns: KustoColumn[];
    rows: T[];
    stats?: QueryStats;
    resultSets: KustoResultSet[];
}

export interface RawTable {
    Columns: { ColumnName: string; ColumnType?: string }[];
    Rows: unknown[][];
}

/**
 * Parse visualization metadata from QueryProperties entries in the TOC.
 * Returns a map from primary-result ordinal → KustoVisualization.
 */
export function parseVisualizationMetadata(allTables: RawTable[], tocTable: RawTable, primaryIndices: number[]): Map<number, KustoVisualization> {
    const vizByOrdinal = new Map<number, KustoVisualization>();
    const tocCols = tocTable.Columns.map((c) => c.ColumnName);
    const kindIdx = tocCols.indexOf('Kind');
    const ordinalIdx = tocCols.indexOf('Ordinal');
    if (kindIdx === -1 || ordinalIdx === -1) {
        return vizByOrdinal;
    }
    const nameIdx = tocCols.indexOf('Name');

    for (const row of tocTable.Rows) {
        if (row[kindIdx] === 'QueryProperties' && nameIdx !== -1) {
            const propTable = allTables[row[ordinalIdx] as number];
            if (propTable) {
                const propCols = propTable.Columns.map((c) => c.ColumnName);
                const valIdx = propCols.indexOf('Value');
                if (valIdx !== -1 && propTable.Rows.length > 0) {
                    try {
                        const rawVal = propTable.Rows[0][valIdx];
                        const raw = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
                        if (raw && typeof raw === 'object' && raw.Visualization && raw.Visualization !== 'table') {
                            const viz: KustoVisualization = { type: raw.Visualization };
                            if (raw.XColumn) { viz.xColumn = raw.XColumn; }
                            if (raw.YColumns) { viz.yColumns = typeof raw.YColumns === 'string' ? raw.YColumns.split(',').map((s: string) => s.trim()) : raw.YColumns; }
                            if (raw.Series) { viz.series = typeof raw.Series === 'string' ? raw.Series : undefined; }
                            if (raw.Title) { viz.title = raw.Title; }
                            const ordinal = row[ordinalIdx] as number;
                            let prevResult: number | undefined;
                            for (let i = primaryIndices.length - 1; i >= 0; i--) {
                                if (primaryIndices[i] < ordinal) {
                                    prevResult = primaryIndices[i];
                                    break;
                                }
                            }
                            if (prevResult !== undefined) {
                                vizByOrdinal.set(prevResult, viz);
                            } else if (primaryIndices.length > 0) {
                                vizByOrdinal.set(primaryIndices[0], viz);
                            }
                        }
                    } catch { /* ignore malformed visualization metadata */ }
                }
            }
        }
    }
    return vizByOrdinal;
}

/**
 * Build result sets from primary tables, applying validated visualization metadata.
 */
export function buildResultSets(allTables: RawTable[], primaryIndices: number[], vizByOrdinal: Map<number, KustoVisualization>): KustoResultSet[] {
    return primaryIndices.map((idx) => {
        const tbl = allTables[idx];
        const cols: KustoColumn[] = tbl.Columns.map((c) => ({ ColumnName: c.ColumnName, ColumnType: c.ColumnType ?? 'string' }));
        const colNames = cols.map((c) => c.ColumnName);
        const parsedRows = tbl.Rows.map((row: unknown[]) => {
            const obj: Record<string, unknown> = {};
            colNames.forEach((name, i) => { obj[name] = row[i]; });
            return obj;
        });
        const resultSet: KustoResultSet = { columns: cols, rows: parsedRows };
        const viz = vizByOrdinal.get(idx);
        if (viz) {
            const validViz: KustoVisualization = { type: viz.type };
            if (viz.title) { validViz.title = viz.title; }
            if (viz.xColumn && colNames.includes(viz.xColumn)) { validViz.xColumn = viz.xColumn; }
            if (viz.series && colNames.includes(viz.series)) { validViz.series = viz.series; }
            if (viz.yColumns) {
                const validY = viz.yColumns.filter((y) => colNames.includes(y));
                if (validY.length > 0) { validViz.yColumns = validY; }
            }
            resultSet.visualization = validViz;
        }
        return resultSet;
    });
}

export function extractStats(tables: { Columns: { ColumnName: string }[]; Rows: unknown[][] }[]): QueryStats {
    const stats: QueryStats = {};

    for (let t = 1; t < tables.length; t++) {
        const table = tables[t];
        const colNames = table.Columns.map((c) => c.ColumnName);
        const severityIdx = colNames.indexOf('SeverityName');
        const descIdx = colNames.indexOf('StatusDescription');
        if (severityIdx === -1 || descIdx === -1) {
            continue;
        }

        for (const row of table.Rows) {
            if (row[severityIdx] !== 'Stats') {
                continue;
            }
            const raw = row[descIdx];
            if (typeof raw !== 'string') {
                continue;
            }
            try {
                const payload = JSON.parse(raw);

                if (payload.ExecutionTime !== null) {
                    stats.executionTime = typeof payload.ExecutionTime === 'number'
                        ? `${(payload.ExecutionTime * 1000).toFixed(1)} ms`
                        : String(payload.ExecutionTime);
                }

                const ru = payload.resource_usage;
                if (ru) {
                    if (ru.cpu?.['total cpu']) {
                        stats.cpuTime = ru.cpu['total cpu'];
                    }
                    if (ru.memory?.peak_per_node) {
                        stats.memoryPeak = ru.memory.peak_per_node;
                    }

                    const shards = ru.cache?.shards;
                    if (shards) {
                        const hotHit = shards.hot?.hitbytes ?? 0;
                        const coldHit = shards.cold?.hitbytes ?? 0;
                        const hotMiss = shards.hot?.missbytes ?? 0;
                        const coldMiss = shards.cold?.missbytes ?? 0;
                        stats.cacheHitBytes = hotHit + coldHit;
                        stats.cacheMissBytes = hotMiss + coldMiss;
                    }

                    if (ru.cache?.results_cache_origin) {
                        stats.fromCache = true;
                    }
                }

                const input = payload.input_dataset_statistics;
                if (input) {
                    if (input.extents) {
                        stats.extentsScanned = input.extents.scanned;
                        stats.extentsTotal = input.extents.total;
                    }
                    if (input.rows) {
                        stats.rowsScanned = input.rows.scanned;
                        stats.rowsTotal = input.rows.total;
                    }
                }

                const ds = payload.dataset_statistics;
                if (Array.isArray(ds) && ds.length > 0) {
                    stats.resultRows = ds[0].table_row_count;
                    stats.resultSize = ds[0].table_size;
                }
            } catch {
                // Not valid JSON — skip
            }
        }
    }

    return stats;
}

export type QueryPriority = Priority;

export interface QueryKustoOptions {
    bypassCache?: boolean;
}

export interface KustoClientConfig {
    defaultTarget: KustoTarget;
    getToken: (clusterUrl: string) => Promise<string>;
    stateService: KustoStateService;
}

export interface KustoClient {
    queryKusto<T = Record<string, unknown>>(
        kql: string,
        signal?: AbortSignal,
        priority?: QueryPriority,
        target?: KustoTarget,
        options?: QueryKustoOptions,
    ): Promise<KustoResult<T>>;
    queryKustoMgmt<T = Record<string, unknown>>(kql: string, target?: KustoTarget): Promise<KustoResult<T>>;
    clearQueryCache(): void;
    getQueryCacheSize(): number;
}

async function fetchWithRetry(url: string, init: RequestInit, retries = MAX_RETRIES): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const response = await fetch(url, init);
        if (response.status === 429 && attempt < retries) {
            const delay = RETRY_BASE_MS * Math.pow(2, attempt);
            await new Promise((r) => setTimeout(r, delay));
            continue;
        }
        return response;
    }
    throw new Error('Max retries exceeded');
}

export function createKustoClient(config: KustoClientConfig): KustoClient {
    const { defaultTarget, getToken, stateService } = config;
    const limiter = new ConcurrencyLimiter(MAX_CONCURRENT);
    const inflightQueries = new Map<string, Promise<KustoResult<unknown>>>();

    function targetCacheKey(kql: string, target: KustoTarget, prefix: string): string {
        const targetKey = target.clusterUrl === defaultTarget.clusterUrl && target.database === defaultTarget.database
            ? '' : `${target.clusterUrl}|${target.database}|`;
        return computeCacheKey(`${targetKey}${kql}`, prefix);
    }

    async function executeQuery<T = Record<string, unknown>>(
        kql: string,
        signal?: AbortSignal,
        priority?: QueryPriority,
        target?: KustoTarget,
        options?: QueryKustoOptions,
    ): Promise<KustoResult<T>> {
        const t = target ?? defaultTarget;
        const token = await getToken(t.clusterUrl);

        await limiter.acquire(priority);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        if (signal) {
            if (signal.aborted) { controller.abort(); }
            else { signal.addEventListener('abort', () => controller.abort(), { once: true }); }
        }

        try {
            const response = await fetchWithRetry(`${t.clusterUrl}/v1/rest/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    db: t.database,
                    csl: kql,
                    properties: JSON.stringify({
                        Options: {
                            servertimeout: '00:01:00',
                            query_results_cache_max_age: options?.bypassCache ? '00:00:00' : '00:05:00',
                        },
                    }),
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Kusto query failed: ${response.status} — ${text.slice(0, 200)}`);
            }

            const data = await response.json();
            const allTables = data.Tables as { Columns: { ColumnName: string; ColumnType?: string }[]; Rows: unknown[][] }[];

            const tocTable = allTables[allTables.length - 1];
            const tocCols = tocTable?.Columns?.map((c) => c.ColumnName) ?? [];
            const kindIdx = tocCols.indexOf('Kind');
            const ordinalIdx = tocCols.indexOf('Ordinal');

            const primaryIndices: number[] = [];
            if (kindIdx !== -1 && ordinalIdx !== -1) {
                for (const row of tocTable.Rows) {
                    if (row[kindIdx] === 'QueryResult') {
                        primaryIndices.push(row[ordinalIdx] as number);
                    }
                }
            }
            if (primaryIndices.length === 0) {
                primaryIndices.push(0);
            }

            const vizByOrdinal = parseVisualizationMetadata(allTables, tocTable, primaryIndices);
            const resultSets = buildResultSets(allTables, primaryIndices, vizByOrdinal);

            const firstSet = resultSets[0];
            const result: KustoResult<T> = {
                columns: firstSet.columns,
                rows: firstSet.rows as T[],
                resultSets,
            };

            if (allTables.length > 1) {
                result.stats = extractStats(allTables);
            }

            stateService.set('queryCache', targetCacheKey(kql, t, 'q:'), result as KustoResult);
            return result;
        } finally {
            clearTimeout(timeout);
            limiter.release();
        }
    }

    return {
        queryKusto<T = Record<string, unknown>>(
            kql: string,
            signal?: AbortSignal,
            priority?: QueryPriority,
            target?: KustoTarget,
            options?: QueryKustoOptions,
        ): Promise<KustoResult<T>> {
            const t = target ?? defaultTarget;
            const cacheKey = targetCacheKey(kql, t, 'q:');

            if (!options?.bypassCache) {
                const cached = stateService.get<KustoResult<T>>('queryCache', cacheKey);
                if (cached) {
                    return Promise.resolve(cached);
                }
            }

            const inflight = inflightQueries.get(cacheKey);
            if (inflight) {
                return inflight as Promise<KustoResult<T>>;
            }

            const promise = executeQuery<T>(kql, signal, priority, t, options).finally(() => {
                inflightQueries.delete(cacheKey);
            });
            inflightQueries.set(cacheKey, promise as Promise<KustoResult<unknown>>);
            return promise;
        },

        async queryKustoMgmt<T = Record<string, unknown>>(kql: string, target?: KustoTarget): Promise<KustoResult<T>> {
            const t = target ?? defaultTarget;
            const cacheKey = targetCacheKey(kql, t, 'm:');

            const cached = stateService.get<KustoResult<T>>('queryCache', cacheKey);
            if (cached) {
                return cached;
            }

            const token = await getToken(t.clusterUrl);

            await limiter.acquire();

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60000);

            try {
                const response = await fetchWithRetry(`${t.clusterUrl}/v1/rest/mgmt`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        db: t.database,
                        csl: kql,
                    }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`Kusto mgmt command failed: ${response.status} — ${text.slice(0, 200)}`);
                }

                const data = await response.json();
                const table = data.Tables[0];
                const columns: KustoColumn[] = table.Columns;
                const columnNames = columns.map((c: KustoColumn) => c.ColumnName);

                const rows: T[] = table.Rows.map((row: unknown[]) => {
                    const obj: Record<string, unknown> = {};
                    columnNames.forEach((name: string, i: number) => {
                        obj[name] = row[i];
                    });
                    return obj as T;
                });

                const result: KustoResult<T> = { columns, rows, resultSets: [{ columns, rows: rows as Record<string, unknown>[] }] };
                stateService.set('queryCache', targetCacheKey(kql, t, 'm:'), result as KustoResult);
                return result;
            } finally {
                clearTimeout(timeout);
                limiter.release();
            }
        },

        clearQueryCache() {
            stateService.clear('queryCache');
        },

        getQueryCacheSize() {
            return stateService.entryCount('queryCache');
        },
    };
}

// Re-export for convenience
export { clearQueryCache, getQueryCacheSize };

function clearQueryCache(): void {
    // No-op — callers should use the client instance method.
    // This exists only for backward compatibility during migration.
}

function getQueryCacheSize(): number {
    return 0;
}
