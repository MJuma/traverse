# @mhjuma/traverse

## 0.4.0

### Minor Changes

- 240f4ba: Make consumer setup foot-gun-free and add a Vite plugin to reduce boilerplate.

  **New:**

  - **`@mhjuma/traverse/vite-plugin`** subpath export — a single Vite plugin that
    bundles the Bridge.NET CJS shim and the `optimizeDeps.include` entries the
    kusto worker's transitive deps need to pre-bundle. Replaces ~50 lines of
    boilerplate in each consumer's `vite.config.ts` with one import + one
    `traverseVitePlugin()` plugin entry. (Consumers still add
    `vite-plugin-node-polyfills` separately — kept out of the plugin so its
    config story stays orthogonal.)
  - **`getMonacoWorkerConfigurationError()`** — sentinel-based assertion that
    detects when `configureTraverseMonacoWorkers` hasn't been called or
    `getKustoWorker` is missing. A host-installed
    `globalThis.MonacoEnvironment.getWorker` is NOT enough — it might not route
    the `'kusto'` label to a real kusto worker.
  - **`<MonacoConfigErrorBanner>`** — actionable placeholder rendered by
    `<Explorer>` when the assertion fails, with the exact code snippet the
    consumer needs to copy. Pure inline styles so it works even without a host
    `<FluentProvider>`. Optional `monacoConfigErrorFallback` prop on `<Explorer>`
    lets embedders supply their own fallback UI.
  - New `KustoClientConfig.fetch?` injection point. Defaults to
    `globalThis.fetch`. Resolved at call time so tests can stub
    `globalThis.fetch` after construction and so hosts can hot-swap their
    transport (Tauri plugin-http) post-mount.

  **Improvements:**

  - **`fetchWithRetry` honours `Retry-After`** (RFC 7231 — both delta-seconds
    and HTTP-date) for both `429` and `503`. Capped at 60s to defend against
    hostile servers / stale dates. Inter-retry sleep is now abort-aware via
    the new `abortableSleep()` helper, so user-initiated cancels no longer have
    to wait for an in-flight backoff to elapse.
  - **MSAL popup post-back bridge handoff.** `bootstrapExplorer` now
    dynamically imports `@azure/msal-browser/redirect-bridge` and calls
    `broadcastResponseToMainFrame()` before any normal app bootstrap. Without
    this, MSAL.js 5.x popup interactions silently failed — the popup would load
    the full SPA and the parent window's `acquireTokenPopup` would time out
    waiting for a `BroadcastChannel` message that only the bridge knows how to
    send. Gracefully degrades for embedders pinned to older MSAL versions.
  - **MSAL recovery from stale URL fragments.** `bootstrapExplorer` now catches
    `no_token_request_cache_error`, `state_not_found`, and `no_state_in_hash`
    from `handleRedirectPromise()`, strips the auth fragments / params from the
    URL, and falls through to the normal silent / loginRedirect flow. Prevents
    the SPA from getting stuck in a loop after a popup that closed before
    posting back.
  - **XSS-hardened auth error banner.** The startup auth-failure banner uses
    safe DOM construction (`createElement` + `textContent`) instead of
    `innerHTML` interpolation. MSAL / AAD error strings can carry
    attacker-controlled content (via `error_description`); the old approach was
    an XSS hazard.
  - **`peerDependencies.monaco-editor` tightened to `^0.52.0`.**
    `@kusto/monaco-kusto@14.x` only supports monaco-editor `^0.52.0`; newer
    versions (0.55+) break the kusto plugin's `createWebWorker` integration in
    subtle ways. The peer pin makes pnpm warn at install time instead of
    letting consumers silently install an incompatible version.

  **Docs:**

  - Rewrote `docs/guide/quick-start.md` with a Vite-first three-step setup
    (workers boilerplate → vite.config.ts with `traverseVitePlugin()` → mount
    the Explorer). Documents the kusto worker setup explicitly so consumers
    don't have to discover it through bug reports.

## 0.3.0

### Minor Changes

- 57f602c: Replace the hand-rolled KQL Monarch tokenizer and regex completion provider
  with the official `@kusto/monaco-kusto` language plugin (Kusto.Language engine
  running in a Web Worker). This gives semantic highlighting, full IntelliSense
  (let-bindings, joins, function defs, plugin functions), hover, signature help,
  diagnostics, and formatting.

  Breaking changes for hosts:

  - `monaco-editor` and `@monaco-editor/react` are now peer dependencies. Hosts
    must install them directly; `monaco-editor` must be pinned to `0.52.x` for
    compatibility with `@kusto/monaco-kusto@14.x`.
  - A new `configureTraverseMonacoWorkers({ getEditorWorker, getKustoWorker })`
    must be called once before mounting `<Explorer>` to wire up the Monaco and
    Kusto language workers. See the Quick Start guide for the Vite recipe and
    notes on Webpack/Next.js hosts.

  Bundle impact: the Kusto language service ships ~6 MB of compiled engine code
  in a dedicated worker chunk, loaded lazily only when an editor mounts.

  Perceived-perf optimizations: the kusto language registers (Monarch tokens
  provider + themes) on first `<Explorer>` render via an internal
  `preloadKustoLanguage()` call, so first paint already shows colored keywords
  and strings. Hosts can additionally pre-warm the kusto worker during
  `requestIdleCallback` (see Quick Start) to overlap Bridge.NET evaluation with
  auth/React init — semantic-token colors then arrive without a visible delay.

## 0.2.0

### Minor Changes

- 286839b: Persist Explorer tabs across sessions and accept a custom default query.

  - New optional `initialQuery` prop on `<Explorer />`. When set, it seeds the
    editor on first load if there's no persisted snapshot and no `?query=`
    URL parameter. Falls back to the package's `DEFAULT_QUERY` when omitted.
  - New `explorerTabs` `StateService` store (persisted to IndexedDB and
    mirrored to localStorage for synchronous bootstrap on page load).
  - The Explorer reducer now hydrates `tabs`, `activeTabId`, and split-pane
    state from a versioned snapshot. Stale connection ids on restored tabs
    are remapped to the active connection so KQL is never lost. Invalid
    split state is reset.
  - The `tabs[]` and split slices are saved with a 300ms debounce on every
    reducer transition that mutates them. Pending writes are flushed on
    component unmount and on `pagehide` so edits made just before a refresh
    or tab close are not dropped.
  - Deep-links with `?query=` continue to win for the initial render and
    are now treated as ephemeral: they bypass the snapshot on load AND do
    not write back to it, so a shared link cannot clobber the user's
    saved workspace.
  - New exports: `loadSnapshot`, `saveSnapshot`, `clearSnapshot`,
    `validateAndCleanSnapshot`, `extractSnapshot`, `SNAPSHOT_VERSION`,
    and the `ExplorerTabsSnapshot` type.

  The IndexedDB schema version is bumped to `2` to create the new object
  store for existing users; no data migration is required.
