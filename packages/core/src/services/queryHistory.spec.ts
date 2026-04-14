import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    InMemoryQueryHistoryStore,
    normalizeQuery,
    getHistory,
    saveHistoryEntry,
    recallResult,
    deleteHistoryEntry,
    clearHistory,
} from './queryHistory';
import type { QueryHistoryEntry } from './queryHistory';

function makeEntry(overrides: Partial<QueryHistoryEntry> = {}): QueryHistoryEntry {
    return {
        key: normalizeQuery(overrides.query ?? 'SELECT 1'),
        query: 'SELECT 1',
        timestamp: Date.now(),
        elapsed: 100,
        rowCount: 1,
        columnCount: 1,
        status: 'success',
        ...overrides,
    };
}

describe('normalizeQuery', () => {
    it('trims leading and trailing whitespace', () => {
        expect(normalizeQuery('  hello  ')).toBe('hello');
    });

    it('collapses internal whitespace', () => {
        expect(normalizeQuery('select   *   from   table')).toBe('select * from table');
    });

    it('handles tabs and newlines', () => {
        expect(normalizeQuery('select\n\t*\n\tfrom\ttable')).toBe('select * from table');
    });

    it('returns empty string for whitespace-only input', () => {
        expect(normalizeQuery('   ')).toBe('');
    });
});

describe('InMemoryQueryHistoryStore', () => {
    let store: InMemoryQueryHistoryStore;

    beforeEach(() => {
        store = new InMemoryQueryHistoryStore();
    });

    describe('save and getAll', () => {
        it('starts empty', async () => {
            const entries = await store.getAll();
            expect(entries).toEqual([]);
        });

        it('saves and retrieves an entry', async () => {
            const entry = makeEntry({ query: 'test query', key: 'test query' });
            await store.save(entry);

            const entries = await store.getAll();
            expect(entries).toHaveLength(1);
            expect(entries[0].query).toBe('test query');
        });

        it('returns entries sorted by timestamp descending', async () => {
            await store.save(makeEntry({ key: 'q1', query: 'q1', timestamp: 100 }));
            await store.save(makeEntry({ key: 'q2', query: 'q2', timestamp: 300 }));
            await store.save(makeEntry({ key: 'q3', query: 'q3', timestamp: 200 }));

            const entries = await store.getAll();
            expect(entries.map((e) => e.key)).toEqual(['q2', 'q3', 'q1']);
        });

        it('updates an existing entry by key', async () => {
            await store.save(makeEntry({ key: 'same-key', query: 'original', timestamp: 100 }));
            await store.save(makeEntry({ key: 'same-key', query: 'updated', timestamp: 200 }));

            const entries = await store.getAll();
            expect(entries).toHaveLength(1);
            expect(entries[0].query).toBe('updated');
        });
    });

    describe('maxEntries eviction', () => {
        it('evicts oldest entries when exceeding max (50)', async () => {
            // Save 52 entries
            for (let i = 0; i < 52; i++) {
                await store.save(makeEntry({
                    key: `query-${i}`,
                    query: `query-${i}`,
                    timestamp: i,
                }));
            }

            const entries = await store.getAll();
            expect(entries).toHaveLength(50);

            // The two oldest (timestamp 0 and 1) should be evicted
            const keys = entries.map((e) => e.key);
            expect(keys).not.toContain('query-0');
            expect(keys).not.toContain('query-1');
            expect(keys).toContain('query-2');
            expect(keys).toContain('query-51');
        });
    });

    describe('delete', () => {
        it('deletes an entry by key', async () => {
            await store.save(makeEntry({ key: 'to-delete', query: 'to-delete' }));
            await store.save(makeEntry({ key: 'to-keep', query: 'to-keep' }));

            await store.delete('to-delete');

            const entries = await store.getAll();
            expect(entries).toHaveLength(1);
            expect(entries[0].key).toBe('to-keep');
        });

        it('is a no-op for non-existent key', async () => {
            await store.save(makeEntry({ key: 'exists', query: 'exists' }));
            await store.delete('non-existent');

            const entries = await store.getAll();
            expect(entries).toHaveLength(1);
        });
    });

    describe('clear', () => {
        it('removes all entries', async () => {
            await store.save(makeEntry({ key: 'a', query: 'a' }));
            await store.save(makeEntry({ key: 'b', query: 'b' }));

            await store.clear();

            const entries = await store.getAll();
            expect(entries).toEqual([]);
        });
    });

    describe('recall', () => {
        it('returns a matching success entry with rows and columns', async () => {
            const entry = makeEntry({
                key: 'recall query',
                query: '  recall   query  ',
                status: 'success',
                columns: ['Col1'],
                rows: [{ Col1: 'val' }],
            });
            await store.save(entry);

            const recalled = await store.recall('  recall   query  ');
            expect(recalled).not.toBeNull();
            expect(recalled?.key).toBe('recall query');
        });

        it('returns null for non-existent query', async () => {
            const recalled = await store.recall('missing');
            expect(recalled).toBeNull();
        });

        it('returns null for error entries', async () => {
            await store.save(makeEntry({
                key: 'error query',
                query: 'error query',
                status: 'error',
                columns: ['A'],
                rows: [{ A: 1 }],
            }));

            const recalled = await store.recall('error query');
            expect(recalled).toBeNull();
        });

        it('returns null for success entries without rows', async () => {
            await store.save(makeEntry({
                key: 'no rows',
                query: 'no rows',
                status: 'success',
                columns: ['A'],
            }));

            const recalled = await store.recall('no rows');
            expect(recalled).toBeNull();
        });

        it('returns null for success entries without columns', async () => {
            await store.save(makeEntry({
                key: 'no cols',
                query: 'no cols',
                status: 'success',
                rows: [{ A: 1 }],
            }));

            const recalled = await store.recall('no cols');
            expect(recalled).toBeNull();
        });

        it('normalizes query before lookup', async () => {
            await store.save(makeEntry({
                key: 'table | take 10',
                query: 'table | take 10',
                status: 'success',
                columns: ['Col'],
                rows: [{ Col: 'v' }],
            }));

            const recalled = await store.recall('  table   |   take   10  ');
            expect(recalled).not.toBeNull();
        });
    });
});

// --- Mock StateService for public API tests ---

const mockExplorerCache = new Map<string, unknown>();
vi.mock('./state-service', () => ({
    stateService: {
        get: (_s: string, key: string) => mockExplorerCache.get(key) ?? null,
        set: (_s: string, key: string, value: unknown) => { mockExplorerCache.set(key, value); },
        delete: (_s: string, key: string) => { mockExplorerCache.delete(key); },
        clear: (_s: string) => { mockExplorerCache.clear(); },
        keys: () => [...mockExplorerCache.keys()],
        subscribe: () => () => {},
    },
}));

describe('Public API (delegates to StateService store)', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockExplorerCache.clear();
    });

    it('getHistory returns entries from store', async () => {
        const entries = await getHistory();
        expect(Array.isArray(entries)).toBe(true);
    });

    it('saveHistoryEntry writes to store', async () => {
        const entry = makeEntry({ key: 'pub-save', query: 'pub-save' });
        await saveHistoryEntry(entry);
        expect(mockExplorerCache.has('pub-save')).toBe(true);
    });

    it('recallResult returns null for non-existent query', async () => {
        const result = await recallResult('nonexistent');
        expect(result).toBeNull();
    });

    it('recallResult returns matching success entry', async () => {
        const entry = makeEntry({
            key: 'recall test',
            query: 'recall test',
            status: 'success',
            columns: ['Col1'],
            rows: [{ Col1: 'value' }],
        });
        await saveHistoryEntry(entry);
        const result = await recallResult('recall test');
        expect(result).not.toBeNull();
        expect(result?.key).toBe('recall test');
    });

    it('triggers eviction when exceeding MAX_HISTORY', async () => {
        for (let i = 0; i < 51; i++) {
            await saveHistoryEntry(makeEntry({ key: `key-${String(i)}`, query: `query ${String(i)}`, timestamp: i }));
        }
        // Should have evicted the oldest, keeping 50
        expect(mockExplorerCache.size).toBeLessThanOrEqual(50);
    });

    it('deleteHistoryEntry removes from store', async () => {
        const entry = makeEntry({ key: 'del-key', query: 'del-key' });
        await saveHistoryEntry(entry);
        await deleteHistoryEntry('del-key');
        expect(mockExplorerCache.has('del-key')).toBe(false);
    });

    it('clearHistory empties store', async () => {
        await saveHistoryEntry(makeEntry({ key: 'a', query: 'a' }));
        await saveHistoryEntry(makeEntry({ key: 'b', query: 'b' }));
        await clearHistory();
        expect(mockExplorerCache.size).toBe(0);
    });
});
