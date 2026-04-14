/**
 * Pure functions for TabBar — no React dependencies.
 */

import type { QueryTab } from '../ExplorerWorkspace/ExplorerWorkspace.logic';

/**
 * Returns true if the tab identified by tabId has non-empty KQL content,
 * meaning the user should be prompted before closing.
 */
export function shouldConfirmClose(tabs: QueryTab[], tabId: string): boolean {
    const tab = tabs.find((t) => t.id === tabId);
    return !!tab && !!tab.kql.trim();
}

/**
 * Returns true if any tab OTHER than keepTabId has non-empty KQL content,
 * meaning the user should be prompted before closing others.
 */
export function shouldConfirmCloseOthers(tabs: QueryTab[], keepTabId: string): boolean {
    return tabs.some((t) => t.id !== keepTabId && t.kql.trim().length > 0);
}

/**
 * Computes where to show the drop indicator when reordering tabs.
 * Returns an insertion index, or null if the tab would stay in place.
 */
export function getDropIndicatorIndex(dragFromIdx: number, toIdx: number, rect: DOMRect, clientX: number): number | null {
    const midX = rect.left + rect.width / 2;
    const insertIdx = clientX < midX ? toIdx : toIdx + 1;
    if (insertIdx !== dragFromIdx && insertIdx !== dragFromIdx + 1) {
        return insertIdx;
    }
    return null;
}
