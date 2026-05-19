---
"@mhjuma/traverse": minor
---

Make consumer setup foot-gun-free and add a Vite plugin to reduce boilerplate.

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
