
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { VirtualCell } from './VirtualCell';

vi.mock('../../context/ExplorerColorContext', () => ({
    useExplorerColors: () => ({ semantic: {}, chart: { palette: [] } }),
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    if (root) {
        act(() => { root.unmount(); });
    }
    if (container) {
        container.remove();
    }
    vi.restoreAllMocks();
});

describe('VirtualCell', () => {
    it('renders cell value and fires mouse handlers', () => {
        const handleMouseDown = vi.fn();
        const handleMouseEnter = vi.fn();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        const mockStyles = new Proxy({}, { get: (_, p) => String(p) }) as never;
        const row = { Col1: 'hello' };

        act(() => {
            root.render(React.createElement(VirtualCell, {
                col: 'Col1', colIdx: 0, rowIdx: 2, row, width: 100,
                selected: false, styles: mockStyles,
                handleCellMouseDown: handleMouseDown, handleCellMouseEnter: handleMouseEnter,
            }));
        });

        expect(container.textContent).toContain('hello');

        const cell = container.querySelector('[role="gridcell"]');
        act(() => { cell?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
        expect(handleMouseDown).toHaveBeenCalledWith(2, 0, expect.anything());
    });
});
