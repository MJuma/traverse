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
    installMonacoEnvironment();
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
    if (typeof window !== 'undefined') {
        const g = globalThis as unknown as GlobalWithMonaco;
        delete g.MonacoEnvironment;
    }
}
