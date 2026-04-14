import { describe, it, expect, vi, beforeEach } from 'vitest';

import { shouldConfirmClose, shouldConfirmCloseOthers, getDropIndicatorIndex } from './TabBar.logic';
import type { QueryTab } from '../ExplorerWorkspace/ExplorerWorkspace.logic';

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

function makeTab(id: string, kql = ''): QueryTab {
    return { id, title: `Tab ${id}`, kql, connectionId: '' };
}

// ---------------------------------------------------------------------------
// shouldConfirmClose
// ---------------------------------------------------------------------------

describe('shouldConfirmClose', () => {
    it('returns true when tab has non-empty kql content', () => {
        const tabs = [makeTab('t1', 'StormEvents | take 10')];
        expect(shouldConfirmClose(tabs, 't1')).toBe(true);
    });

    it('returns false when tab has empty kql', () => {
        const tabs = [makeTab('t1', '')];
        expect(shouldConfirmClose(tabs, 't1')).toBe(false);
    });

    it('returns false when tab has whitespace-only kql', () => {
        const tabs = [makeTab('t1', '   ')];
        expect(shouldConfirmClose(tabs, 't1')).toBe(false);
    });

    it('returns false when tabId does not exist', () => {
        const tabs = [makeTab('t1', 'some kql')];
        expect(shouldConfirmClose(tabs, 'nonexistent')).toBe(false);
    });

    it('returns false for empty tabs array', () => {
        expect(shouldConfirmClose([], 't1')).toBe(false);
    });

    it('finds the correct tab among multiple tabs', () => {
        const tabs = [makeTab('t1', ''), makeTab('t2', 'content'), makeTab('t3', '')];
        expect(shouldConfirmClose(tabs, 't2')).toBe(true);
        expect(shouldConfirmClose(tabs, 't1')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// shouldConfirmCloseOthers
// ---------------------------------------------------------------------------

describe('shouldConfirmCloseOthers', () => {
    it('returns true when other tabs have content', () => {
        const tabs = [makeTab('t1', 'keep'), makeTab('t2', 'has content')];
        expect(shouldConfirmCloseOthers(tabs, 't1')).toBe(true);
    });

    it('returns false when other tabs are empty', () => {
        const tabs = [makeTab('t1', 'keep'), makeTab('t2', ''), makeTab('t3', '  ')];
        expect(shouldConfirmCloseOthers(tabs, 't1')).toBe(false);
    });

    it('returns false when there is only one tab', () => {
        const tabs = [makeTab('t1', 'content')];
        expect(shouldConfirmCloseOthers(tabs, 't1')).toBe(false);
    });

    it('returns false for empty tabs array', () => {
        expect(shouldConfirmCloseOthers([], 't1')).toBe(false);
    });

    it('checks all other tabs, not just the first', () => {
        const tabs = [makeTab('t1', 'keep'), makeTab('t2', ''), makeTab('t3', 'content')];
        expect(shouldConfirmCloseOthers(tabs, 't1')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// getDropIndicatorIndex
// ---------------------------------------------------------------------------

describe('getDropIndicatorIndex', () => {
    const rect = { left: 100, width: 200, top: 0, height: 40 } as DOMRect;

    it('returns toIdx when cursor is before midpoint', () => {
        // midpoint is 200 (100 + 200/2), clientX < 200 → insertIdx = toIdx
        const result = getDropIndicatorIndex(0, 2, rect, 150);
        expect(result).toBe(2);
    });

    it('returns toIdx + 1 when cursor is after midpoint', () => {
        // clientX >= 200 → insertIdx = toIdx + 1
        const result = getDropIndicatorIndex(0, 2, rect, 250);
        expect(result).toBe(3);
    });

    it('returns null when drop position equals dragFromIdx', () => {
        // insertIdx = 2 (before midpoint), dragFromIdx = 2 → null
        const result = getDropIndicatorIndex(2, 2, rect, 150);
        expect(result).toBeNull();
    });

    it('returns null when drop position equals dragFromIdx + 1', () => {
        // insertIdx = 3 (after midpoint), dragFromIdx = 2 → 3 === 2+1 → null
        const result = getDropIndicatorIndex(2, 2, rect, 250);
        expect(result).toBeNull();
    });

    it('returns index for valid reorder from left to right', () => {
        const result = getDropIndicatorIndex(0, 3, rect, 250);
        expect(result).toBe(4);
    });

    it('returns index for valid reorder from right to left', () => {
        const result = getDropIndicatorIndex(3, 0, rect, 150);
        expect(result).toBe(0);
    });

    it('handles cursor exactly at midpoint (goes to after)', () => {
        // clientX === midpoint (200), 200 < 200 is false → insertIdx = toIdx + 1
        const result = getDropIndicatorIndex(0, 2, rect, 200);
        expect(result).toBe(3);
    });
});
