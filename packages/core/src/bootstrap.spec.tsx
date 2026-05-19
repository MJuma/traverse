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

        // Bootstrap is now wrapped in an async IIFE (so the MSAL redirect
        // bridge can short-circuit before any normal app bootstrap), so
        // hydrate is called asynchronously after the bridge precheck.
        await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

        expect(hydrateSpy).toHaveBeenCalled();

        rootEl.remove();
    });
});

describe('bootstrapExplorer MSAL redirect bridge handoff', () => {
    let originalLocation: Location;

    beforeEach(() => {
        originalLocation = window.location;
        // The shared hydrate mock from the top-level vi.mock factory persists
        // across tests; reset its call count so each test sees a clean slate.
        const sharedHydrate = (stateService as unknown as { hydrate: ReturnType<typeof vi.fn> }).hydrate;
        if (sharedHydrate?.mockClear) {
            sharedHydrate.mockClear();
        }
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
        vi.doUnmock('@azure/msal-browser/redirect-bridge');
        vi.resetModules();
    });

    function stubLocation(url: string): void {
        const parsed = new URL(url);
        Object.defineProperty(window, 'location', {
            value: { ...originalLocation, href: url, search: parsed.search, hash: parsed.hash },
            configurable: true,
        });
    }

    it('hands off to the MSAL redirect bridge when the URL carries an auth response and skips normal bootstrap', async () => {
        const rootEl = document.createElement('div');
        rootEl.id = 'root';
        document.body.appendChild(rootEl);

        stubLocation('http://localhost:3000/#code=abc&state=eyJpZCI6InRlc3QifQ==');

        const broadcastSpy = vi.fn().mockResolvedValue(undefined);
        vi.doMock('@azure/msal-browser/redirect-bridge', () => ({
            broadcastResponseToMainFrame: broadcastSpy,
        }));

        // Re-import bootstrap so its dynamic-import call resolves through
        // the new vi.doMock factory.
        vi.resetModules();
        const { bootstrapExplorer: freshBootstrap } = await import('./bootstrap');
        const { stateService: freshState } = await import('./services/state-service');
        const hydrateSpy = vi.spyOn(freshState, 'hydrate');

        freshBootstrap({
            msalClientId: 'test-client',
            tenantId: 'test-tenant',
            redirectUri: 'http://localhost:3000',
            clusterUrl: 'https://help.kusto.windows.net',
            database: 'Samples',
        });

        await act(async () => { await new Promise((r) => setTimeout(r, 80)); });

        expect(broadcastSpy).toHaveBeenCalled();
        expect(hydrateSpy).not.toHaveBeenCalled();

        rootEl.remove();
    });

    it('falls through to normal bootstrap when the URL has no auth response', async () => {
        const rootEl = document.createElement('div');
        rootEl.id = 'root';
        document.body.appendChild(rootEl);

        stubLocation('http://localhost:3000/');

        const hydrateSpy = vi.spyOn(stateService, 'hydrate');

        bootstrapExplorer({
            msalClientId: 'test-client',
            tenantId: 'test-tenant',
            redirectUri: 'http://localhost:3000',
            clusterUrl: 'https://help.kusto.windows.net',
            database: 'Samples',
        });

        await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

        expect(hydrateSpy).toHaveBeenCalled();

        rootEl.remove();
    });

    it('falls through to normal bootstrap when the bridge import fails (older MSAL versions)', async () => {
        const rootEl = document.createElement('div');
        rootEl.id = 'root';
        document.body.appendChild(rootEl);

        stubLocation('http://localhost:3000/#code=abc&state=xyz');

        vi.doMock('@azure/msal-browser/redirect-bridge', () => {
            throw new Error('Module not found');
        });

        vi.resetModules();
        const { bootstrapExplorer: freshBootstrap } = await import('./bootstrap');
        const { stateService: freshState } = await import('./services/state-service');
        const hydrateSpy = vi.spyOn(freshState, 'hydrate');

        freshBootstrap({
            msalClientId: 'test-client',
            tenantId: 'test-tenant',
            redirectUri: 'http://localhost:3000',
            clusterUrl: 'https://help.kusto.windows.net',
            database: 'Samples',
        });

        await act(async () => { await new Promise((r) => setTimeout(r, 80)); });

        // Bridge failed → graceful degradation, normal bootstrap still ran.
        expect(hydrateSpy).toHaveBeenCalled();

        rootEl.remove();
    });
});

describe('bootstrapExplorer auth error banner safety', () => {
    let originalLocation: Location;

    beforeEach(() => {
        originalLocation = window.location;
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
        vi.doUnmock('@azure/msal-browser');
        vi.resetModules();
    });

    function stubLocation(url: string): void {
        const parsed = new URL(url);
        Object.defineProperty(window, 'location', {
            value: { ...originalLocation, href: url, search: parsed.search, hash: parsed.hash },
            configurable: true,
        });
    }

    it('renders the auth-failure banner using safe DOM construction (no innerHTML)', async () => {
        const rootEl = document.createElement('div');
        rootEl.id = 'root';
        document.body.appendChild(rootEl);

        stubLocation('http://localhost:3000/');

        // Re-mock @azure/msal-browser so handleRedirectPromise throws a
        // non-recoverable error containing an XSS payload.
        const xssMsg = '<img src=x onerror="window.__pwn__=true">';
        vi.doMock('@azure/msal-browser', () => {
            class FailingMsal {
                initialize = vi.fn().mockResolvedValue(undefined);
                getAllAccounts = vi.fn().mockReturnValue([]);
                acquireTokenPopup = vi.fn().mockResolvedValue({ accessToken: 'token' });
                acquireTokenSilent = vi.fn().mockResolvedValue({ accessToken: 'token' });
                handleRedirectPromise = vi.fn().mockRejectedValue(new Error(xssMsg));
                loginRedirect = vi.fn().mockResolvedValue(undefined);
            }
            return { PublicClientApplication: FailingMsal };
        });

        vi.resetModules();
        const { bootstrapExplorer: freshBootstrap } = await import('./bootstrap');

        try {
            freshBootstrap({
                msalClientId: 'test-client',
                tenantId: 'test-tenant',
                redirectUri: 'http://localhost:3000',
                clusterUrl: 'https://help.kusto.windows.net',
                database: 'Samples',
            });

            await act(async () => { await new Promise((r) => setTimeout(r, 100)); });

            // The malicious payload must NOT be parsed as HTML — neither the
            // img tag nor the script should appear in the DOM as elements.
            expect(rootEl.querySelector('img')).toBeNull();
            expect((window as unknown as { __pwn__?: boolean }).__pwn__).toBeUndefined();
            // But the message text should still be present as text.
            expect(rootEl.textContent).toContain(xssMsg);
        } finally {
            rootEl.remove();
        }
    });
});
