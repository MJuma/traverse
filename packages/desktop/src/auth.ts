import { invoke } from '@tauri-apps/api/core';
import { LazyStore } from '@tauri-apps/plugin-store';

const TOKEN_ENDPOINT = 'https://login.microsoftonline.com';
const store = new LazyStore('auth.json');

interface AuthFlowResult {
    code: string;
    codeVerifier: string;
    redirectUri: string;
}

interface AadTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
}

interface CachedToken {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();
let activeAuth: Promise<string> | null = null;

async function loadPersistedRefreshToken(scope: string): Promise<string | undefined> {
    return store.get<string>(`refresh:${scope}`) ?? undefined;
}

async function persistRefreshToken(scope: string, refreshToken: string): Promise<void> {
    await store.set(`refresh:${scope}`, refreshToken);
    await store.save();
}

async function exchangeCode(clientId: string, tenantId: string, result: AuthFlowResult): Promise<AadTokenResponse> {
    const resp = await fetch(`${TOKEN_ENDPOINT}/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            code: result.code,
            redirect_uri: result.redirectUri,
            code_verifier: result.codeVerifier,
        }),
    });

    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Token exchange failed: ${body}`);
    }

    return resp.json() as Promise<AadTokenResponse>;
}

async function refreshToken(clientId: string, tenantId: string, scope: string, refreshTok: string): Promise<AadTokenResponse> {
    const resp = await fetch(`${TOKEN_ENDPOINT}/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'refresh_token',
            refresh_token: refreshTok,
            scope,
        }),
    });

    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Token refresh failed: ${body}`);
    }

    return resp.json() as Promise<AadTokenResponse>;
}

async function cacheToken(scope: string, resp: AadTokenResponse, prevRefresh?: string): Promise<void> {
    const refreshTok = resp.refresh_token ?? prevRefresh;
    tokenCache.set(scope, {
        accessToken: resp.access_token,
        refreshToken: refreshTok,
        expiresAt: Date.now() + (resp.expires_in - 120) * 1000,
    });

    if (refreshTok) {
        await persistRefreshToken(scope, refreshTok);
    }
}

export async function authenticate(clientId: string, tenantId: string, clusterUrl: string): Promise<string> {
    const scope = `${clusterUrl}/.default`;

    // Check in-memory cache
    const cached = tokenCache.get(scope);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.accessToken;
    }

    // Deduplicate concurrent auth attempts (e.g. StrictMode double-invoke)
    if (activeAuth) {
        return activeAuth;
    }

    activeAuth = authenticateInner(clientId, tenantId, scope);
    try {
        return await activeAuth;
    } finally {
        activeAuth = null;
    }
}

async function authenticateInner(clientId: string, tenantId: string, scope: string): Promise<string> {
    // Try refresh — from memory first, then from persisted store
    const cached = tokenCache.get(scope);
    const refreshTok = cached?.refreshToken ?? await loadPersistedRefreshToken(scope);
    if (refreshTok) {
        try {
            const resp = await refreshToken(clientId, tenantId, scope, refreshTok);
            await cacheToken(scope, resp, refreshTok);
            return resp.access_token;
        } catch {
            // Refresh failed, fall through
        }
    }

    // Try using any other cached refresh token (cross-resource silent auth)
    if (!refreshTok) {
        for (const [, entry] of tokenCache) {
            if (entry.refreshToken) {
                try {
                    const resp = await refreshToken(clientId, tenantId, scope, entry.refreshToken);
                    await cacheToken(scope, resp, entry.refreshToken);
                    return resp.access_token;
                } catch {
                    // This refresh token doesn't work for this scope
                }
            }
        }
    }

    // Interactive auth via Rust localhost server
    const result = await invoke<AuthFlowResult>('start_auth_flow', {
        clientId,
        tenantId,
        scope,
    });

    const resp = await exchangeCode(clientId, tenantId, result);
    await cacheToken(scope, resp);
    return resp.access_token;
}

export async function clearAuth(): Promise<void> {
    tokenCache.clear();
    await store.clear();
    await store.save();
}
