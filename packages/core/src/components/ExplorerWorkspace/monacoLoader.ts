import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

import { bootstrapKustoLanguage } from './bootstrapKustoLanguage';

/**
 * Configure `@monaco-editor/react` to use the locally bundled Monaco instance
 * instead of fetching it from the default CDN. This is required so that any
 * Monaco contributions registered by this library (e.g. `@kusto/monaco-kusto`)
 * attach to the same Monaco instance the `<Editor>` component uses — otherwise
 * contributions are silently dropped ("two Monacos" problem).
 *
 * The call is idempotent and a no-op on the server. It is intentionally
 * lightweight — it only configures the loader. Pre-loading the kusto
 * language is gated behind `preloadKustoLanguage()` so consumers using only
 * non-editor APIs (e.g. `createKustoClient`) do not pay for the multi-MB
 * `@kusto/monaco-kusto` chunk.
 */
let configured = false;
export function configureMonacoLoader(): void {
    if (configured || typeof window === 'undefined') {
        return;
    }
    configured = true;
    loader.config({ monaco });
}

configureMonacoLoader();

/**
 * Trigger registration of the kusto language (Monarch tokens provider, themes,
 * completion/hover providers) ahead of the editor first mounting. Call from
 * any component that will render the KQL editor (e.g. `<Explorer>`) so the
 * dynamic import of `@kusto/monaco-kusto` overlaps with React/auth init —
 * the editor's first paint then shows colored keywords/strings/numbers
 * instead of plain text that "upgrades" a beat later.
 *
 * Editor-gated by design: consumers of `@mhjuma/traverse` that use only
 * non-editor APIs (e.g. `createKustoClient`) should not call this and will
 * not incur the kusto chunk download.
 *
 * Idempotent — repeated calls are no-ops. Errors are swallowed here and
 * surfaced by `ExplorerWorkspace`'s mount-time bootstrap on retry.
 */
let preloadStarted = false;
export function preloadKustoLanguage(): void {
    if (preloadStarted || typeof window === 'undefined') {
        return;
    }
    preloadStarted = true;
    void bootstrapKustoLanguage(monaco).catch(() => { /* surfaced in ExplorerWorkspace */ });
}

/** Test-only: reset preload state so each test exercises the first-call path. */
export function __resetPreloadStateForTests(): void {
    preloadStarted = false;
}
