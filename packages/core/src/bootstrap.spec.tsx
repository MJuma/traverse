import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { webDarkTheme, webLightTheme } from '@fluentui/react-components';

import { useExplorerTheme, bootstrapExplorer } from './bootstrap';
import { stateService } from './services/state-service';

vi.mock('./services/state-service', () => {
    const store = new Map<string, unknown>();
    return {
        stateService: {
            get: (_s: string, key: string) => store.get(key) ?? null,
            set: (_s: string, key: string, value: unknown) => { store.set(key, value); },
            hydrate: vi.fn().mockResolvedValue(undefined),
        },
    };
});
vi.mock('./services/kusto', () => ({
    createKustoClient: vi.fn().mockReturnValue({
        queryKusto: vi.fn(),
        queryKustoMgmt: vi.fn(),
        clearQueryCache: vi.fn(),
        getQueryCacheSize: vi.fn().mockReturnValue(0),
    }),
}));
vi.mock('./components/Explorer/Explorer', () => ({
    Explorer: () => createElement('div', { 'data-testid': 'explorer' }),
}));
vi.mock('./context/KustoClientContext', () => ({
    KustoClientContext: { Provider: (p: Record<string, unknown>) => createElement('div', null, p['children'] as React.ReactNode) },
}));
vi.mock('@azure/msal-browser', () => {
    class MockPublicClientApplication {
        initialize = vi.fn().mockResolvedValue(undefined);
        getAllAccounts = vi.fn().mockReturnValue([]);
        acquireTokenPopup = vi.fn().mockResolvedValue({ accessToken: 'token' });
        acquireTokenSilent = vi.fn().mockResolvedValue({ accessToken: 'token' });
        handleRedirectPromise = vi.fn().mockResolvedValue(null);
        loginRedirect = vi.fn().mockResolvedValue(undefined);
    }
    return { PublicClientApplication: MockPublicClientApplication };
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Reset stored theme between tests
    stateService.set('config', 'theme', null);
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
    delete (window as unknown as Record<string, unknown>)['__explorerSetTheme'];
});

function renderThemeHook(dark = webDarkTheme, light = webLightTheme): { isDark: boolean; theme: unknown } {
    let result = { isDark: false, theme: null as unknown };
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

    it('returns correct theme object for light mode', () => {
        const matchMediaMock = vi.fn().mockReturnValue({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });
        vi.stubGlobal('matchMedia', matchMediaMock);

        const result = renderThemeHook();
        expect(result.theme).toBe(webLightTheme);

        vi.unstubAllGlobals();
    });

    it('returns correct theme object for dark mode', () => {
        const matchMediaMock = vi.fn().mockReturnValue({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });
        vi.stubGlobal('matchMedia', matchMediaMock);

        const result = renderThemeHook();
        expect(result.theme).toBe(webDarkTheme);

        vi.unstubAllGlobals();
    });

    it('exposes __explorerSetTheme on window', () => {
        renderThemeHook();
        expect(typeof (window as unknown as Record<string, unknown>)['__explorerSetTheme']).toBe('function');
    });

    it('__explorerSetTheme switches to dark mode', () => {
        const matchMediaMock = vi.fn().mockReturnValue({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });
        vi.stubGlobal('matchMedia', matchMediaMock);

        let result = { isDark: false, theme: null as unknown };
        function TestComponent() {
            const r = useExplorerTheme(webDarkTheme, webLightTheme);
            result = r;
            return null;
        }
        act(() => { root.render(createElement(TestComponent)); });
        expect(result.isDark).toBe(false);

        // Invoke the exposed setter
        const setTheme = (window as unknown as Record<string, unknown>)['__explorerSetTheme'] as (mode: string) => void;
        act(() => { setTheme('dark'); });
        expect(result.isDark).toBe(true);

        vi.unstubAllGlobals();
    });

    it('responds to system media query change events', () => {
        // Reset stored theme to ensure system preference is used
        stateService.set('config', 'theme', 'system');

        let capturedHandler: ((e: MediaQueryListEvent) => void) | null = null;
        const matchMediaMock = vi.fn().mockReturnValue({
            matches: false,
            addEventListener: (_: string, handler: (e: MediaQueryListEvent) => void) => {
                capturedHandler = handler;
            },
            removeEventListener: vi.fn(),
        });
        vi.stubGlobal('matchMedia', matchMediaMock);

        let result = { isDark: false, theme: null as unknown };
        function TestComponent() {
            const r = useExplorerTheme(webDarkTheme, webLightTheme);
            result = r;
            return null;
        }
        act(() => { root.render(createElement(TestComponent)); });
        expect(result.isDark).toBe(false);

        // Simulate system dark mode change
        if (capturedHandler) {
            act(() => { capturedHandler!({ matches: true } as MediaQueryListEvent); });
            expect(result.isDark).toBe(true);
        }

        vi.unstubAllGlobals();
    });

    it('persists theme to stateService when changed', () => {
        const setSpy = vi.spyOn(stateService, 'set');
        const matchMediaMock = vi.fn().mockReturnValue({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });
        vi.stubGlobal('matchMedia', matchMediaMock);

        function TestComponent() {
            useExplorerTheme(webDarkTheme, webLightTheme);
            return null;
        }
        act(() => { root.render(createElement(TestComponent)); });

        // The hook persists the theme mode on mount
        expect(setSpy).toHaveBeenCalled();

        vi.unstubAllGlobals();
    });

    it('reads saved theme from stateService', () => {
        
        stateService.set('config', 'theme', 'dark');

        const matchMediaMock = vi.fn().mockReturnValue({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });
        vi.stubGlobal('matchMedia', matchMediaMock);

        const result = renderThemeHook();
        expect(result.isDark).toBe(true);

        vi.unstubAllGlobals();
    });

    it('cleans up __explorerSetTheme on unmount', () => {
        function TestComponent() {
            useExplorerTheme(webDarkTheme, webLightTheme);
            return null;
        }
        act(() => { root.render(createElement(TestComponent)); });
        expect((window as unknown as Record<string, unknown>)['__explorerSetTheme']).toBeDefined();

        act(() => { root.unmount(); });
        root = createRoot(container);
        expect((window as unknown as Record<string, unknown>)['__explorerSetTheme']).toBeUndefined();
    });
});

describe('bootstrapExplorer', () => {
    it('is a function', () => {
        expect(typeof bootstrapExplorer).toBe('function');
    });

    it('calls stateService.hydrate on invocation', async () => {
        const rootEl = document.createElement('div');
        rootEl.id = 'root';
        document.body.appendChild(rootEl);

        const hydrateSpy = vi.spyOn(stateService, 'hydrate');

        bootstrapExplorer({
            msalClientId: 'test-client',
            tenantId: 'test-tenant',
            redirectUri: 'http://localhost:3000',
            clusterUrl: 'https://help.kusto.windows.net',
            database: 'Samples',
        });

        expect(hydrateSpy).toHaveBeenCalled();

        // Wait for the async chain (hydrate → auth → render) to settle
        await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

        rootEl.remove();
    });
});
