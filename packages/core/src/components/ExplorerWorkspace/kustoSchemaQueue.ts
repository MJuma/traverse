import type * as Monaco from 'monaco-editor';

import type { RawShowSchema } from '../../services/schema';

import { bootstrapKustoLanguage } from './bootstrapKustoLanguage';

/**
 * Debounce window (ms) used to coalesce successive schema-apply calls
 * triggered by React effects or connection switches.
 */
export const DEBOUNCE_MS = 200;

interface PendingSchema {
    raw: RawShowSchema;
    clusterUri: string;
    dbName: string;
}

// Module-level state.
//
// This module is intentionally a singleton. The Explorer is the only host of
// the KQL editor (see D8 in the migration plan) — multiple side-by-side
// Explorer instances on the same page are out of scope and would currently
// share queue state. If that requirement appears later, wrap this state in a
// factory and instantiate per-Explorer.
let pending: PendingSchema | null = null;
let lastAppliedHash: string | null = null;
let lastAppliedRaw: RawShowSchema | null = null;
let lastAppliedClusterUri: string | null = null;
let lastAppliedDbName: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let awaitingFirstKustoModel = false;
let modelWatcherSub: Monaco.IDisposable | null = null;
let flushing = false;

/** Tiny djb2 — sufficient for content-identity skip; not cryptographic. */
function fastHash(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
}

function warn(message: string, err: unknown): void {
    // eslint-disable-next-line no-console
    console.warn(`[traverse:kustoSchemaQueue] ${message}`, err);
}

export interface ApplyKustoSchemaArgs {
    monaco: typeof Monaco;
    raw: RawShowSchema;
    clusterUri: string;
    dbName: string;
}

/**
 * Queue a Kusto schema to be applied to the language service worker. Latest
 * call wins: if a newer schema arrives before the previous one is applied,
 * the older one is dropped. Debounced by {@link DEBOUNCE_MS} to coalesce
 * bursts from effects/connection switches.
 *
 * A cheap reference-identity skip avoids JSON.stringify on the hot path —
 * the deeper content hash is computed lazily inside the (debounced) flush so
 * the React effect does no heavy work.
 */
export function applyKustoSchema(args: ApplyKustoSchemaArgs): void {
    // Cheap reference-based skip: when the schema cache hands us the same
    // object reference for the same target, we know nothing changed.
    if (
        pending === null &&
        args.raw === lastAppliedRaw &&
        args.clusterUri === lastAppliedClusterUri &&
        args.dbName === lastAppliedDbName
    ) {
        return;
    }
    pending = {
        raw: args.raw,
        clusterUri: args.clusterUri,
        dbName: args.dbName,
    };
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void flush(args.monaco);
    }, DEBOUNCE_MS);
}

async function flush(monaco: typeof Monaco): Promise<void> {
    // Serialize: only one apply at a time. While we're applying, newer
    // payloads can land in `pending`; the while-loop below drains them in
    // order. This prevents an older apply from finishing after a newer one
    // and overwriting the worker's schema (a real correctness bug).
    if (flushing) {
        return;
    }
    flushing = true;
    try {
        while (pending) {
            const snapshot = pending;

            try {
                await bootstrapKustoLanguage(monaco);
            } catch (err) {
                warn('Kusto language bootstrap failed; leaving pending schema for retry.', err);
                return;
            }

            const kustoModel = monaco.editor.getModels().find((m) => m.getLanguageId() === 'kusto');
            if (!kustoModel) {
                // The kusto worker accessor only resolves once a kusto model
                // exists. Defer via a single onDidCreateModel watcher.
                if (!awaitingFirstKustoModel) {
                    awaitingFirstKustoModel = true;
                    modelWatcherSub = monaco.editor.onDidCreateModel((m) => {
                        if (m.getLanguageId() === 'kusto') {
                            modelWatcherSub?.dispose();
                            modelWatcherSub = null;
                            awaitingFirstKustoModel = false;
                            void flush(monaco);
                        }
                    });
                }
                return;
            }

            // Compute the content hash lazily; this is the only place the
            // expensive JSON.stringify happens.
            const hash = fastHash(
                `${snapshot.clusterUri}|${snapshot.dbName}|${JSON.stringify(snapshot.raw)}`,
            );
            if (hash === lastAppliedHash) {
                // Worker already has this exact schema content. Clear pending
                // only if it's still the same snapshot; otherwise let the
                // loop pick up the newer one.
                if (pending === snapshot) {
                    pending = null;
                }
                continue;
            }

            try {
                const mod = await import('@kusto/monaco-kusto');
                const accessor = await mod.getKustoWorker();
                const worker = await accessor(kustoModel.uri);
                await worker.setSchemaFromShowSchema(
                    snapshot.raw,
                    snapshot.clusterUri,
                    snapshot.dbName,
                );
                lastAppliedHash = hash;
                lastAppliedRaw = snapshot.raw;
                lastAppliedClusterUri = snapshot.clusterUri;
                lastAppliedDbName = snapshot.dbName;
                if (pending === snapshot) {
                    pending = null;
                }
                // If pending changed during the apply, the while-loop will
                // pick it up on the next iteration.
            } catch (err) {
                warn('setSchemaFromShowSchema failed; leaving pending schema for retry.', err);
                return;
            }
        }
    } finally {
        flushing = false;
    }
}

/** Test-only: reset queue state between tests. */
export function __resetKustoSchemaQueueForTests(): void {
    pending = null;
    lastAppliedHash = null;
    lastAppliedRaw = null;
    lastAppliedClusterUri = null;
    lastAppliedDbName = null;
    awaitingFirstKustoModel = false;
    flushing = false;
    modelWatcherSub?.dispose();
    modelWatcherSub = null;
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}
