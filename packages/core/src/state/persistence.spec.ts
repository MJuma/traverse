import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStore = new Map<string, unknown>();

vi.mock('../services/state-service', () => ({
    stateService: {
        get: (_store: string, key: string) => mockStore.get(key) ?? null,
        set: (_store: string, key: string, value: unknown) => { mockStore.set(key, value); },
        delete: (_store: string, key: string) => { mockStore.delete(key); },
        subscribe: () => () => {},
    },
}));

import {
    SNAPSHOT_VERSION,
    loadSnapshot,
    saveSnapshot,
    clearSnapshot,
    extractSnapshot,
    validateAndCleanSnapshot,
} from './persistence';
import type { ExplorerTabsSnapshot } from './persistence';
import type { ExplorerState } from './types';
import type { KustoConnection, QueryTab } from '../components/ExplorerWorkspace/ExplorerWorkspace.logic';

const conn = (id: string): KustoConnection => ({
    id, name: id, clusterUrl: `https://${id}.kusto.windows.net`, database: 'Db', color: '#000',
});

const tab = (id: string, connectionId = 'conn-1', kql = ''): QueryTab => ({
    id, title: `Title ${id}`, kql, connectionId,
});

const baseSnapshot: ExplorerTabsSnapshot = {
    version: SNAPSHOT_VERSION,
    tabs: [tab('tab-1'), tab('tab-2')],
    activeTabId: 'tab-1',
    splitEnabled: false,
    splitDirection: 'vertical',
    splitTabId: null,
    focusedPane: 'primary',
};

describe('persistence', () => {
    beforeEach(() => { mockStore.clear(); });

    describe('saveSnapshot / loadSnapshot', () => {
        it('round-trips a valid snapshot', () => {
            saveSnapshot(baseSnapshot);
            expect(loadSnapshot()).toEqual(baseSnapshot);
        });

        it('returns null when no snapshot exists', () => {
            expect(loadSnapshot()).toBeNull();
        });

        it('returns null for snapshot with wrong version', () => {
            saveSnapshot({ ...baseSnapshot, version: SNAPSHOT_VERSION + 1 });
            expect(loadSnapshot()).toBeNull();
        });

        it('returns null when the persisted value is malformed', () => {
            mockStore.set('snapshot', { foo: 'bar' });
            expect(loadSnapshot()).toBeNull();
        });

        it('returns null for snapshot with non-array tabs', () => {
            mockStore.set('snapshot', { ...baseSnapshot, tabs: 'oops' });
            expect(loadSnapshot()).toBeNull();
        });

        it('returns null when a tab has the wrong shape', () => {
            mockStore.set('snapshot', { ...baseSnapshot, tabs: [{ id: 1, title: 't', kql: '', connectionId: '' }] });
            expect(loadSnapshot()).toBeNull();
        });

        it('returns null for invalid splitDirection', () => {
            mockStore.set('snapshot', { ...baseSnapshot, splitDirection: 'diagonal' });
            expect(loadSnapshot()).toBeNull();
        });

        it('returns null for invalid focusedPane', () => {
            mockStore.set('snapshot', { ...baseSnapshot, focusedPane: 'tertiary' });
            expect(loadSnapshot()).toBeNull();
        });

        it('returns null for non-string activeTabId', () => {
            mockStore.set('snapshot', { ...baseSnapshot, activeTabId: 123 });
            expect(loadSnapshot()).toBeNull();
        });

        it('returns null for non-boolean splitEnabled', () => {
            mockStore.set('snapshot', { ...baseSnapshot, splitEnabled: 'yes' });
            expect(loadSnapshot()).toBeNull();
        });

        it('accepts splitTabId as a string', () => {
            const snap = { ...baseSnapshot, splitEnabled: true, splitTabId: 'tab-2' };
            saveSnapshot(snap);
            expect(loadSnapshot()).toEqual(snap);
        });

        it('rejects splitTabId of the wrong type', () => {
            mockStore.set('snapshot', { ...baseSnapshot, splitTabId: 42 });
            expect(loadSnapshot()).toBeNull();
        });
    });

    describe('clearSnapshot', () => {
        it('removes a saved snapshot', () => {
            saveSnapshot(baseSnapshot);
            clearSnapshot();
            expect(loadSnapshot()).toBeNull();
        });
    });

    describe('extractSnapshot', () => {
        it('pulls only the persisted slices from full ExplorerState', () => {
            const state = {
                connections: [conn('conn-1')],
                tabs: [tab('tab-1')],
                activeTabId: 'tab-1',
                splitEnabled: true,
                splitDirection: 'horizontal' as const,
                splitTabId: 'tab-2',
                focusedPane: 'secondary' as const,
                // ...everything else, ignored:
                schema: [], schemaSearch: '', expandedFolders: new Set<string>(),
                expandedTables: new Set<string>(), schemaContextMenu: null,
                loading: false, error: null, queryStartTime: null, runningQueryKey: null,
                rows: null, columns: [], columnTypes: {}, elapsed: null, resultTime: null,
                queryStats: null, resultSets: [], activeResultSet: 0, resultsTab: 'results' as const,
                history: [], editorHeight: 50, hasSelection: false, canRecall: false,
            } satisfies ExplorerState;

            expect(extractSnapshot(state)).toEqual({
                version: SNAPSHOT_VERSION,
                tabs: [tab('tab-1')],
                activeTabId: 'tab-1',
                splitEnabled: true,
                splitDirection: 'horizontal',
                splitTabId: 'tab-2',
                focusedPane: 'secondary',
            });
        });
    });

    describe('validateAndCleanSnapshot', () => {
        it('returns null when the snapshot has no tabs', () => {
            const result = validateAndCleanSnapshot({ ...baseSnapshot, tabs: [] }, [conn('conn-1')], 'conn-1');
            expect(result).toBeNull();
        });

        it('passes through a fully valid snapshot unchanged', () => {
            const conns = [conn('conn-1')];
            const result = validateAndCleanSnapshot(baseSnapshot, conns, 'conn-1');
            expect(result).toEqual(baseSnapshot);
        });

        it('remaps tabs whose connectionId is missing to the fallback', () => {
            const conns = [conn('conn-1')];
            const snap: ExplorerTabsSnapshot = {
                ...baseSnapshot,
                tabs: [tab('tab-1', 'gone'), tab('tab-2', 'conn-1')],
            };
            const result = validateAndCleanSnapshot(snap, conns, 'conn-1');
            expect(result?.tabs[0].connectionId).toBe('conn-1');
            expect(result?.tabs[1].connectionId).toBe('conn-1');
        });

        it('preserves kql when remapping a tab to the fallback connection', () => {
            const conns = [conn('conn-1')];
            const snap: ExplorerTabsSnapshot = {
                ...baseSnapshot,
                tabs: [tab('tab-1', 'gone', 'MyTable | take 1')],
            };
            const result = validateAndCleanSnapshot(snap, conns, 'conn-1');
            expect(result?.tabs[0].kql).toBe('MyTable | take 1');
        });

        it('resets activeTabId to the first tab when it is missing', () => {
            const conns = [conn('conn-1')];
            const snap: ExplorerTabsSnapshot = {
                ...baseSnapshot,
                tabs: [tab('tab-1'), tab('tab-2')],
                activeTabId: 'tab-99',
            };
            const result = validateAndCleanSnapshot(snap, conns, 'conn-1');
            expect(result?.activeTabId).toBe('tab-1');
        });

        it('resets the split when splitTabId is not in the tab list', () => {
            const conns = [conn('conn-1')];
            const snap: ExplorerTabsSnapshot = {
                ...baseSnapshot,
                splitEnabled: true,
                splitTabId: 'tab-99',
                focusedPane: 'secondary',
            };
            const result = validateAndCleanSnapshot(snap, conns, 'conn-1');
            expect(result?.splitEnabled).toBe(false);
            expect(result?.splitTabId).toBeNull();
            expect(result?.focusedPane).toBe('primary');
        });

        it('resets the split when splitTabId equals activeTabId', () => {
            const conns = [conn('conn-1')];
            const snap: ExplorerTabsSnapshot = {
                ...baseSnapshot,
                splitEnabled: true,
                splitTabId: 'tab-1',
                activeTabId: 'tab-1',
                focusedPane: 'secondary',
            };
            const result = validateAndCleanSnapshot(snap, conns, 'conn-1');
            expect(result?.splitEnabled).toBe(false);
            expect(result?.splitTabId).toBeNull();
            expect(result?.focusedPane).toBe('primary');
        });

        it('keeps a valid split untouched', () => {
            const conns = [conn('conn-1')];
            const snap: ExplorerTabsSnapshot = {
                ...baseSnapshot,
                tabs: [tab('tab-1'), tab('tab-2')],
                activeTabId: 'tab-1',
                splitEnabled: true,
                splitTabId: 'tab-2',
                splitDirection: 'horizontal',
                focusedPane: 'secondary',
            };
            const result = validateAndCleanSnapshot(snap, conns, 'conn-1');
            expect(result?.splitEnabled).toBe(true);
            expect(result?.splitTabId).toBe('tab-2');
            expect(result?.splitDirection).toBe('horizontal');
            expect(result?.focusedPane).toBe('secondary');
        });
    });
});
