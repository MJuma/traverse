
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { HistoryItem } from './HistoryItem';
import type { QueryHistoryEntry } from '../../services/queryHistory';

vi.mock('../../context/ExplorerColorContext', () => ({
    useExplorerColors: () => ({
        semantic: {}, chart: { palette: [] },
    }),
}));
vi.mock('../ExplorerWorkspace/ExplorerWorkspace.styles', () => ({
    useExplorerStyles: () => new Proxy({}, { get: (_, p) => String(p) }),
}));
vi.mock('@fluentui/react-components', () => ({
    tokens: new Proxy({}, { get: (_, p) => String(p) }),
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.restoreAllMocks();
});

const mockStyles = new Proxy({}, { get: (_, p) => String(p) }) as never;

describe('HistoryItem', () => {
    it('renders success entry with recallable indicator', () => {
        const entry: QueryHistoryEntry = {
            key: 'T | take 10', query: 'T | take 10', timestamp: Date.now(), status: 'success',
            rowCount: 100, columnCount: 5, elapsed: 42, rows: [{ a: 1 }], columns: ['a'],
        };
        act(() => { root.render(React.createElement(HistoryItem, { entry, styles: mockStyles, onRecall: vi.fn(), onDelete: vi.fn() })); });
        expect(container.textContent).toContain('T | take 10');
        expect(container.textContent).toContain('100');
        expect(container.textContent).toContain('42ms');
        expect(container.textContent).toContain('recallable');
    });

    it('renders error entry', () => {
        const entry: QueryHistoryEntry = {
            key: 'bad query', query: 'bad query', timestamp: Date.now(), status: 'error',
            rowCount: null, columnCount: 0, elapsed: null, rows: undefined, columns: undefined,
        };
        act(() => { root.render(React.createElement(HistoryItem, { entry, styles: mockStyles, onRecall: vi.fn(), onDelete: vi.fn() })); });
        expect(container.textContent).toContain('error');
    });

    it('calls onRecall on click', () => {
        const onRecall = vi.fn();
        const entry: QueryHistoryEntry = {
            key: 'q', query: 'q', timestamp: Date.now(), status: 'success',
            rowCount: 1, columnCount: 1, elapsed: 1, rows: undefined, columns: undefined,
        };
        act(() => { root.render(React.createElement(HistoryItem, { entry, styles: mockStyles, onRecall, onDelete: vi.fn() })); });
        act(() => { container.querySelector('[role="treeitem"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
        expect(onRecall).toHaveBeenCalledWith(entry);
    });

    it('calls onRecall on Enter key', () => {
        const onRecall = vi.fn();
        const entry: QueryHistoryEntry = {
            key: 'q', query: 'q', timestamp: Date.now(), status: 'success',
            rowCount: 1, columnCount: 1, elapsed: 1, rows: undefined, columns: undefined,
        };
        act(() => { root.render(React.createElement(HistoryItem, { entry, styles: mockStyles, onRecall, onDelete: vi.fn() })); });
        act(() => {
            container.querySelector('[role="treeitem"]')?.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(onRecall).toHaveBeenCalledWith(entry);
    });

    it('calls onDelete on delete button click', () => {
        const onDelete = vi.fn();
        const entry: QueryHistoryEntry = {
            key: 'q', query: 'q', timestamp: Date.now(), status: 'success',
            rowCount: 1, columnCount: 1, elapsed: 1, rows: undefined, columns: undefined,
        };
        act(() => { root.render(React.createElement(HistoryItem, { entry, styles: mockStyles, onRecall: vi.fn(), onDelete })); });
        act(() => { container.querySelector('button[title="Delete"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
        expect(onDelete).toHaveBeenCalledWith(entry);
    });

    it('calls onDelete on delete button Enter key', () => {
        const onDelete = vi.fn();
        const entry: QueryHistoryEntry = {
            key: 'q', query: 'q', timestamp: Date.now(), status: 'success',
            rowCount: 1, columnCount: 1, elapsed: 1, rows: undefined, columns: undefined,
        };
        act(() => { root.render(React.createElement(HistoryItem, { entry, styles: mockStyles, onRecall: vi.fn(), onDelete })); });
        act(() => {
            container.querySelector('button[title="Delete"]')?.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(onDelete).toHaveBeenCalledWith(entry);
    });

    it('renders success entry without rows (not recallable)', () => {
        const entry: QueryHistoryEntry = {
            key: 'q', query: 'q', timestamp: Date.now(), status: 'success',
            rowCount: 5, columnCount: 2, elapsed: null, rows: undefined, columns: undefined,
        };
        act(() => { root.render(React.createElement(HistoryItem, { entry, styles: mockStyles, onRecall: vi.fn(), onDelete: vi.fn() })); });
        expect(container.textContent).not.toContain('recallable');
        expect(container.textContent).not.toContain('ms');
    });
});
