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
 * Bootstraps a standalone Explorer app: handles MSAL auth, StateService
 * hydration, and renders the Explorer into #root.
 */
export function bootstrapExplorer(options: BootstrapExplorerOptions): void {
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
        const redirectResult = await msalInstance.handleRedirectPromise();
        if (redirectResult) {
            return;
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
            const msg = err instanceof Error ? err.message : 'Unknown error';
            document.getElementById('root')!.innerHTML =
                `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#bc5653">Authentication failed: ${msg}</div>`;
            return;
        }

        createRoot(document.getElementById('root')!).render(
            <StrictMode>
                <App />
            </StrictMode>,
        );
    });
}
