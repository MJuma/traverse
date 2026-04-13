import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { webDarkTheme, webLightTheme } from '@fluentui/react-components';

import { useExplorerTheme } from './bootstrap';

vi.mock('./services/state-service', () => {
    const store = new Map<string, unknown>();
    return {
        stateService: {
            get: (_s: string, key: string) => store.get(key) ?? null,
            set: (_s: string, key: string, value: unknown) => { store.set(key, value); },
        },
    };
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // jsdom doesn't have matchMedia
    if (!window.matchMedia) {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockReturnValue({
                matches: false,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }),
        });
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.restoreAllMocks();
});

function renderThemeHook(dark = webDarkTheme, light = webLightTheme): { isDark: boolean } {
    let result = { isDark: false };
    function TestComponent() {
        const r = useExplorerTheme(dark, light);
        result = r;
        return null;
    }
    act(() => { root.render(createElement(TestComponent)); });
    return result;
}

describe('useExplorerTheme', () => {
    it('defaults to system preference', () => {
        const result = renderThemeHook();
        expect(typeof result.isDark).toBe('boolean');
    });

    it('returns dark theme when system prefers dark', () => {
        const matchMediaMock = vi.fn().mockReturnValue({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });
        vi.stubGlobal('matchMedia', matchMediaMock);

        const result = renderThemeHook();
        expect(result.isDark).toBe(true);

        vi.unstubAllGlobals();
    });

    it('returns light theme when system prefers light', () => {
        const matchMediaMock = vi.fn().mockReturnValue({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });
        vi.stubGlobal('matchMedia', matchMediaMock);

        const result = renderThemeHook();
        expect(result.isDark).toBe(false);

        vi.unstubAllGlobals();
    });
});
