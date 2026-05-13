# @mhjuma/traverse

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
