import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { ElapsedTimer } from './ElapsedTimer';

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

describe('ElapsedTimer', () => {
    it('renders elapsed time in seconds', () => {
        vi.useFakeTimers();
        const startTime = Date.now() - 2500;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        act(() => { root.render(React.createElement(ElapsedTimer, { startTime })); });
        expect(container.textContent).toMatch(/\d+\.\d+s/);
        vi.useRealTimers();
    });

    it('updates periodically', () => {
        vi.useFakeTimers();
        const startTime = Date.now();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        act(() => { root.render(React.createElement(ElapsedTimer, { startTime })); });
        const initial = container.textContent;
        act(() => { vi.advanceTimersByTime(500); });
        const updated = container.textContent;
        expect(updated).not.toBe(initial);
        vi.useRealTimers();
    });
});
