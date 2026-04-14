import { StrictMode, useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, makeStyles } from '@fluentui/react-components';
import type { BrandVariants, Theme } from '@fluentui/react-components';
import { listen } from '@tauri-apps/api/event';

import {
    Explorer,
    createKustoClient,
    stateService,
    KustoClientContext,
} from '@mhjuma/traverse';
import type { ExplorerColorConfig } from '@mhjuma/traverse';

import { authenticate, clearAuth } from './auth';
import { AuthError } from './AuthError';
import { AuthLoading } from './AuthLoading';
import { SettingsPage } from './SettingsPage';
import { buildThemes, getPreset } from './themes';
import { withNotifications } from './notifications';
import type { ThemeMode } from './SettingsTheme';

const CLIENT_ID = 'c8dbda70-81cc-49e0-aa47-6133d7154fe3';
const TENANT_ID = '72f988bf-86f1-41af-91ab-2d7cd011db47';
const CLUSTER_URL = 'https://help.kusto.windows.net';
const DATABASE = 'Samples';

const fullHeightStyle = { height: '100%' } as const;

const useStyles = makeStyles({
    fullPage: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
    },
    titlebarRegion: {
        height: '28px',
        flexShrink: 0,
    },
    appContent: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        overflow: 'hidden',
    },
});

const clusters = [{
    id: 'default',
    name: CLUSTER_URL.replace(/^https?:\/\//, '').replace(/\.kusto\.windows\.net$/, ''),
    clusterUrl: CLUSTER_URL,
    database: DATABASE,
}];

async function getToken(clusterUrl: string): Promise<string> {
    return authenticate(CLIENT_ID, TENANT_ID, clusterUrl);
}

const kustoClient = withNotifications(createKustoClient({
    defaultTarget: { clusterUrl: CLUSTER_URL, database: DATABASE },
    getToken,
    stateService,
}));

function loadSavedThemeMode(): ThemeMode {
    const saved = stateService.get<ThemeMode>('config', 'theme');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
}

function loadSavedPresetId(): string {
    return stateService.get<string>('config', 'themePreset') ?? 'default';
}

function loadSavedCustomAccent(): string {
    return stateService.get<string>('config', 'customAccent') ?? '#1267B4';
}

function generateCustomBrand(accent: string): BrandVariants {
    // Generate a 16-shade palette from a single accent color
    // by mixing with black (darker) and white (lighter)
    const r = parseInt(accent.slice(1, 3), 16);
    const g = parseInt(accent.slice(3, 5), 16);
    const b = parseInt(accent.slice(5, 7), 16);

    function mix(base: number, target: number, amount: number): number {
        return Math.round(base + (target - base) * amount);
    }

    function toHex(rv: number, gv: number, bv: number): string {
        return `#${rv.toString(16).padStart(2, '0')}${gv.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`;
    }

    // Shades 10-70: progressively darken from near-black to just below accent
    // Shade 80: accent itself
    // Shades 90-160: progressively lighten toward white
    return {
        10: toHex(mix(r, 0, 0.85), mix(g, 0, 0.85), mix(b, 0, 0.85)),
        20: toHex(mix(r, 0, 0.7), mix(g, 0, 0.7), mix(b, 0, 0.7)),
        30: toHex(mix(r, 0, 0.58), mix(g, 0, 0.58), mix(b, 0, 0.58)),
        40: toHex(mix(r, 0, 0.46), mix(g, 0, 0.46), mix(b, 0, 0.46)),
        50: toHex(mix(r, 0, 0.36), mix(g, 0, 0.36), mix(b, 0, 0.36)),
        60: toHex(mix(r, 0, 0.26), mix(g, 0, 0.26), mix(b, 0, 0.26)),
        70: toHex(mix(r, 0, 0.14), mix(g, 0, 0.14), mix(b, 0, 0.14)),
        80: accent,
        90: toHex(mix(r, 255, 0.12), mix(g, 255, 0.12), mix(b, 255, 0.12)),
        100: toHex(mix(r, 255, 0.24), mix(g, 255, 0.24), mix(b, 255, 0.24)),
        110: toHex(mix(r, 255, 0.36), mix(g, 255, 0.36), mix(b, 255, 0.36)),
        120: toHex(mix(r, 255, 0.48), mix(g, 255, 0.48), mix(b, 255, 0.48)),
        130: toHex(mix(r, 255, 0.60), mix(g, 255, 0.60), mix(b, 255, 0.60)),
        140: toHex(mix(r, 255, 0.72), mix(g, 255, 0.72), mix(b, 255, 0.72)),
        150: toHex(mix(r, 255, 0.84), mix(g, 255, 0.84), mix(b, 255, 0.84)),
        160: toHex(mix(r, 255, 0.92), mix(g, 255, 0.92), mix(b, 255, 0.92)),
    };
}

type AppView = 'main' | 'settings';

type AuthState =
    | { status: 'pending' }
    | { status: 'authenticated' }
    | { status: 'error'; message: string };

function App() {
    const styles = useStyles();
    const [authState, setAuthState] = useState<AuthState>({ status: 'pending' });
    const [view, setView] = useState<AppView>('main');

    const [themeMode, setThemeMode] = useState<ThemeMode>(loadSavedThemeMode);
    const [presetId, setPresetId] = useState<string>(loadSavedPresetId);
    const [customAccent, setCustomAccent] = useState<string>(loadSavedCustomAccent);
    const [systemPref, setSystemPref] = useState<'light' | 'dark'>(
        () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    );

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setSystemPref(e.matches ? 'dark' : 'light');
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const isDark = themeMode === 'dark' || (themeMode === 'system' && systemPref === 'dark');

    const { theme, colors } = useMemo<{ theme: Theme; colors: ExplorerColorConfig }>(() => {
        if (presetId === 'custom') {
            const brand = generateCustomBrand(customAccent);
            const themes = buildThemes(brand);
            const preset = getPreset('default');
            return { theme: isDark ? themes.dark : themes.light, colors: preset.colors };
        }
        const preset = getPreset(presetId);
        const themes = buildThemes(preset.brand);
        return { theme: isDark ? themes.dark : themes.light, colors: preset.colors };
    }, [presetId, customAccent, isDark]);

    const handleThemeChange = useCallback((mode: ThemeMode) => {
        setThemeMode(mode);
        stateService.set('config', 'theme', mode);
    }, []);

    const handlePresetChange = useCallback((id: string) => {
        setPresetId(id);
        stateService.set('config', 'themePreset', id);
    }, []);

    const handleCustomAccentChange = useCallback((color: string) => {
        setCustomAccent(color);
        stateService.set('config', 'customAccent', color);
    }, []);

    const doAuth = useCallback(async () => {
        setAuthState({ status: 'pending' });
        try {
            await getToken(CLUSTER_URL);
            setAuthState({ status: 'authenticated' });
        } catch (err) {
            setAuthState({ status: 'error', message: String(err) });
        }
    }, []);

    const handleClearAuth = useCallback(async () => {
        await clearAuth();
        setView('main');
        void doAuth();
    }, [doAuth]);

    useEffect(() => {
        void doAuth();
    }, [doAuth]);

    useEffect(() => {
        const unlisten = listen<string>('menu-event', (event) => {
            if (event.payload === 'settings') {
                setView((v) => v === 'settings' ? 'main' : 'settings');
            }
        });
        return () => { void unlisten.then((fn) => fn()); };
    }, []);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && view === 'settings') {
                setView('main');
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view]);

    const handleBack = useCallback(() => setView('main'), []);

    return (
        <FluentProvider theme={theme} style={fullHeightStyle}>
            <div className={styles.fullPage}>
                <div className={styles.titlebarRegion} data-tauri-drag-region />
                <div className={styles.appContent}>
                    {view === 'settings' ? (
                        <SettingsPage
                            themeMode={themeMode}
                            presetId={presetId}
                            customAccent={customAccent}
                            onThemeChange={handleThemeChange}
                            onPresetChange={handlePresetChange}
                            onCustomAccentChange={handleCustomAccentChange}
                            onClearAuth={handleClearAuth}
                            onBack={handleBack}
                        />
                    ) : (
                        <>
                            {authState.status === 'pending' && (
                                <AuthLoading />
                            )}
                            {authState.status === 'error' && (
                                <AuthError message={authState.message} onRetry={doAuth} />
                            )}
                            {authState.status === 'authenticated' && (
                                <KustoClientContext.Provider value={kustoClient}>
                                    <Explorer isDark={isDark} kustoClient={kustoClient} className={styles.appContent} colors={colors} clusters={clusters} enableTabShortcuts />
                                </KustoClientContext.Provider>
                            )}
                        </>
                    )}
                </div>
            </div>
        </FluentProvider>
    );
}

void stateService.hydrate().then(() => {
    // Disable default WebView context menu except on text inputs and app context menus
    document.addEventListener('contextmenu', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }
        // Allow context menu on schema items, tabs, and other app elements that handle it
        if (target.closest('[data-context-menu]')) {
            return;
        }
        e.preventDefault();
    });

    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
});
