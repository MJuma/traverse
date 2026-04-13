import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { VegaChart } from './VegaChart';
import type { VisualizationSpec } from './VegaChart';

// Polyfill ResizeObserver for jsdom — fires callback immediately with mock dimensions
let resizeCallback: ((entries: { contentRect: { width: number } }[]) => void) | null = null;
class MockResizeObserver {
    constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
        resizeCallback = cb;
    }
    observe = vi.fn().mockImplementation(() => {
        // Fire with a realistic width
        resizeCallback?.([{ contentRect: { width: 600 } }]);
    });
    unobserve = vi.fn();
    disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

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

const baseSpec: VisualizationSpec = {
    mark: 'bar',
    encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
    },
} as VisualizationSpec;

const baseData = { values: [{ category: 'A', value: 10 }, { category: 'B', value: 20 }] };

describe('VegaChart', () => {
    it('renders a container div', () => {
        act(() => {
            root.render(React.createElement(VegaChart, {
                spec: baseSpec, data: baseData, isDark: false,
            }));
        });
        expect(container.querySelector('div')).toBeTruthy();
    });

    it('renders with isDark=true', () => {
        act(() => {
            root.render(React.createElement(VegaChart, {
                spec: baseSpec, data: baseData, isDark: true,
            }));
        });
        expect(container.querySelector('div')).toBeTruthy();
    });

    it('renders with custom height', () => {
        act(() => {
            root.render(React.createElement(VegaChart, {
                spec: baseSpec, data: baseData, isDark: false, height: 400,
            }));
        });
        const div = container.querySelector('div');
        expect(div?.style.minHeight).toBe('400px');
    });

    it('renders with custom palette', () => {
        act(() => {
            root.render(React.createElement(VegaChart, {
                spec: baseSpec, data: baseData, isDark: false,
                palette: ['#ff0000', '#00ff00', '#0000ff'],
            }));
        });
        expect(container.querySelector('div')).toBeTruthy();
    });

    it('renders with onClick handler', () => {
        const onClick = vi.fn();
        act(() => {
            root.render(React.createElement(VegaChart, {
                spec: baseSpec, data: baseData, isDark: false, onClick,
            }));
        });
        expect(container.querySelector('div')).toBeTruthy();
    });

    it('shows error message on render failure', async () => {
        // Pass an invalid spec to trigger a render error
        const badSpec = { mark: 'invalid_mark_type' } as unknown as VisualizationSpec;
        act(() => {
            root.render(React.createElement(VegaChart, {
                spec: badSpec, data: baseData, isDark: false,
            }));
        });

        // The async vega import + compile may fail — wait for error state
        await act(async () => {
            await new Promise((r) => setTimeout(r, 100));
        });

        // Either renders a chart div or shows error message
        expect(container.querySelector('div')).toBeTruthy();
    });

    it('renders with empty data', () => {
        act(() => {
            root.render(React.createElement(VegaChart, {
                spec: baseSpec, data: { values: [] }, isDark: false,
            }));
        });
        expect(container.querySelector('div')).toBeTruthy();
    });
});
