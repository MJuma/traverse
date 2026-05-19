/**
 * Worker factory: returns a fresh `Worker` instance that monaco-editor (or
 * `@kusto/monaco-kusto`) will dispatch messages to.
 */
export type MonacoWorkerFactory = () => Worker;

export interface MonacoWorkerConfig {
    /**
     * Factory for monaco-editor's base "editor worker service" — required for
     * features like undo coalescing, find/replace, and large-document diffing.
     * Will be invoked for any worker label other than `"kusto"`.
     */
    getEditorWorker?: MonacoWorkerFactory;
    /**
     * Factory for `@kusto/monaco-kusto`'s language-service worker (parser,
     * binder, IntelliSense, diagnostics). Invoked when Monaco requests a
     * worker with label `"kusto"`.
     */
    getKustoWorker?: MonacoWorkerFactory;
}

let currentConfig: MonacoWorkerConfig = {};
let installed = false;
let configuredByTraverse = false;
/** Captured at first install: was there a pre-existing host
 *  `MonacoEnvironment.getWorker` we can fall back to for non-kusto labels?
 *  Determines whether `getEditorWorker` is strictly required. */
let hadPreviousHostWorker = false;

interface GlobalWithMonaco {
    MonacoEnvironment?: { getWorker?: (workerId: string, label: string) => Worker };
}

/**
 * Configure how `@mhjuma/traverse` obtains Monaco web workers. Must be called
 * once, before mounting `<Explorer>`. Bundler-aware hosts (Vite, webpack)
 * typically construct workers via `new Worker(new URL(..., import.meta.url))`
 * or `import Worker from '...?worker'` and pass the factories here.
 *
 * Calling more than once replaces the previous configuration. Subsequent
 * Monaco worker spawns will pick up the new factories.
 */
export function configureTraverseMonacoWorkers(config: MonacoWorkerConfig): void {
    currentConfig = config;
    configuredByTraverse = true;
    installMonacoEnvironment();
}

export interface MonacoWorkerConfigurationError {
    /**
     * Discriminator:
     * - `'missing-kusto-worker'` — no `getKustoWorker` (or configure was never called).
     * - `'missing-editor-worker'` — `getKustoWorker` is set but `getEditorWorker`
     *   is also missing and there is no pre-existing host
     *   `MonacoEnvironment.getWorker` to fall back to. Without one of these,
     *   Monaco will throw at runtime when it requests the editor worker (e.g.
     *   for find-in-buffer, default color detection, etc).
     */
    kind: 'missing-kusto-worker' | 'missing-editor-worker';
    /** Short summary suitable for the banner heading. */
    summary: string;
    /** Multi-line actionable hint with the exact code the consumer needs. */
    hint: string;
}

/**
 * Returns `null` when Monaco workers are wired up correctly, otherwise an
 * `Error`-shaped object describing what's missing and how to fix it.
 *
 * We rely on a sentinel (`configuredByTraverse`) rather than inspecting
 * `globalThis.MonacoEnvironment.getWorker` directly. A host may have set
 * `getWorker` for its own non-kusto editors, but if it doesn't route
 * `label === 'kusto'` to a real kusto worker, the kusto language plugin
 * still breaks silently with the cascading errors
 * (`Missing requestHandler or method: normalizeSchema`, etc).
 *
 * Also catches the partial-config case: when `getKustoWorker` is present
 * but `getEditorWorker` is missing AND there's no pre-existing host
 * `MonacoEnvironment.getWorker` to fall back to. Without one of those,
 * Monaco's editor worker requests (find/replace, color detection, large
 * doc diffing) will throw at runtime — same poor UX as the
 * missing-kusto-worker case, just surfaced later.
 */
export function getMonacoWorkerConfigurationError(): MonacoWorkerConfigurationError | null {
    if (typeof window === 'undefined') {
        // SSR / Node — no workers to configure.
        return null;
    }
    if (!configuredByTraverse || !currentConfig.getKustoWorker) {
        return {
            kind: 'missing-kusto-worker',
            summary: 'Monaco workers are not configured.',
            hint:
                'Call configureTraverseMonacoWorkers({ getEditorWorker, getKustoWorker }) ' +
                'before mounting <Explorer>. The `?worker` import suffix is bundler-specific, ' +
                "so this package can't ship the worker factories itself — each consumer wires " +
                'them through their own bundler.\n\n' +
                'For Vite hosts, add this to a module imported at app startup:\n\n' +
                "import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';\n" +
                "import KustoWorker from '@kusto/monaco-kusto/release/esm/kusto.worker.js?worker';\n" +
                "import { configureTraverseMonacoWorkers } from '@mhjuma/traverse';\n\n" +
                'configureTraverseMonacoWorkers({\n' +
                '    getEditorWorker: () => new EditorWorker(),\n' +
                '    getKustoWorker: () => new KustoWorker(),\n' +
                '});',
        };
    }
    if (!currentConfig.getEditorWorker && !hadPreviousHostWorker) {
        return {
            kind: 'missing-editor-worker',
            summary: 'Monaco editor worker is not configured.',
            hint:
                'configureTraverseMonacoWorkers() was called with `getKustoWorker` but no ' +
                '`getEditorWorker`, and the host has not installed a fallback ' +
                '`globalThis.MonacoEnvironment.getWorker`. Monaco needs an editor worker for ' +
                'features like find/replace, color detection, and large-document diffing — ' +
                'without one it will throw at runtime when those fire.\n\n' +
                'Add `getEditorWorker` alongside your existing `getKustoWorker`:\n\n' +
                "import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';\n\n" +
                'configureTraverseMonacoWorkers({\n' +
                '    getEditorWorker: () => new EditorWorker(),\n' +
                '    getKustoWorker: /* your existing factory */,\n' +
                '});',
        };
    }
    return null;
}

function installMonacoEnvironment(): void {
    if (typeof window === 'undefined') {
        return;
    }
    if (installed) {
        return;
    }
    installed = true;
    const g = globalThis as unknown as GlobalWithMonaco;
    const previous = g.MonacoEnvironment;
    hadPreviousHostWorker = typeof previous?.getWorker === 'function';
    g.MonacoEnvironment = {
        ...(previous ?? {}),
        getWorker(workerId: string, label: string): Worker {
            if (label === 'kusto') {
                if (currentConfig.getKustoWorker) {
                    return currentConfig.getKustoWorker();
                }
                throw new Error(
                    '[traverse] No Kusto worker factory configured. Call ' +
                    'configureTraverseMonacoWorkers({ getKustoWorker }) before mounting <Explorer>.',
                );
            }
            if (currentConfig.getEditorWorker) {
                return currentConfig.getEditorWorker();
            }
            if (previous?.getWorker) {
                return previous.getWorker(workerId, label);
            }
            throw new Error(
                `[traverse] No Monaco worker factory configured for label "${label}". Call ` +
                'configureTraverseMonacoWorkers({ getEditorWorker }) before mounting <Explorer>.',
            );
        },
    };
}

/**
 * Test-only escape hatch. Resets the module's internal state so each test can
 * exercise the first-install path. Not exported from the package index.
 */
export function __resetWorkerConfigForTests(): void {
    currentConfig = {};
    installed = false;
    configuredByTraverse = false;
    hadPreviousHostWorker = false;
    if (typeof window !== 'undefined') {
        const g = globalThis as unknown as GlobalWithMonaco;
        delete g.MonacoEnvironment;
    }
}
