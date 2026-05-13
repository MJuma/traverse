import type { LanguageSettings } from '@kusto/monaco-kusto';
import type * as Monaco from 'monaco-editor';

/**
 * Default language settings applied on the first bootstrap call.
 *
 * Notes:
 * - `completionOptions` is required by `@kusto/monaco-kusto@14.x`.
 * - Several legacy flags (`useIntellisenseV2`, `useSemanticColorization`,
 *   `useTokenColorization`) were removed in v12+ and must not be set.
 * - Semantic highlighting is gated by the Monaco editor option
 *   `'semanticHighlighting.enabled'`, not by language settings.
 */
const DEFAULT_LANGUAGE_SETTINGS: LanguageSettings = {
    enableHover: true,
    enableQueryWarnings: true,
    enableQuerySuggestions: true,
    includeControlCommands: true,
    completionOptions: { includeExtendedSyntax: false },
};

export interface BootstrapKustoLanguageOptions {
    /**
     * Override or extend the default language settings. The merge is shallow —
     * fields supplied here replace the defaults entirely.
     */
    languageSettings?: Partial<LanguageSettings>;
    /**
     * Worker idle timeout in milliseconds. Defaults to the engine's built-in
     * value (effectively never idles out so the schema stays resident).
     */
    workerMaxIdleTimeMs?: number;
}

let bootstrapPromise: Promise<void> | null = null;

/**
 * Lazily loads `@kusto/monaco-kusto` and registers the `kusto` language against
 * the provided Monaco instance. Idempotent — repeated calls return the same
 * promise. The dynamic import is performed exactly once per process; if the
 * import fails, the cached promise is cleared so a later call can retry.
 */
export function bootstrapKustoLanguage(
    monaco: typeof Monaco,
    options: BootstrapKustoLanguageOptions = {},
): Promise<void> {
    if (bootstrapPromise) {
        return bootstrapPromise;
    }
    bootstrapPromise = doBootstrap(monaco, options).catch((err) => {
        bootstrapPromise = null;
        throw err;
    });
    return bootstrapPromise;
}

async function doBootstrap(
    monaco: typeof Monaco,
    options: BootstrapKustoLanguageOptions,
): Promise<void> {
    const mod = await import('@kusto/monaco-kusto');
    const defaults = mod.kustoDefaults;
    if (!defaults || typeof defaults.setLanguageSettings !== 'function') {
        throw new Error(
            'Traverse: @kusto/monaco-kusto did not expose kustoDefaults.setLanguageSettings. ' +
            'This usually means a duplicate monaco-editor was loaded — verify configureMonacoLoader ran.',
        );
    }
    const settings: LanguageSettings = {
        ...DEFAULT_LANGUAGE_SETTINGS,
        ...options.languageSettings,
        completionOptions:
            options.languageSettings?.completionOptions ??
            DEFAULT_LANGUAGE_SETTINGS.completionOptions,
    };
    defaults.setLanguageSettings(settings);
    if (typeof options.workerMaxIdleTimeMs === 'number') {
        defaults.setMaximumWorkerIdleTime(options.workerMaxIdleTimeMs);
    }
    // Sanity check: confirm the plugin registered against this Monaco instance.
    // If `loader.config({ monaco })` was missed, the plugin will have decorated a
    // different Monaco copy and the `kusto` language id won't be present here.
    const registered = monaco.languages.getLanguages().some((l) => l.id === 'kusto');
    if (!registered) {
        throw new Error(
            'Traverse: @kusto/monaco-kusto registered against a different Monaco instance ' +
            'than the editor host. Ensure `configureMonacoLoader` runs before any editor mounts.',
        );
    }
}

/** Test-only: reset the cached bootstrap promise. */
export function __resetBootstrapForTests(): void {
    bootstrapPromise = null;
}
