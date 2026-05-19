import { StrictMode, useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, makeStyles, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import type { Theme } from '@fluentui/react-components';
import { PublicClientApplication } from '@azure/msal-browser';

import { stateService } from './services/state-service';
import { createKustoClient } from './services/kusto';
import { Explorer } from './components/Explorer/Explorer';
import { KustoClientContext } from './context/KustoClientContext';
import type { ExplorerColorConfig } from './colors';
import type { WellKnownCluster } from './config';

type ThemeMode = 'system' | 'light' | 'dark';

const fullHeightStyle = { height: '100%' } as const;

const DEFAULT_COLORS: ExplorerColorConfig = {
    semantic: {
        backdrop: 'rgba(0, 0, 0, 0.4)',
        functionBadge: '#4caf50',
        highlightHoverBg: 'rgba(255, 200, 0, 0.2)',
        lookupBadge: '#e8912d',
        materializedViewBadge: '#9c6ade',
        scrollThumb: 'rgba(128, 128, 128, 0.4)',
        scrollThumbHover: 'rgba(128, 128, 128, 0.6)',
        selectionBg: 'rgba(0, 120, 212, 0.15)',
        selectionSubtle: 'rgba(0, 120, 212, 0.06)',
        shadowLight: 'rgba(0, 0, 0, 0.15)',
        shadowMedium: 'rgba(0, 0, 0, 0.3)',
    },
    chart: {
        palette: ['#6a8799', '#909d63', '#ebc17a', '#bc5653', '#b06698', '#c9dfff', '#7eaac7', '#acbbd0', '#636363', '#d9d9d9'],
    },
};

const useStyles = makeStyles({
    fullPage: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
    },
});

export function useExplorerTheme(darkTheme: Theme, lightTheme: Theme): { theme: Theme; isDark: boolean } {
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
        const saved = stateService.get<ThemeMode>('config', 'theme');
        return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    });
    const [systemPref, setSystemPref] = useState<'light' | 'dark'>(
        () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    );

    useEffect(() => {
        stateService.set('config', 'theme', themeMode);
    }, [themeMode]);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
            setSystemPref(e.matches ? 'dark' : 'light');
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // Expose setThemeMode on the window for settings UI (optional)
    useEffect(() => {
        (window as unknown as Record<string, unknown>)['__explorerSetTheme'] = setThemeMode;
        return () => { delete (window as unknown as Record<string, unknown>)['__explorerSetTheme']; };
    }, []);

    const isDark = themeMode === 'dark' || (themeMode === 'system' && systemPref === 'dark');
    const theme = useMemo(() => isDark ? darkTheme : lightTheme, [isDark, darkTheme, lightTheme]);

    return { theme, isDark };
}

export interface BootstrapExplorerOptions {
    /** MSAL client ID for Azure AD authentication. */
    msalClientId: string;
    /** Azure AD tenant ID. */
    tenantId: string;
    /** MSAL redirect URI (e.g. 'http://localhost:3000'). */
    redirectUri: string;
    /** Default Kusto cluster URL. */
    clusterUrl: string;
    /** Default Kusto database name. */
    database: string;
    /** Fluent UI theme for dark mode. @default webDarkTheme */
    darkTheme?: Theme;
    /** Fluent UI theme for light mode. @default webLightTheme */
    lightTheme?: Theme;
    /** Pre-seeded cluster list shown in the connection picker. */
    clusters?: WellKnownCluster[];
    /** Override the default explorer color config. */
    colors?: ExplorerColorConfig;
}

/**
 * MSAL error codes that mean: "I tried to process a redirect response, but
 * I can't find the request that initiated it." This happens after a popup
 * closes prematurely, after sessionStorage is cleared between redirect and
 * return, or when the user reloads with auth fragments still in the URL
 * from a previous broken flow. All recoverable — clear the URL and proceed
 * with a fresh auth attempt.
 */
const RECOVERABLE_MSAL_ERROR_CODES = new Set([
    'no_token_request_cache_error',
    'state_not_found',
    'no_state_in_hash',
]);

function isRecoverableMsalError(err: unknown): boolean {
    if (!err || typeof err !== 'object') {
        return false;
    }
    const code = (err as { errorCode?: unknown }).errorCode;
    return typeof code === 'string' && RECOVERABLE_MSAL_ERROR_CODES.has(code);
}

function clearAuthFragmentsFromUrl(): void {
    if (typeof window === 'undefined' || !window.history?.replaceState) {
        return;
    }
    try {
        const url = new URL(window.location.href);
        // The auth response lives in the URL hash for the implicit/fragment
        // flow MSAL uses. Drop it entirely.
        url.hash = '';
        // Also strip OAuth-related query params (auth-code flow).
        const oauthParams = ['code', 'state', 'session_state', 'error', 'error_description', 'client-request-id'];
        for (const p of oauthParams) {
            url.searchParams.delete(p);
        }
        window.history.replaceState({}, document.title, url.toString());
    } catch {
        // Best-effort — if URL parsing fails we leave the address bar alone.
    }
}

/**
 * Cheap precheck: does the current URL look like an MSAL auth response?
 * MSAL always includes `state` alongside either `code` or `error`, in either
 * the URL fragment (implicit/fragment flow) or the query string (auth-code
 * flow). We only kick off the bridge handoff when this is true to avoid
 * paying the dynamic import cost on every page load.
 */
function hasAuthResponseInUrl(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    const inSearch = (() => {
        const params = new URLSearchParams(window.location.search);
        return params.has('state') && (params.has('code') || params.has('error'));
    })();
    if (inSearch) {
        return true;
    }
    const hash = window.location.hash;
    if (hash.length > 1) {
        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
        if (params.has('state') && (params.has('code') || params.has('error'))) {
            return true;
        }
    }
    return false;
}

/**
 * Hand off to MSAL's official redirect bridge when this page is loaded as
 * the redirect URI of a popup or redirect interaction. The bridge:
 *
 *  - For popup interactions: parses the auth payload from the URL,
 *    broadcasts it on the `BroadcastChannel` the parent window is
 *    listening to, then closes this window.
 *  - For redirect interactions: caches the payload to sessionStorage and
 *    navigates to the home page, where the next `handleRedirectPromise`
 *    call picks it up.
 *
 * Without this, popup completion would never reach the parent window in
 * MSAL.js 5.x — the popup would load the full Traverse SPA and the
 * parent's `acquireTokenPopup` would time out waiting for a
 * `BroadcastChannel` message that only the bridge knows how to send.
 *
 * Returns true when the bridge fired (caller should NOT bootstrap the
 * normal app), false when the URL didn't have an auth response or the
 * bridge couldn't process it (caller should fall through; existing
 * recovery handles malformed URLs).
 *
 * The bridge is dynamically imported so embedders on older
 * `@azure/msal-browser` versions (pre-5.x, where the `/redirect-bridge`
 * subpath doesn't exist) gracefully degrade rather than failing at module
 * load.
 */
async function tryHandleMsalRedirectBridge(): Promise<boolean> {
    if (!hasAuthResponseInUrl()) {
        return false;
    }
    try {
        const mod = await import('@azure/msal-browser/redirect-bridge');
        await mod.broadcastResponseToMainFrame();
        return true;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[traverse] MSAL redirect bridge handoff failed; falling back to normal bootstrap.', err);
        return false;
    }
}

/**
 * Bootstraps a standalone Explorer app: handles MSAL auth, StateService
 * hydration, and renders the Explorer into #root.
 */
export function bootstrapExplorer(options: BootstrapExplorerOptions): void {
    void (async () => {
        // Front door: if this page load is an MSAL popup post-back or a
        // redirect post-back, hand off to MSAL's official bridge and DO
        // NOT bootstrap the Traverse app. The bridge either broadcasts to
        // the parent window and closes (popup) or navigates to the home
        // page (redirect).
        //
        // This is a hard requirement of MSAL.js 5.x's popup flow — the
        // parent's `acquireTokenPopup` is waiting on a `BroadcastChannel`
        // message that only the bridge knows how to send.
        if (await tryHandleMsalRedirectBridge()) {
            return;
        }
        runNormalBootstrap(options);
    })();
}

function runNormalBootstrap(options: BootstrapExplorerOptions): void {
    const {
        msalClientId, tenantId, redirectUri,
        clusterUrl, database,
        darkTheme = webDarkTheme,
        lightTheme = webLightTheme,
        clusters = [{ id: 'default', name: clusterUrl.replace(/^https?:\/\//, '').replace(/\.kusto\.windows\.net$/, ''), clusterUrl, database }],
        colors = DEFAULT_COLORS,
    } = options;

    const msalInstance = new PublicClientApplication({
        auth: {
            clientId: msalClientId,
            authority: `https://login.microsoftonline.com/${tenantId}`,
            redirectUri,
        },
    });

    async function getToken(cluster: string): Promise<string> {
        const scope = `${cluster}/.default`;
        await msalInstance.initialize();
        const accounts = msalInstance.getAllAccounts();

        if (accounts.length === 0) {
            const result = await msalInstance.acquireTokenPopup({ scopes: [scope] });
            return result.accessToken;
        }

        try {
            const result = await msalInstance.acquireTokenSilent({ scopes: [scope], account: accounts[0] });
            return result.accessToken;
        } catch {
            const result = await msalInstance.acquireTokenPopup({ scopes: [scope], account: accounts[0] });
            return result.accessToken;
        }
    }

    async function ensureAuthenticated(): Promise<void> {
        await msalInstance.initialize();
        try {
            const redirectResult = await msalInstance.handleRedirectPromise();
            if (redirectResult) {
                return;
            }
        } catch (err) {
            if (isRecoverableMsalError(err)) {
                // Residue from a previous incomplete redirect (popup that
                // closed before posting back, sessionStorage cleared
                // between redirect and return, scope rejected by AAD with
                // no matching request, etc). The auth fragments in the URL
                // no longer match anything in MSAL's cache. Strip them so
                // the next reload doesn't keep hitting the same error, and
                // fall through to the normal silent / loginRedirect flow.
                clearAuthFragmentsFromUrl();
            } else {
                throw err;
            }
        }
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            try {
                await msalInstance.acquireTokenSilent({ scopes: [`${clusterUrl}/.default`], account: accounts[0] });
                return;
            } catch {
                // Silent token renewal failed — fall through to redirect
            }
        }
        await msalInstance.loginRedirect({ scopes: [`${clusterUrl}/.default`] });
    }

    const kustoClient = createKustoClient({
        defaultTarget: { clusterUrl, database },
        getToken,
        stateService,
    });

    function App() {
        const styles = useStyles();
        const { theme, isDark } = useExplorerTheme(darkTheme, lightTheme);

        return (
            <FluentProvider theme={theme} style={fullHeightStyle}>
                <KustoClientContext.Provider value={kustoClient}>
                    <Explorer isDark={isDark} kustoClient={kustoClient} className={styles.fullPage} colors={colors} clusters={clusters} />
                </KustoClientContext.Provider>
            </FluentProvider>
        );
    }

    void stateService.hydrate().then(async () => {
        try {
            await ensureAuthenticated();
        } catch (err) {
            renderAuthErrorBanner(err);
            return;
        }

        createRoot(document.getElementById('root')!).render(
            <StrictMode>
                <App />
            </StrictMode>,
        );
    });
}

/**
 * Render the startup auth-failure banner using safe DOM construction —
 * never injects raw error text via `innerHTML` (the old approach was an
 * XSS hazard, since MSAL/AAD error strings can contain attacker-controlled
 * content from the URL, e.g. `error_description`).
 */
function renderAuthErrorBanner(err: unknown): void {
    const root = document.getElementById('root');
    if (!root) {
        return;
    }
    const msg = err instanceof Error ? err.message : 'Unknown error';

    // Replace any prior content.
    while (root.firstChild) {
        root.removeChild(root.firstChild);
    }

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100vh;color:#bc5653;padding:24px;text-align:center;font-family:system-ui,sans-serif';
    wrapper.textContent = `Authentication failed: ${msg}`;
    root.appendChild(wrapper);
}
