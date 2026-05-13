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

/**
 * Root payload returned by Kusto's `.show database schema as json` command.
 * Shape matches what `@kusto/monaco-kusto`'s `setSchemaFromShowSchema` expects.
 * Kept loose (optional fields) so older cluster responses still parse.
 */
export interface RawShowSchema {
    readonly Plugins?: readonly unknown[];
    readonly Databases: Record<string, RawShowSchemaDatabase>;
}

export interface RawShowSchemaDatabase {
    readonly Name?: string;
    readonly Tables?: Record<string, unknown>;
    readonly ExternalTables?: Record<string, unknown>;
    readonly MaterializedViews?: Record<string, unknown>;
    readonly Functions?: Record<string, unknown>;
    readonly EntityGroups?: Record<string, readonly string[]>;
    readonly Graphs?: Record<string, unknown>;
    readonly MajorVersion?: number;
    readonly MinorVersion?: number;
    readonly DatabaseAccessMode?: string;
}

// Per-cluster schema cache
const schemaCache = new Map<string, SchemaTable[]>();
const foldersCache = new Map<string, string[]>();
const rawSchemaCache = new Map<string, RawShowSchema>();
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

function persistRawSchemaKey(target: KustoTarget): string {
    return `raw-schema:${target.clusterUrl}|${target.database}`;
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
        // Best-effort raw restore — language service IntelliSense needs this.
        const rawStored = stateService.get<RawShowSchema>('explorerCache', persistRawSchemaKey(target));
        if (rawStored && rawStored.Databases) {
            rawSchemaCache.set(key, rawStored);
        }
        return true;
    }
    return false;
}

function persistSchema(target: KustoTarget, schema: SchemaTable[]): void {
    stateService.set('explorerCache', persistSchemaKey(target), schema);
}

function persistRawSchema(target: KustoTarget, raw: RawShowSchema): void {
    stateService.set('explorerCache', persistRawSchemaKey(target), raw);
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
                const schemaJson = JSON.parse(result.rows[0].DatabaseSchema) as RawShowSchema;
                const dbName = Object.keys(schemaJson.Databases)[0];
                const db = schemaJson.Databases[dbName] as KustoSchemaDb;
                const parsed = parseSchema(db);
                schemaCache.set(key, parsed);
                foldersCache.set(key, [...new Set(parsed.map((t) => t.folder))].filter(Boolean).sort());
                rawSchemaCache.set(key, schemaJson);
                // Persist to IndexedDB
                if (effectiveTarget) {
                    persistSchema(effectiveTarget, parsed);
                    persistRawSchema(effectiveTarget, schemaJson);
                }
                // Also cache under the original target key if different
                if (target && cacheKey(target) !== key) {
                    schemaCache.set(cacheKey(target), parsed);
                    foldersCache.set(cacheKey(target), [...new Set(parsed.map((t) => t.folder))].filter(Boolean).sort());
                    rawSchemaCache.set(cacheKey(target), schemaJson);
                    persistSchema(target, parsed);
                    persistRawSchema(target, schemaJson);
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
    rawSchemaCache.delete(key);
    if (target) {
        stateService.delete('explorerCache', persistSchemaKey(target));
        stateService.delete('explorerCache', persistRawSchemaKey(target));
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

/**
 * Returns the raw `.show database schema as json` payload for the given target,
 * if known. The payload's shape matches what `@kusto/monaco-kusto`'s
 * `setSchemaFromShowSchema` accepts. Returns null when no schema has been
 * loaded (or persisted) for this target.
 */
export function getRawShowSchema(target?: KustoTarget): RawShowSchema | null {
    const key = cacheKey(target);
    const cached = rawSchemaCache.get(key);
    if (cached) {
        return cached;
    }
    if (target) {
        const persisted = stateService.get<RawShowSchema>('explorerCache', persistRawSchemaKey(target));
        if (persisted && persisted.Databases) {
            rawSchemaCache.set(key, persisted);
            return persisted;
        }
    }
    return null;
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
