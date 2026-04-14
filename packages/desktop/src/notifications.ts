import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

import type { KustoClient, KustoResult, KustoTarget, QueryPriority, QueryKustoOptions } from '@mhjuma/traverse';

let notificationsAllowed = false;

async function ensurePermission(): Promise<boolean> {
    if (notificationsAllowed) {
        return true;
    }
    let granted = await isPermissionGranted();
    if (!granted) {
        const result = await requestPermission();
        granted = result === 'granted';
    }
    notificationsAllowed = granted;
    return granted;
}

function isAppHidden(): boolean {
    return document.hidden;
}

/**
 * Wraps a KustoClient to send native notifications when queries complete
 * while the app window is not focused.
 */
export function withNotifications(client: KustoClient): KustoClient {
    return {
        ...client,
        queryKusto<T = Record<string, unknown>>(
            kql: string,
            signal?: AbortSignal,
            priority?: QueryPriority,
            target?: KustoTarget,
            options?: QueryKustoOptions,
        ): Promise<KustoResult<T>> {
            const wasHidden = isAppHidden();
            const start = Date.now();

            return client.queryKusto<T>(kql, signal, priority, target, options).then(
                (result) => {
                    const elapsed = Date.now() - start;
                    if (wasHidden && elapsed > 2000) {
                        void notifyQueryComplete(kql, result.rows.length, elapsed);
                    }
                    return result;
                },
                (err) => {
                    if (wasHidden) {
                        void notifyQueryFailed(kql, err);
                    }
                    throw err;
                },
            );
        },
    };
}

function truncateQuery(kql: string, maxLen = 60): string {
    const oneLine = kql.replace(/\n/g, ' ').trim();
    if (oneLine.length <= maxLen) {
        return oneLine;
    }
    return oneLine.slice(0, maxLen - 1) + '…';
}

async function notifyQueryComplete(kql: string, rowCount: number, elapsedMs: number): Promise<void> {
    if (!await ensurePermission()) {
        return;
    }
    const seconds = (elapsedMs / 1000).toFixed(1);
    sendNotification({
        title: 'Query Complete',
        body: `${truncateQuery(kql)}\n${rowCount} rows in ${seconds}s`,
    });
}

async function notifyQueryFailed(kql: string, err: unknown): Promise<void> {
    if (!await ensurePermission()) {
        return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    sendNotification({
        title: 'Query Failed',
        body: `${truncateQuery(kql)}\n${msg}`,
    });
}
