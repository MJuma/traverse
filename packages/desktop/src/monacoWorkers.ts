import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import KustoWorker from '@kusto/monaco-kusto/release/esm/kusto.worker.js?worker';

import { configureTraverseMonacoWorkers } from '@mhjuma/traverse';

// Pre-warmed worker instances. Constructed during browser idle so the
// worker's heavy top-level evaluation (Bridge.NET, ~MB of generated code)
// overlaps with React render + auth init. When Monaco asks for the worker on
// first kusto-model interaction, the factory hands back the warm instance —
// its first message round-trip lands in ~ms instead of ~hundreds of ms, so
// semantic-token colors paint without a visible delay.
let warmEditorWorker: Worker | null = null;
let warmKustoWorker: Worker | null = null;

function takeWarmWorker(label: 'editor' | 'kusto'): Worker {
    if (label === 'editor') {
        const w = warmEditorWorker;
        warmEditorWorker = null;
        return w ?? new EditorWorker();
    }
    const w = warmKustoWorker;
    warmKustoWorker = null;
    return w ?? new KustoWorker();
}

function attachPrewarmErrorRecovery(label: 'editor' | 'kusto', w: Worker): void {
    // Async failures during worker top-level evaluation (Bridge.NET errors,
    // CDN issues, etc.) fire via the `error` event AFTER prewarmWorkers()'s
    // try/catch has already returned. Without this recovery handler, the warm
    // slot would still hold the dead worker, and Monaco would later receive
    // it and post init messages to a worker that can't respond. Evict the
    // failed worker so the factory falls back to a fresh lazy spawn.
    const onError = () => {
        if (label === 'editor' && warmEditorWorker === w) {
            warmEditorWorker = null;
            try { w.terminate(); } catch { /* ignore */ }
        } else if (label === 'kusto' && warmKustoWorker === w) {
            warmKustoWorker = null;
            try { w.terminate(); } catch { /* ignore */ }
        }
    };
    w.addEventListener('error', onError, { once: true });
}

function prewarmWorkers(): void {
    try {
        if (!warmEditorWorker) {
            const w = new EditorWorker();
            attachPrewarmErrorRecovery('editor', w);
            warmEditorWorker = w;
        }
        if (!warmKustoWorker) {
            const w = new KustoWorker();
            attachPrewarmErrorRecovery('kusto', w);
            warmKustoWorker = w;
        }
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[traverse] worker pre-warm failed (sync); falling back to lazy spawn', err);
    }
}

function schedulePrewarm(): void {
    if (typeof window === 'undefined') {
        return;
    }
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(prewarmWorkers, { timeout: 1500 });
    } else {
        setTimeout(prewarmWorkers, 0);
    }
}

/**
 * Wire Monaco's worker factories using Vite's `?worker` URL imports.
 * Must run before any Explorer mount so `globalThis.MonacoEnvironment` is set
 * before the editor first asks for a worker.
 *
 * Also schedules a browser-idle pre-warm of both workers. This is a perceived-
 * perf win — Bridge.NET evaluation in the kusto worker is the slowest single
 * op in the editor's startup path; pre-warming overlaps it with React + auth
 * init so semantic-token colors paint without a visible "upgrade" flash.
 */
export function configureAppMonacoWorkers(): void {
    configureTraverseMonacoWorkers({
        getEditorWorker: () => takeWarmWorker('editor'),
        getKustoWorker: () => takeWarmWorker('kusto'),
    });
    schedulePrewarm();
}
