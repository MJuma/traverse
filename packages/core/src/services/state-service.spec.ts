import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateService, STORE_NAMES } from './state-service';
import type { StoreEntry } from './state-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
        removeItem: (key: string) => { store.delete(key); },
        clear: () => store.clear(),
        get length() { return store.size; },
        key: (index: number) => [...store.keys()][index] ?? null,
    };
}

// Stub IndexedDB as unavailable by default — tests that need IDB override this
function stubIDBUnavailable(): void {
    vi.stubGlobal('indexedDB', {
        open: () => {
            const req = { onerror: null as (() => void) | null, onsuccess: null as (() => void) | null, onupgradeneeded: null as (() => void) | null };
            queueMicrotask(() => req.onerror?.());
            return req;
        },
    });
}

describe('StateService', () => {
    let mockLS: Storage;

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockLS = createMockLocalStorage();
        vi.stubGlobal('localStorage', mockLS);
        stubIDBUnavailable();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe('constructor', () => {
        it('initializes all store maps', () => {
            const svc = new StateService();
            for (const name of STORE_NAMES) {
                expect(svc.keys(name)).toEqual([]);
            }
        });

        it('bootstraps config from localStorage', () => {
            const entry: StoreEntry = { value: 'dark', timestamp: Date.now() };
            mockLS.setItem('traverse-state:config:theme', JSON.stringify(entry));
            const svc = new StateService();
            expect(svc.get('config', 'theme')).toBe('dark');
        });

        it('bootstraps explorerConnections from localStorage', () => {
            const entry: StoreEntry = { value: [{ name: 'test' }], timestamp: Date.now() };
            mockLS.setItem('traverse-state:explorerConnections:list', JSON.stringify(entry));
            const svc = new StateService();
            expect(svc.get<{ name: string }[]>('explorerConnections', 'list')).toEqual([{ name: 'test' }]);
        });

        it('skips expired bootstrap entries', () => {
            const entry: StoreEntry = { value: 'old', timestamp: Date.now() - 999999999, ttl: 1 };
            mockLS.setItem('traverse-state:config:stale', JSON.stringify(entry));
            const svc = new StateService();
            expect(svc.get('config', 'stale')).toBeNull();
        });

        it('handles corrupt localStorage entries gracefully', () => {
            mockLS.setItem('traverse-state:config:corrupt', 'not-json{{{');
            const svc = new StateService();
            expect(svc.get('config', 'corrupt')).toBeNull();
        });

        it('handles inaccessible localStorage gracefully', () => {
            vi.stubGlobal('localStorage', {
                get length() { throw new Error('blocked'); },
                key: () => null,
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
                clear: () => {},
            });
            expect(() => new StateService()).not.toThrow();
        });
    });

    describe('get / set', () => {
        it('returns null for missing key', () => {
            const svc = new StateService();
            expect(svc.get('config', 'missing')).toBeNull();
        });

        it('stores and retrieves a value', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            expect(svc.get('config', 'theme')).toBe('dark');
        });

        it('stores complex objects', () => {
            const svc = new StateService();
            const data = { columns: ['a'], rows: [{ a: 1 }] };
            svc.set('queryCache', 'q1', data);
            expect(svc.get('queryCache', 'q1')).toEqual(data);
        });

        it('overwrites existing value', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            svc.set('config', 'theme', 'light');
            expect(svc.get('config', 'theme')).toBe('light');
        });
    });

    describe('has', () => {
        it('returns false for missing key', () => {
            const svc = new StateService();
            expect(svc.has('config', 'missing')).toBe(false);
        });

        it('returns true for existing key', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            expect(svc.has('config', 'theme')).toBe(true);
        });
    });

    describe('TTL expiration', () => {
        it('evicts expired entries on read (queryCache)', () => {
            vi.useFakeTimers();
            try {
                const svc = new StateService();
                svc.set('queryCache', 'q1', { data: 1 });
                expect(svc.get('queryCache', 'q1')).toEqual({ data: 1 });
                // Advance past 15 min TTL
                vi.advanceTimersByTime(16 * 60 * 1000);
                expect(svc.get('queryCache', 'q1')).toBeNull();
            } finally {
                vi.useRealTimers();
            }
        });

        it('evicts expired entries on read (queryCache)', () => {
            vi.useFakeTimers();
            try {
                const svc = new StateService();
                svc.set('queryCache', 'q1', { rows: [1, 2, 3] });
                expect(svc.get('queryCache', 'q1')).toEqual({ rows: [1, 2, 3] });
                // Advance past 15 min TTL
                vi.advanceTimersByTime(16 * 60 * 1000);
                expect(svc.get('queryCache', 'q1')).toBeNull();
            } finally {
                vi.useRealTimers();
            }
        });

        it('respects per-entry TTL override', () => {
            vi.useFakeTimers();
            try {
                const svc = new StateService();
                svc.set('queryCache', 'short', 'data', { ttl: 1000 });
                expect(svc.get('queryCache', 'short')).toBe('data');
                vi.advanceTimersByTime(2000);
                expect(svc.get('queryCache', 'short')).toBeNull();
            } finally {
                vi.useRealTimers();
            }
        });

        it('config entries never expire by default', () => {
            vi.useFakeTimers();
            try {
                const svc = new StateService();
                svc.set('config', 'theme', 'dark');
                vi.advanceTimersByTime(365 * 24 * 60 * 60 * 1000); // 1 year
                expect(svc.get('config', 'theme')).toBe('dark');
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe('max entries eviction', () => {
        it('evicts oldest entries when explorerCache exceeds 200', () => {
            const svc = new StateService();
            // Fill with 200 entries
            for (let i = 0; i < 200; i++) {
                svc.set('explorerCache', `q${i}`, { n: i });
            }
            expect(svc.entryCount('explorerCache')).toBe(200);

            // Adding one more should evict the oldest
            svc.set('explorerCache', 'q200', { n: 200 });
            expect(svc.entryCount('explorerCache')).toBe(200);
            expect(svc.get('explorerCache', 'q200')).toEqual({ n: 200 });
            // q0 was the oldest and should be evicted
            expect(svc.get('explorerCache', 'q0')).toBeNull();
        });
    });

    describe('delete', () => {
        it('removes an existing entry', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            svc.delete('config', 'theme');
            expect(svc.get('config', 'theme')).toBeNull();
        });

        it('removes localStorage bootstrap key', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            expect(mockLS.getItem('traverse-state:config:theme')).not.toBeNull();
            svc.delete('config', 'theme');
            expect(mockLS.getItem('traverse-state:config:theme')).toBeNull();
        });

        it('does nothing for missing key', () => {
            const svc = new StateService();
            expect(() => svc.delete('config', 'nonexistent')).not.toThrow();
        });
    });

    describe('clear', () => {
        it('removes all entries in a store', () => {
            const svc = new StateService();
            svc.set('queryCache', 'q1', 'a');
            svc.set('queryCache', 'q2', 'b');
            svc.set('config', 'theme', 'dark'); // other store untouched
            svc.clear('queryCache');
            expect(svc.keys('queryCache')).toEqual([]);
            expect(svc.get('config', 'theme')).toBe('dark');
        });

        it('clears localStorage bootstrap keys', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            svc.set('config', 'model', 'opus');
            mockLS.setItem('unrelated', 'keep');
            svc.clear('config');
            expect(mockLS.getItem('traverse-state:config:theme')).toBeNull();
            expect(mockLS.getItem('traverse-state:config:model')).toBeNull();
            expect(mockLS.getItem('unrelated')).toBe('keep');
        });

        it('does nothing on empty store', () => {
            const svc = new StateService();
            expect(() => svc.clear('queryCache')).not.toThrow();
        });
    });

    describe('keys / entries / entryCount', () => {
        it('returns keys for a store', () => {
            const svc = new StateService();
            svc.set('config', 'a', 1);
            svc.set('config', 'b', 2);
            expect(svc.keys('config').sort()).toEqual(['a', 'b']);
        });

        it('excludes expired entries from keys()', () => {
            vi.useFakeTimers();
            try {
                const svc = new StateService();
                svc.set('queryCache', 'fresh', 'ok');
                svc.set('queryCache', 'stale', 'old', { ttl: 1 });
                vi.advanceTimersByTime(100);
                expect(svc.keys('queryCache')).toEqual(['fresh']);
            } finally {
                vi.useRealTimers();
            }
        });

        it('entries() returns sorted by timestamp descending', () => {
            vi.useFakeTimers();
            try {
                const svc = new StateService();
                svc.set('config', 'first', 'a');
                vi.advanceTimersByTime(100);
                svc.set('config', 'second', 'b');
                const entries = svc.entries('config');
                expect(entries[0].key).toBe('second'); // newest first
                expect(entries[1].key).toBe('first');
            } finally {
                vi.useRealTimers();
            }
        });

        it('entries() includes size estimates', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            const entries = svc.entries('config');
            expect(entries[0].size).toBeGreaterThan(0);
        });

        it('entryCount() matches keys length', () => {
            const svc = new StateService();
            svc.set('config', 'a', 1);
            svc.set('config', 'b', 2);
            expect(svc.entryCount('config')).toBe(2);
        });
    });

    describe('stats', () => {
        it('returns aggregate statistics', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            svc.set('queryCache', 'q1', { data: [1, 2, 3] });
            const s = svc.stats();
            expect(s.totalEntries).toBe(2);
            expect(s.totalSize).toBeGreaterThan(0);
            expect(s.stores.config.entries).toBe(1);
            expect(s.stores.queryCache.entries).toBe(1);
            expect(s.stores.config.oldestTimestamp).not.toBeNull();
        });

        it('returns zero stats for empty service', () => {
            const svc = new StateService();
            const s = svc.stats();
            expect(s.totalEntries).toBe(0);
            expect(s.totalSize).toBe(0);
            for (const name of STORE_NAMES) {
                expect(s.stores[name].entries).toBe(0);
                expect(s.stores[name].oldestTimestamp).toBeNull();
            }
        });

        it('returns cached stats on second call without changes', () => {
            const svc = new StateService();
            svc.set('config', 'x', 'hello');
            const s1 = svc.stats();
            const s2 = svc.stats();
            // Same reference because cache is hit
            expect(s1).toBe(s2);
        });

        it('invalidates stats cache after set', () => {
            const svc = new StateService();
            const s1 = svc.stats();
            svc.set('config', 'y', 'world');
            const s2 = svc.stats();
            expect(s2.totalEntries).toBe(1);
            expect(s1).not.toBe(s2);
        });

        it('entries returns cached result on second call', () => {
            const svc = new StateService();
            svc.set('config', 'a', 'value');
            const e1 = svc.entries('config');
            const e2 = svc.entries('config');
            expect(e1).toBe(e2);
        });
    });

    describe('subscribe', () => {
        it('notifies on set', () => {
            const svc = new StateService();
            const cb = vi.fn();
            svc.subscribe('config', 'theme', cb);
            svc.set('config', 'theme', 'dark');
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('notifies on delete', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            const cb = vi.fn();
            svc.subscribe('config', 'theme', cb);
            svc.delete('config', 'theme');
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('notifies on clear', () => {
            const svc = new StateService();
            svc.set('config', 'a', 1);
            svc.set('config', 'b', 2);
            const cbA = vi.fn();
            const cbB = vi.fn();
            svc.subscribe('config', 'a', cbA);
            svc.subscribe('config', 'b', cbB);
            svc.clear('config');
            expect(cbA).toHaveBeenCalledTimes(1);
            expect(cbB).toHaveBeenCalledTimes(1);
        });

        it('does not notify other stores', () => {
            const svc = new StateService();
            const cb = vi.fn();
            svc.subscribe('config', 'theme', cb);
            svc.set('queryCache', 'q1', 'data');
            expect(cb).not.toHaveBeenCalled();
        });

        it('does not notify other keys', () => {
            const svc = new StateService();
            const cb = vi.fn();
            svc.subscribe('config', 'theme', cb);
            svc.set('config', 'model', 'opus');
            expect(cb).not.toHaveBeenCalled();
        });

        it('unsubscribe stops notifications', () => {
            const svc = new StateService();
            const cb = vi.fn();
            const unsub = svc.subscribe('config', 'theme', cb);
            svc.set('config', 'theme', 'dark');
            expect(cb).toHaveBeenCalledTimes(1);
            unsub();
            svc.set('config', 'theme', 'light');
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('subscribeStore notifies on any key change', () => {
            const svc = new StateService();
            const cb = vi.fn();
            svc.subscribeStore('config', cb);
            svc.set('config', 'theme', 'dark');
            svc.set('config', 'model', 'opus');
            expect(cb).toHaveBeenCalledTimes(2);
        });

        it('subscribeStore unsubscribe works', () => {
            const svc = new StateService();
            const cb = vi.fn();
            const unsub = svc.subscribeStore('config', cb);
            svc.set('config', 'theme', 'dark');
            expect(cb).toHaveBeenCalledTimes(1);
            unsub();
            svc.set('config', 'theme', 'light');
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('subscribe cleanup removes empty listener maps', () => {
            const svc = new StateService();
            const cb = vi.fn();
            const unsub = svc.subscribe('config', 'only-key', cb);
            svc.set('config', 'only-key', 'test');
            expect(cb).toHaveBeenCalledTimes(1);
            unsub();
            // After unsubscribe, the listener map for 'only-key' should be cleaned up
            svc.set('config', 'only-key', 'test2');
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('subscribeStore cleanup removes empty listener maps', () => {
            const svc = new StateService();
            const cb = vi.fn();
            const unsub = svc.subscribeStore('queryCache', cb);
            svc.set('queryCache', 'q1', 'test');
            expect(cb).toHaveBeenCalledTimes(1);
            unsub();
            svc.set('queryCache', 'q1', 'test2');
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('clear notifies listeners for all keys', () => {
            const svc = new StateService();
            const cb = vi.fn();
            svc.subscribeStore('config', cb);
            svc.set('config', 'a', '1');
            svc.set('config', 'b', '2');
            cb.mockClear();
            svc.clear('config');
            // Should notify for each cleared key
            expect(cb).toHaveBeenCalled();
        });

        it('delete notifies listeners', () => {
            const svc = new StateService();
            const cb = vi.fn();
            svc.subscribe('config', 'del-key', cb);
            svc.set('config', 'del-key', 'value');
            cb.mockClear();
            svc.delete('config', 'del-key');
            expect(cb).toHaveBeenCalledTimes(1);
        });
    });

    describe('sync bootstrap (config store)', () => {
        it('writes to localStorage on set', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            const raw = mockLS.getItem('traverse-state:config:theme');
            expect(raw).not.toBeNull();
            const parsed = JSON.parse(raw!);
            expect(parsed.value).toBe('dark');
        });

        it('does not write queryCache to localStorage', () => {
            const svc = new StateService();
            svc.set('queryCache', 'q1', 'data');
            const raw = mockLS.getItem('traverse-state:queryCache:q1');
            expect(raw).toBeNull();
        });
    });

    describe('exportState / importState', () => {
        it('round-trips state through export/import', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            svc.set('queryCache', 'q1', { rows: [1] });
            const json = svc.exportState();

            const svc2 = new StateService();
            svc2.importState(json);
            expect(svc2.get('config', 'theme')).toBe('dark');
            expect(svc2.get('queryCache', 'q1')).toEqual({ rows: [1] });
        });

        it('export produces valid JSON', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            const json = svc.exportState();
            expect(() => JSON.parse(json)).not.toThrow();
        });

        it('import ignores unknown store names', () => {
            const svc = new StateService();
            expect(() => svc.importState('{"unknownStore":{"k":{"value":1,"timestamp":0}}}')).not.toThrow();
        });

        it('importState throws on invalid JSON', () => {
            const svc = new StateService();
            expect(() => svc.importState('not-json')).toThrow('invalid JSON');
        });

        it('importState throws on non-object JSON', () => {
            const svc = new StateService();
            expect(() => svc.importState('"just a string"')).toThrow('expected a JSON object');
            expect(() => svc.importState('[1,2,3]')).toThrow('expected a JSON object');
            expect(() => svc.importState('null')).toThrow('expected a JSON object');
        });

        it('importState skips entries without value field', () => {
            const svc = new StateService();
            svc.importState('{"config":{"k":{"noValue":true}}}');
            expect(svc.get('config', 'k')).toBeNull();
        });

        it('importState skips non-object entries', () => {
            const svc = new StateService();
            svc.importState('{"config":{"k":"not-an-object"}}');
            expect(svc.get('config', 'k')).toBeNull();
        });

        it('importState skips non-object store values', () => {
            const svc = new StateService();
            svc.importState('{"config":"not-an-object"}');
            expect(svc.entryCount('config')).toBe(0);
        });

        it('export skips empty stores', () => {
            const svc = new StateService();
            const json = svc.exportState();
            const parsed = JSON.parse(json);
            expect(Object.keys(parsed)).toHaveLength(0);
        });
    });

    describe('dump', () => {
        it('returns all values without metadata', () => {
            const svc = new StateService();
            svc.set('config', 'theme', 'dark');
            svc.set('config', 'model', 'opus');
            const d = svc.dump();
            expect(d['config']).toEqual({ theme: 'dark', model: 'opus' });
        });
    });

    describe('hydrate (without real IndexedDB)', () => {
        it('sets hydrated flag', async () => {
            const svc = new StateService();
            expect(svc.hydrated).toBe(false);
            await svc.hydrate();
            expect(svc.hydrated).toBe(true);
        });

        it('calling hydrate twice returns the same promise', () => {
            const svc = new StateService();
            const p1 = svc.hydrate();
            const p2 = svc.hydrate();
            expect(p1).toBe(p2);
        });

        it('does not throw when IndexedDB is unavailable', async () => {
            const svc = new StateService();
            await expect(svc.hydrate()).resolves.toBeUndefined();
        });
    });

    describe('hydrate with mocked IndexedDB', () => {
        it('persists to IDB after hydration', async () => {
            const idbEntry = { value: 'from-idb', timestamp: Date.now() };
            const expiredEntry = { value: 'old', timestamp: 1, ttl: 1 };
            let cursorIdx = 0;
            const cursorData = [
                { key: 'hydrated-key', value: idbEntry },
                { key: 'expired-key', value: expiredEntry },
            ];
            const mockObjectStore = {
                put: vi.fn(() => ({ onsuccess: null, onerror: null })),
                delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
                clear: vi.fn(() => ({ onsuccess: null, onerror: null })),
                openCursor: vi.fn(() => {
                    cursorIdx = 0;
                    const entry = cursorData[cursorIdx];
                    const req = {
                        result: entry ? { key: entry.key, value: entry.value, continue: () => {
                            cursorIdx++;
                            req.result = cursorData[cursorIdx] ? { key: cursorData[cursorIdx].key, value: cursorData[cursorIdx].value, continue: () => { cursorIdx++; req.result = null; setTimeout(() => req.onsuccess?.(), 0); } } : null;
                            setTimeout(() => req.onsuccess?.(), 0);
                        } } : null,
                        onsuccess: null as (() => void) | null,
                        onerror: null,
                    };
                    setTimeout(() => req.onsuccess?.(), 0);
                    return req;
                }),
            };
            const mockDb = {
                objectStoreNames: { contains: vi.fn(() => false) },
                createObjectStore: vi.fn(() => ({ createIndex: vi.fn() })),
                transaction: vi.fn(() => {
                    const tx = {
                        objectStore: vi.fn(() => mockObjectStore),
                        oncomplete: null as (() => void) | null,
                        onerror: null,
                    };
                    setTimeout(() => tx.oncomplete?.(), 10);
                    return tx;
                }),
                close: vi.fn(),
            };
            const mockOpenReq = {
                result: mockDb,
                onsuccess: null as (() => void) | null,
                onerror: null as (() => void) | null,
                onupgradeneeded: null as (() => void) | null,
                error: null,
            };
            vi.stubGlobal('indexedDB', {
                open: vi.fn(() => {
                    setTimeout(() => {
                        mockOpenReq.onupgradeneeded?.();
                        mockOpenReq.onsuccess?.();
                    }, 0);
                    return mockOpenReq;
                }),
            });

            mockLS.setItem('traverse-state:config:theme', JSON.stringify({ value: 'dark', timestamp: Date.now() }));

            const svc = new StateService();
            await svc.hydrate();

            svc.set('queryCache', 'q1', 'data');
            svc.delete('queryCache', 'q1');
            svc.set('queryCache', 'q2', 'data2');
            svc.clear('queryCache');

            vi.unstubAllGlobals();
        });
    });
});
