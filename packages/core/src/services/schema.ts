import type { KustoClient, KustoTarget } from './kusto';
import { stateService } from './state-service';

// --- Types ---

export interface SchemaColumn {
    name: string;
    type: string;
}

export interface SchemaTable {
    name: string;
    folder: string;
    description: string;
    columns: SchemaColumn[];
    kind: 'table' | 'materializedView' | 'function' | 'externalTable';
}

// --- Live schema loader ---

export interface KustoSchemaDb {
    Tables: Record<string, { Folder?: string; DocString?: string; OrderedColumns?: { Name: string; CslType: string }[] }>;
    MaterializedViews?: Record<string, { Folder?: string; DocString?: string; OrderedColumns?: { Name: string; CslType: string }[] }>;
    Functions?: Record<string, { Folder?: string; DocString?: string; Parameters?: string; Body?: string }>;
    ExternalTables?: Record<string, { Folder?: string; DocString?: string; OrderedColumns?: { Name: string; CslType: string }[] }>;
}

// Per-cluster schema cache
const schemaCache = new Map<string, SchemaTable[]>();
const foldersCache = new Map<string, string[]>();
const loadingPromises = new Map<string, Promise<void>>();

function cacheKey(target?: KustoTarget): string {
    if (!target) {
        return '__default__';
    }
    return `${target.clusterUrl}|${target.database}`;
}

function persistSchemaKey(target: KustoTarget): string {
    return `schema:${target.clusterUrl}|${target.database}`;
}

function persistDbKey(clusterUrl: string): string {
    return `dbs:${clusterUrl}`;
}

function restoreSchemaFromStore(target: KustoTarget): boolean {
    const key = cacheKey(target);
    if (schemaCache.has(key)) {
        return true;
    }
    const stored = stateService.get<SchemaTable[]>('explorerCache', persistSchemaKey(target));
    if (stored && stored.length > 0) {
        schemaCache.set(key, stored);
        foldersCache.set(key, [...new Set(stored.map((t) => t.folder))].filter(Boolean).sort());
        return true;
    }
    return false;
}

function persistSchema(target: KustoTarget, schema: SchemaTable[]): void {
    stateService.set('explorerCache', persistSchemaKey(target), schema);
}

export function getPersistedDatabases(clusterUrl: string): string[] | null {
    return stateService.get<string[]>('explorerCache', persistDbKey(clusterUrl));
}

export function persistDatabases(clusterUrl: string, dbs: string[]): void {
    stateService.set('explorerCache', persistDbKey(clusterUrl), dbs);
}

const isLookup = (t: SchemaTable) => t.kind === 'table' && t.folder === 'Lookup';

export function parseSchema(db: KustoSchemaDb): SchemaTable[] {
    const tables: SchemaTable[] = [];

    // Tables
    for (const [name, tbl] of Object.entries(db.Tables ?? {})) {
        tables.push({
            name,
            folder: tbl.Folder || '',
            description: tbl.DocString || '',
            columns: (tbl.OrderedColumns ?? []).map((c) => ({ name: c.Name, type: c.CslType })),
            kind: 'table',
        });
    }

    // Materialized Views
    for (const [name, mv] of Object.entries(db.MaterializedViews ?? {})) {
        tables.push({
            name,
            folder: mv.Folder || '',
            description: mv.DocString || 'Materialized view',
            columns: (mv.OrderedColumns ?? []).map((c) => ({ name: c.Name, type: c.CslType })),
            kind: 'materializedView',
        });
    }

    // Functions (shown as schema items but without columns)
    for (const [name, fn] of Object.entries(db.Functions ?? {})) {
        tables.push({
            name,
            folder: fn.Folder || '',
            description: fn.DocString || '',
            columns: [],
            kind: 'function',
        });
    }

    // External Tables
    for (const [name, et] of Object.entries(db.ExternalTables ?? {})) {
        tables.push({
            name,
            folder: et.Folder || '',
            description: et.DocString || '',
            columns: (et.OrderedColumns ?? []).map((c) => ({ name: c.Name, type: c.CslType })),
            kind: 'externalTable',
        });
    }

    const kindOrder: Record<string, number> = { 'function': 0, 'materializedView': 1, 'table': 2, 'externalTable': 3 };

    return tables.sort((a, b) => {
        // Sort by folder first
        const folderCmp = a.folder.localeCompare(b.folder);
        if (folderCmp !== 0) {
            return folderCmp;
        }
        // Within same folder: fn → MV → lookup (by folder) → table
        const aOrder = isLookup(a) ? 1.5 : (kindOrder[a.kind] ?? 2);
        const bOrder = isLookup(b) ? 1.5 : (kindOrder[b.kind] ?? 2);
        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }
        // Then alphabetical
        return a.name.localeCompare(b.name);
    });
}

/**
 * Load schema for a cluster+database target. If the database is empty or wrong,
 * auto-discovers the first available database via `.show databases`.
 */
export async function loadSchema(client: KustoClient, target?: KustoTarget): Promise<void> {
    // Auto-discover database if not specified
    let effectiveTarget = target;
    if (target && !target.database) {
        const discovered = await discoverDefaultDatabase(client, target.clusterUrl);
        if (!discovered) {
            return;
        }
        effectiveTarget = discovered;
    }

    const key = cacheKey(effectiveTarget);
    if (schemaCache.has(key)) {
        return;
    }

    // Try restoring from persistent cache (IndexedDB)
    if (effectiveTarget && restoreSchemaFromStore(effectiveTarget)) {
        return;
    }

    if (loadingPromises.has(key)) {
        return loadingPromises.get(key);
    }

    const promise = (async () => {
        try {
            const result = await client.queryKustoMgmt<{ DatabaseSchema: string }>('.show database schema as json', effectiveTarget);
            if (result.rows.length > 0) {
                const schemaJson = JSON.parse(result.rows[0].DatabaseSchema);
                const dbName = Object.keys(schemaJson.Databases)[0];
                const db = schemaJson.Databases[dbName] as KustoSchemaDb;
                const parsed = parseSchema(db);
                schemaCache.set(key, parsed);
                foldersCache.set(key, [...new Set(parsed.map((t) => t.folder))].filter(Boolean).sort());
                // Persist to IndexedDB
                if (effectiveTarget) {
                    persistSchema(effectiveTarget, parsed);
                }
                // Also cache under the original target key if different
                if (target && cacheKey(target) !== key) {
                    schemaCache.set(cacheKey(target), parsed);
                    foldersCache.set(cacheKey(target), [...new Set(parsed.map((t) => t.folder))].filter(Boolean).sort());
                    persistSchema(target, parsed);
                }
            } else {
                schemaCache.set(key, []);
            }
        } catch {
            if (effectiveTarget && effectiveTarget === target) {
                const discovered = await discoverDefaultDatabase(client, effectiveTarget.clusterUrl);
                if (discovered && discovered.database !== effectiveTarget.database) {
                    return loadSchema(client, discovered);
                }
            }
        } finally {
            loadingPromises.delete(key);
        }
    })();

    loadingPromises.set(key, promise);
    return promise;
}

/** Try to discover the first database on a cluster via `.show databases`. */
async function discoverDefaultDatabase(client: KustoClient, clusterUrl: string): Promise<KustoTarget | null> {
    try {
        const dbs = await listDatabases(client, clusterUrl);
        if (dbs.length > 0) {
            return { clusterUrl, database: dbs[0] };
        }
    } catch { /* ignore */ }
    return null;
}

/** Force reload the schema from Kusto (clears persistent cache) */
export async function reloadSchema(client: KustoClient, target?: KustoTarget): Promise<void> {
    const key = cacheKey(target);
    schemaCache.delete(key);
    foldersCache.delete(key);
    if (target) {
        stateService.delete('explorerCache', persistSchemaKey(target));
    }
    return loadSchema(client, target);
}

/** Get the current schema (live if loaded, otherwise fallback for default cluster or empty for others) */
export function getSchema(target?: KustoTarget): SchemaTable[] {
    const cached = schemaCache.get(cacheKey(target));
    if (cached) {
        return cached;
    }
    // Only show fallback for the default cluster (no target specified)
    return target ? [] : [];
}

export function getSchemaFolders(target?: KustoTarget): string[] {
    const cached = foldersCache.get(cacheKey(target));
    if (cached) {
        return cached;
    }
    return target ? [] : [];
}

/** List databases on a Kusto cluster. Uses persistent cache; pass forceRefresh to bypass. */
export async function listDatabases(client: KustoClient, clusterUrl: string, forceRefresh = false): Promise<string[]> {
    if (!forceRefresh) {
        const cached = getPersistedDatabases(clusterUrl);
        if (cached) {
            return cached;
        }
    }
    try {
        const target: KustoTarget = { clusterUrl, database: 'NetDefaultDB' };
        const result = await client.queryKustoMgmt<{ DatabaseName: string }>('.show databases | project DatabaseName', target);
        const dbs = result.rows.map((r) => r.DatabaseName).filter(Boolean).sort();
        if (dbs.length > 0) {
            persistDatabases(clusterUrl, dbs);
        }
        return dbs;
    } catch (err) {
        console.error('[schema] listDatabases failed for', clusterUrl, err);
        return [];
    }
}

// --- KQL language tokens (not from Kusto, always static) ---

export const KQL_FUNCTIONS = [
    'where', 'project', 'extend', 'summarize', 'count', 'take', 'top', 'order', 'sort',
    'join', 'union', 'lookup', 'mv-expand', 'parse', 'evaluate',
    'render', 'as', 'let', 'set', 'alias', 'restrict', 'pattern',
];

export const KQL_AGGREGATIONS = [
    'count', 'countif', 'dcount', 'sum', 'sumif', 'avg', 'min', 'max',
    'percentile', 'percentiles', 'stdev', 'variance', 'make_list', 'make_set',
    'arg_max', 'arg_min', 'any', 'take_any',
];

export const KQL_SCALAR_FUNCTIONS = [
    'ago', 'now', 'datetime', 'timespan', 'bin', 'floor', 'ceiling',
    'strlen', 'substring', 'tolower', 'toupper', 'trim', 'replace',
    'strcat', 'split', 'parse_json', 'tostring', 'toint', 'tolong', 'todouble', 'tobool',
    'iif', 'iff', 'case', 'coalesce', 'isempty', 'isnotempty', 'isnull', 'isnotnull',
    'format_datetime', 'datetime_diff', 'startofday', 'startofweek', 'startofmonth',
    'round', 'abs', 'log', 'pow', 'sqrt',
    'array_length', 'pack', 'bag_keys',
];
