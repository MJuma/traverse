/**
 * Centralized state service — two-tier architecture:
 *   Memory layer (all reads, instant) + IndexedDB (persistence, write-behind).
 *
 * Config store additionally mirrors to localStorage for synchronous bootstrap
 * on app startup (avoids theme flash).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StoreName = 'config' | 'queryCache' | 'explorerCache' | 'explorerConnections';

export interface StoreEntry<T = unknown> {
    value: T;
    timestamp: number;
    /** Per-entry TTL override in ms. Falls back to store default when absent. */
    ttl?: number;
}

export interface StoreEntryInfo {
    key: string;
    timestamp: number;
    ttl?: number;
    /** Approximate byte size of the serialized value. */
    size: number;
}

export interface StoreStats {
    stores: Record<StoreName, { entries: number; totalSize: number; oldestTimestamp: number | null }>;
    totalEntries: number;
    totalSize: number;
}

interface StoreConfig {
    /** Default TTL in ms. `undefined` = no expiry. */
    defaultTtlMs?: number;
    /** Maximum entries. Oldest evicted on write. `undefined` = unlimited. */
    maxEntries?: number;
    /** Whether to persist to IndexedDB. */
    persist: boolean;
    /** Whether to mirror writes to localStorage for synchronous reads on next startup. */
    syncBootstrap: boolean;
}

// ---------------------------------------------------------------------------
// Store configuration
// ---------------------------------------------------------------------------

const STORE_CONFIGS: Record<StoreName, StoreConfig> = {
    config: { persist: true, syncBootstrap: true },
    queryCache: { defaultTtlMs: 15 * 60 * 1000, persist: true, syncBootstrap: false },
    explorerCache: { maxEntries: 200, persist: true, syncBootstrap: false },
    explorerConnections: { persist: true, syncBootstrap: true },
};

export const STORE_NAMES = Object.keys(STORE_CONFIGS) as StoreName[];

const IDB_NAME = 'traverse-state';
const IDB_VERSION = 1;
const LS_PREFIX = 'traverse-state:';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lsKey(store: StoreName, key: string): string {
    return `${LS_PREFIX}${store}:${key}`;
}

function estimateSize(value: unknown): number {
    try {
        return JSON.stringify(value).length * 2; // rough byte estimate (UTF-16)
    } catch {
        return 0;
    }
}

function isExpired(entry: StoreEntry, config: StoreConfig): boolean {
    const ttl = entry.ttl ?? config.defaultTtlMs;
    if (ttl === undefined) {
        return false;
    }
    return Date.now() - entry.timestamp > ttl;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            for (const name of STORE_NAMES) {
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name);
                }
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function idbReadAll(db: IDBDatabase, storeName: StoreName): Promise<Map<string, StoreEntry>> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const result = new Map<string, StoreEntry>();
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
            const c = cursor.result;
            if (c) {
                result.set(c.key as string, c.value as StoreEntry);
                c.continue();
            }
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
    });
}

function idbPut(db: IDBDatabase, storeName: StoreName, key: string, entry: StoreEntry): void {
    try {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(entry, key);
    } catch {
        // IndexedDB unavailable — memory layer still works
    }
}

function idbDelete(db: IDBDatabase, storeName: StoreName, key: string): void {
    try {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
    } catch {
        // silently skip
    }
}

function idbClear(db: IDBDatabase, storeName: StoreName): void {
    try {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
    } catch {
        // silently skip
    }
}

// ---------------------------------------------------------------------------
// StateService
// ---------------------------------------------------------------------------

export class StateService {
    private memory = new Map<StoreName, Map<string, StoreEntry>>();
    private listeners = new Map<StoreName, Map<string, Set<() => void>>>();
    private db: IDBDatabase | null = null;
    private hydratePromise: Promise<void> | null = null;
    private _hydrated = false;

    // Snapshot caching — ensures useSyncExternalStore gets stable references
    private storeVersions = new Map<StoreName, number>();
    private entriesCache = new Map<StoreName, { version: number; value: StoreEntryInfo[] }>();
    private statsCache: { version: number; value: StoreStats } | null = null;
    private globalVersion = 0;

    constructor() {
        for (const name of STORE_NAMES) {
            this.memory.set(name, new Map());
            this.listeners.set(name, new Map());
            this.storeVersions.set(name, 0);
        }
        // Synchronous bootstrap: read config and explorerConnections from localStorage
        this.bootstrapFromLocalStorage('config');
        this.bootstrapFromLocalStorage('explorerConnections');
    }

    // --- Bootstrap (sync) ---

    private bootstrapFromLocalStorage(store: StoreName): void {
        try {
            const prefix = `${LS_PREFIX}${store}:`;
            const storeMap = this.memory.get(store)!;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k?.startsWith(prefix)) {
                    try {
                        const entry = JSON.parse(localStorage.getItem(k)!) as StoreEntry;
                        const storeKey = k.slice(prefix.length);
                        if (!isExpired(entry, STORE_CONFIGS[store])) {
                            storeMap.set(storeKey, entry);
                        }
                    } catch { /* skip corrupt entries */ }
                }
            }
        } catch {
            // localStorage inaccessible (e.g. in some test environments)
        }
    }

    // --- Hydration (async) ---

    get hydrated(): boolean {
        return this._hydrated;
    }

    hydrate(): Promise<void> {
        if (this.hydratePromise) {
            return this.hydratePromise;
        }
        this.hydratePromise = this.doHydrate();
        return this.hydratePromise;
    }

    private async doHydrate(): Promise<void> {
        // Phase 1: Try to load persisted state from IndexedDB
        try {
            this.db = await openIDB();
            for (const name of STORE_NAMES) {
                try {
                    const entries = await idbReadAll(this.db, name);
                    const storeMap = this.memory.get(name)!;
                    const config = STORE_CONFIGS[name];
                    for (const [key, entry] of entries) {
                        if (isExpired(entry, config)) {
                            idbDelete(this.db, name, key);
                        } else if (!storeMap.has(key)) {
                            // Don't override bootstrap values — they may be newer (user changed theme before hydrate)
                            storeMap.set(key, entry);
                        }
                    }
                } catch {
                    // Skip individual store failures — memory layer still works
                }
            }
        } catch {
            // IndexedDB completely unavailable — app runs with memory-only
        }

        // Phase 2: Persist any bootstrap entries to IndexedDB
        if (this.db) {
            for (const name of STORE_NAMES) {
                const storeMap = this.memory.get(name)!;
                for (const [key, entry] of storeMap) {
                    idbPut(this.db, name, key, entry);
                }
            }
        }

        this._hydrated = true;
    }

    // --- Read ---

    get<T>(store: StoreName, key: string): T | null {
        const storeMap = this.memory.get(store);
        if (!storeMap) {
            return null;
        }
        const entry = storeMap.get(key);
        if (!entry) {
            return null;
        }
        if (isExpired(entry, STORE_CONFIGS[store])) {
            this.delete(store, key);
            return null;
        }
        return entry.value as T;
    }

    has(store: StoreName, key: string): boolean {
        return this.get(store, key) !== null;
    }

    // --- Write ---

    set<T>(store: StoreName, key: string, value: T, options?: { ttl?: number }): void {
        const storeMap = this.memory.get(store);
        if (!storeMap) {
            return;
        }
        const config = STORE_CONFIGS[store];
        const entry: StoreEntry = {
            value,
            timestamp: Date.now(),
            ttl: options?.ttl,
        };

        storeMap.set(key, entry);

        // Max-entry eviction (LRU by timestamp)
        if (config.maxEntries !== undefined && storeMap.size > config.maxEntries) {
            this.evictOldest(store, storeMap, storeMap.size - config.maxEntries);
        }

        // Notify listeners
        this.notify(store, key);

        // Write-behind to IndexedDB
        if (config.persist && this.db) {
            idbPut(this.db, store, key, entry);
        }

        // Sync bootstrap to localStorage
        if (config.syncBootstrap) {
            try {
                localStorage.setItem(lsKey(store, key), JSON.stringify(entry));
            } catch { /* quota exceeded — memory + IDB still work */ }
        }
    }

    // --- Delete ---

    delete(store: StoreName, key: string): void {
        const storeMap = this.memory.get(store);
        if (!storeMap) {
            return;
        }
        const existed = storeMap.delete(key);
        if (existed) {
            this.notify(store, key);
        }

        const config = STORE_CONFIGS[store];
        if (config.persist && this.db) {
            idbDelete(this.db, store, key);
        }
        if (config.syncBootstrap) {
            try { localStorage.removeItem(lsKey(store, key)); } catch { /* ignore */ }
        }
    }

    // --- Clear ---

    clear(store: StoreName): void {
        const storeMap = this.memory.get(store);
        if (!storeMap || storeMap.size === 0) {
            return;
        }
        const keys = [...storeMap.keys()];
        storeMap.clear();
        // Notify all listeners in this store
        for (const key of keys) {
            this.notify(store, key);
        }

        const config = STORE_CONFIGS[store];
        if (config.persist && this.db) {
            idbClear(this.db, store);
        }
        if (config.syncBootstrap) {
            this.clearLocalStoragePrefix(store);
        }
    }

    // --- Enumeration ---

    keys(store: StoreName): string[] {
        const storeMap = this.memory.get(store);
        if (!storeMap) {
            return [];
        }
        // Filter out expired entries
        const result: string[] = [];
        const config = STORE_CONFIGS[store];
        for (const [key, entry] of storeMap) {
            if (!isExpired(entry, config)) {
                result.push(key);
            }
        }
        return result;
    }

    entries(store: StoreName): StoreEntryInfo[] {
        const version = this.storeVersions.get(store) ?? 0;
        const cached = this.entriesCache.get(store);
        if (cached && cached.version === version) {
            return cached.value;
        }

        const storeMap = this.memory.get(store);
        if (!storeMap) {
            return [];
        }
        const config = STORE_CONFIGS[store];
        const result: StoreEntryInfo[] = [];
        for (const [key, entry] of storeMap) {
            if (!isExpired(entry, config)) {
                result.push({
                    key,
                    timestamp: entry.timestamp,
                    ttl: entry.ttl ?? config.defaultTtlMs,
                    size: estimateSize(entry.value),
                });
            }
        }
        const sorted = result.sort((a, b) => b.timestamp - a.timestamp);
        this.entriesCache.set(store, { version, value: sorted });
        return sorted;
    }

    entryCount(store: StoreName): number {
        return this.keys(store).length;
    }

    stats(): StoreStats {
        if (this.statsCache && this.statsCache.version === this.globalVersion) {
            return this.statsCache.value;
        }

        let totalEntries = 0;
        let totalSize = 0;
        const stores = {} as StoreStats['stores'];

        for (const name of STORE_NAMES) {
            const infos = this.entries(name);
            const storeSize = infos.reduce((sum, e) => sum + e.size, 0);
            const oldest = infos.length > 0 ? Math.min(...infos.map((e) => e.timestamp)) : null;
            stores[name] = { entries: infos.length, totalSize: storeSize, oldestTimestamp: oldest };
            totalEntries += infos.length;
            totalSize += storeSize;
        }

        const value: StoreStats = { stores, totalEntries, totalSize };
        this.statsCache = { version: this.globalVersion, value };
        return value;
    }

    // --- Subscribe ---

    subscribe(store: StoreName, key: string, callback: () => void): () => void {
        const storeListeners = this.listeners.get(store);
        if (!storeListeners) {
            return () => {};
        }
        let keyListeners = storeListeners.get(key);
        if (!keyListeners) {
            keyListeners = new Set();
            storeListeners.set(key, keyListeners);
        }
        const listeners = keyListeners;
        listeners.add(callback);
        return () => {
            listeners.delete(callback);
            if (listeners.size === 0) {
                storeListeners.delete(key);
            }
        };
    }

    /** Subscribe to all changes in a store (for admin UI). */
    subscribeStore(store: StoreName, callback: () => void): () => void {
        const storeListeners = this.listeners.get(store);
        if (!storeListeners) {
            return () => {};
        }
        const STORE_KEY = '__store__';
        let keyListeners = storeListeners.get(STORE_KEY);
        if (!keyListeners) {
            keyListeners = new Set();
            storeListeners.set(STORE_KEY, keyListeners);
        }
        const listeners = keyListeners;
        listeners.add(callback);
        return () => {
            listeners.delete(callback);
            if (listeners.size === 0) {
                storeListeners.delete(STORE_KEY);
            }
        };
    }

    // --- Debug ---

    dump(): Record<string, Record<string, unknown>> {
        const result: Record<string, Record<string, unknown>> = {};
        for (const name of STORE_NAMES) {
            const storeMap = this.memory.get(name);
            if (!storeMap) {
                continue;
            }
            const entries: Record<string, unknown> = {};
            for (const [key, entry] of storeMap) {
                entries[key] = entry.value;
            }
            result[name] = entries;
        }
        return result;
    }

    /** Export full state as JSON (for backup/debugging). */
    exportState(): string {
        const data: Record<string, Record<string, StoreEntry>> = {};
        for (const name of STORE_NAMES) {
            const storeMap = this.memory.get(name);
            if (!storeMap) {
                continue;
            }
            const entries: Record<string, StoreEntry> = {};
            for (const [key, entry] of storeMap) {
                entries[key] = entry;
            }
            if (Object.keys(entries).length > 0) {
                data[name] = entries;
            }
        }
        return JSON.stringify(data, null, 2);
    }

    /** Import state from a previously exported JSON string. */
    importState(json: string): void {
        let data: unknown;
        try {
            data = JSON.parse(json);
        } catch {
            throw new Error('importState: invalid JSON');
        }
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            throw new Error('importState: expected a JSON object');
        }
        for (const [storeName, entries] of Object.entries(data as Record<string, unknown>)) {
            if (!STORE_NAMES.includes(storeName as StoreName)) {
                continue;
            }
            if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) {
                continue;
            }
            const store = storeName as StoreName;
            for (const [key, entry] of Object.entries(entries as Record<string, unknown>)) {
                if (typeof entry !== 'object' || entry === null) {
                    continue;
                }
                const e = entry as Record<string, unknown>;
                if (!('value' in e)) {
                    continue;
                }
                this.set(store, key, e['value'], { ttl: typeof e['ttl'] === 'number' ? e['ttl'] : undefined });
            }
        }
    }

    // --- Internals ---

    private notify(store: StoreName, key: string): void {
        // Bump version counters to invalidate snapshot caches
        this.storeVersions.set(store, (this.storeVersions.get(store) ?? 0) + 1);
        this.globalVersion++;

        const storeListeners = this.listeners.get(store);
        if (!storeListeners) {
            return;
        }
        // Notify key-specific listeners
        const keyListeners = storeListeners.get(key);
        if (keyListeners) {
            for (const cb of keyListeners) {
                cb();
            }
        }
        // Notify store-wide listeners
        const storeWide = storeListeners.get('__store__');
        if (storeWide) {
            for (const cb of storeWide) {
                cb();
            }
        }
    }

    private evictOldest(store: StoreName, storeMap: Map<string, StoreEntry>, count: number): void {
        const sorted = [...storeMap.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
        for (let i = 0; i < count && i < sorted.length; i++) {
            const [key] = sorted[i];
            storeMap.delete(key);
            if (this.db) {
                idbDelete(this.db, store, key);
            }
        }
    }

    private clearLocalStoragePrefix(store: StoreName): void {
        try {
            const prefix = `${LS_PREFIX}${store}:`;
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k?.startsWith(prefix)) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
        } catch { /* ignore */ }
    }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const stateService = new StateService();
