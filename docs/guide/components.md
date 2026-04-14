# Components

## Explorer

The root component. Creates all context providers (colors, state, kusto) and renders the `ExplorerWorkspace`.

```tsx
<Explorer isDark={isDark} kustoClient={client} colors={colors} clusters={clusters} />
```

## ExplorerWorkspace

The main workspace UI containing the editor, results panel, sidebar, and toolbar. Not typically used directly — use `Explorer` instead.

## EditorToolbar

Toolbar with Run, Cancel, Recall, Format buttons, connection/database dropdowns, and keyboard shortcuts modal.

## TabBar

Query tab strip with add/close/rename. Each tab binds to a specific cluster connection (shown as a colored dot).

## SchemaSidebar

Database schema tree browser with:
- Folder-organized tables, functions, materialized views
- Type badges: **fn** (green), **MV** (purple), **LU** (orange)
- Search/filter with column name highlighting
- Right-click context menu (insert name, take 100, count, schema, date range)
- Drag-and-drop into the editor
- Resizable width (140–500px)

## ResultsPanel

Tab bar for Results/Chart/History views with status bar and result display.

### ResultsTable

Virtual-scrolled data table with:
- Column sorting (asc → desc → none cycle)
- Per-column text filters
- Global search
- Hide empty columns toggle
- Column visibility picker
- Selection aggregates: Count, Sum, Avg, Min, Max, P50, P75, P90
- CSV/JSON export

### ChartPanel

Auto-detected Vega-Lite charts with:
- 6 chart types: Bar, Line, Stacked Area, Donut, Grouped Bar, Scatter
- Auto-detection from column types (datetime → line, string+number → bar, etc.)
- Manual X/Y/Color axis override dropdowns
- Canvas renderer, limited to 1,000 rows for performance

## ConnectionDialog

Multi-cluster connection management:
- Edit connection names, cycle colors, change databases
- Drag-and-drop reorder
- Add new connections with "Test Connection" validation

## VegaChart

Vega-Lite chart wrapper with:
- Dark/light theme support
- ResizeObserver-based responsive sizing
- Tooltip support via vega-tooltip
- Error boundary (graceful fallback on render failure)
