/**
 * Persistence helpers for the Explorer's tab/split state.
 *
 * Snapshots are written to the `explorerTabs` store on the shared
 * StateService. That store is configured with `syncBootstrap: true`,
 * which mirrors writes to localStorage so the snapshot is available
 * synchronously on the next page load (no flash of the default tab).
 *
 * The snapshot is versioned. When the persisted shape changes in a
 * non-backward-compatible way, bump SNAPSHOT_VERSION; older snapshots
 * are then ignored and the Explorer falls back to its default
 * initialization path.
 */

import type { QueryTab, KustoConnection } from '../components/ExplorerWorkspace/ExplorerWorkspace.logic';
import { stateService } from '../services/state-service';
import type { ExplorerState } from './types';

const SNAPSHOT_STORE = 'explorerTabs' as const;
const SNAPSHOT_KEY = 'snapshot';
export const SNAPSHOT_VERSION = 1;

export interface ExplorerTabsSnapshot {
    version: number;
    tabs: QueryTab[];
    activeTabId: string;
    splitEnabled: boolean;
    splitDirection: 'vertical' | 'horizontal';
    splitTabId: string | null;
    focusedPane: 'primary' | 'secondary';
}

function isQueryTab(value: unknown): value is QueryTab {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const t = value as Record<string, unknown>;
    return typeof t['id'] === 'string'
        && typeof t['title'] === 'string'
        && typeof t['kql'] === 'string'
        && typeof t['connectionId'] === 'string';
}

function isSnapshot(value: unknown): value is ExplorerTabsSnapshot {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const s = value as Record<string, unknown>;
    if (s['version'] !== SNAPSHOT_VERSION) {
        return false;
    }
    if (!Array.isArray(s['tabs']) || !s['tabs'].every(isQueryTab)) {
        return false;
    }
    if (typeof s['activeTabId'] !== 'string') {
        return false;
    }
    if (typeof s['splitEnabled'] !== 'boolean') {
        return false;
    }
    if (s['splitDirection'] !== 'vertical' && s['splitDirection'] !== 'horizontal') {
        return false;
    }
    if (s['splitTabId'] !== null && typeof s['splitTabId'] !== 'string') {
        return false;
    }
    if (s['focusedPane'] !== 'primary' && s['focusedPane'] !== 'secondary') {
        return false;
    }
    return true;
}

/**
 * Read and shape-validate the persisted snapshot.
 * Returns null when no snapshot exists or the shape is invalid/outdated.
 */
export function loadSnapshot(): ExplorerTabsSnapshot | null {
    const raw = stateService.get<unknown>(SNAPSHOT_STORE, SNAPSHOT_KEY);
    return isSnapshot(raw) ? raw : null;
}

/**
 * Validate the snapshot against the current connection list and clean
 * up any stale references. Returns null when the snapshot has no usable
 * tabs after cleaning.
 *
 * - Tabs whose `connectionId` is missing from `connections` are remapped
 *   to `fallbackConnectionId` so the user does not lose their KQL.
 * - `activeTabId` is reset to the first tab if it is missing.
 * - Split state is reset when `splitTabId` does not exist among the
 *   restored tabs or matches `activeTabId`.
 */
export function validateAndCleanSnapshot(
    snapshot: ExplorerTabsSnapshot,
    connections: readonly KustoConnection[],
    fallbackConnectionId: string,
): ExplorerTabsSnapshot | null {
    if (snapshot.tabs.length === 0) {
        return null;
    }
    const knownConnIds = new Set(connections.map((c) => c.id));
    const tabs: QueryTab[] = snapshot.tabs.map((t) => (
        knownConnIds.has(t.connectionId) ? t : { ...t, connectionId: fallbackConnectionId }
    ));

    const tabIds = new Set(tabs.map((t) => t.id));
    const activeTabId = tabIds.has(snapshot.activeTabId) ? snapshot.activeTabId : tabs[0].id;

    let { splitEnabled, splitDirection, splitTabId, focusedPane } = snapshot;
    if (!splitTabId || !tabIds.has(splitTabId) || splitTabId === activeTabId) {
        splitEnabled = false;
        splitTabId = null;
        focusedPane = 'primary';
    }

    return { version: SNAPSHOT_VERSION, tabs, activeTabId, splitEnabled, splitDirection, splitTabId, focusedPane };
}

/** Extract the persisted slices from a full ExplorerState. */
export function extractSnapshot(state: ExplorerState): ExplorerTabsSnapshot {
    return {
        version: SNAPSHOT_VERSION,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        splitEnabled: state.splitEnabled,
        splitDirection: state.splitDirection,
        splitTabId: state.splitTabId,
        focusedPane: state.focusedPane,
    };
}

/** Persist the snapshot to the StateService (and, transparently, localStorage + IDB). */
export function saveSnapshot(snapshot: ExplorerTabsSnapshot): void {
    stateService.set(SNAPSHOT_STORE, SNAPSHOT_KEY, snapshot);
}

/** Remove any persisted snapshot. Useful for tests and explicit user "reset". */
export function clearSnapshot(): void {
    stateService.delete(SNAPSHOT_STORE, SNAPSHOT_KEY);
}
