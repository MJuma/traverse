const MAX_HISTORY = 50;
const STORE_NAME = 'explorerCache' as const;

import { stateService } from './state-service';

export interface QueryHistoryEntry {
    /** Normalized query text (trimmed, collapsed whitespace) used as the key */
    key: string;
    /** Original query text as written */
    query: string;
    timestamp: number;
    elapsed: number | null;
    rowCount: number | null;
    columnCount: number;
    status: 'success' | 'error';
    error?: string;
    /** Stored result columns for Recall */
    columns?: string[];
    /** Stored result rows for Recall */
    rows?: Record<string, unknown>[];
}

export function normalizeQuery(query: string): string {
    return query.trim().replace(/\s+/g, ' ');
}

// --- Store interface (injectable for testing) ---

export interface IQueryHistoryStore {
    getAll(): Promise<QueryHistoryEntry[]>;
    save(entry: QueryHistoryEntry): Promise<void>;
    recall(query: string): Promise<QueryHistoryEntry | null>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
}

// --- StateService-backed implementation ---

class StateServiceQueryHistoryStore implements IQueryHistoryStore {
    async getAll(): Promise<QueryHistoryEntry[]> {
        const keys = stateService.keys(STORE_NAME);
        const entries: QueryHistoryEntry[] = [];
        for (const key of keys) {
            const entry = stateService.get<QueryHistoryEntry>(STORE_NAME, key);
            if (entry) {
                entries.push(entry);
            }
        }
        return entries.sort((a, b) => b.timestamp - a.timestamp);
    }

    async save(entry: QueryHistoryEntry): Promise<void> {
        stateService.set(STORE_NAME, entry.key, entry);

        // Evict oldest beyond MAX_HISTORY
        const all = await this.getAll();
        if (all.length > MAX_HISTORY) {
            const toRemove = all.slice(MAX_HISTORY);
            for (const e of toRemove) {
                stateService.delete(STORE_NAME, e.key);
            }
        }
    }

    async recall(query: string): Promise<QueryHistoryEntry | null> {
        const key = normalizeQuery(query);
        const entry = stateService.get<QueryHistoryEntry>(STORE_NAME, key);
        if (entry?.status === 'success' && entry.rows && entry.columns) {
            return entry;
        }
        return null;
    }

    async delete(key: string): Promise<void> {
        stateService.delete(STORE_NAME, key);
    }

    async clear(): Promise<void> {
        stateService.clear(STORE_NAME);
    }
}

// --- In-memory implementation (for testing) ---

export class InMemoryQueryHistoryStore implements IQueryHistoryStore {
    private entries = new Map<string, QueryHistoryEntry>();

    async getAll(): Promise<QueryHistoryEntry[]> {
        return [...this.entries.values()].sort((a, b) => b.timestamp - a.timestamp);
    }

    async save(entry: QueryHistoryEntry): Promise<void> {
        this.entries.set(entry.key, entry);
        // Evict oldest beyond MAX_HISTORY
        if (this.entries.size > MAX_HISTORY) {
            const sorted = [...this.entries.entries()].sort(([, a], [, b]) => a.timestamp - b.timestamp);
            const excess = sorted.length - MAX_HISTORY;
            for (let i = 0; i < excess; i++) {
                this.entries.delete(sorted[i][0]);
            }
        }
    }

    async recall(query: string): Promise<QueryHistoryEntry | null> {
        const key = normalizeQuery(query);
        const entry = this.entries.get(key);
        if (entry?.status === 'success' && entry.rows && entry.columns) {
            return entry;
        }
        return null;
    }

    async delete(key: string): Promise<void> {
        this.entries.delete(key);
    }

    async clear(): Promise<void> {
        this.entries.clear();
    }
}

// --- Singleton store instance ---

const store: IQueryHistoryStore = new StateServiceQueryHistoryStore();

// --- Public API (backward-compatible, delegates to store) ---

export function getHistory(): Promise<QueryHistoryEntry[]> {
    return store.getAll();
}

export function saveHistoryEntry(entry: QueryHistoryEntry): Promise<void> {
    return store.save(entry);
}

export function recallResult(query: string): Promise<QueryHistoryEntry | null> {
    return store.recall(query);
}

export function deleteHistoryEntry(key: string): Promise<void> {
    return store.delete(key);
}

export function clearHistory(): Promise<void> {
    return store.clear();
}
