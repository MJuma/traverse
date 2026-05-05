---
"@mhjuma/traverse": minor
---

Persist Explorer tabs across sessions and accept a custom default query.

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
