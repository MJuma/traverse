import {
    Input,
    Button,
    Tooltip,
    Popover,
    PopoverTrigger,
    PopoverSurface,
} from '@fluentui/react-components';
import {
    SearchRegular,
    ColumnTripleRegular,
    EyeOffRegular,
    FilterRegular,
    DismissRegular,
    DismissCircleRegular,
    HighlightRegular,
    CodeRegular,
    TableSimpleRegular,
    TextBulletListRegular,
} from '@fluentui/react-icons';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from 'react';

import {
    parseHighlightExpr,
    matchesHighlight,
    computeAggregates,
    computeDateDelta,
    computeColumnWidths,
    sortRows,
    filterRows,
    findEmptyColumns,
    buildSelectionTsv,
} from './ResultsTable.logic';
import type { SortDir, CellRange } from './ResultsTable.logic';
import { useStyles } from './ResultsTable.styles';
import { useExplorerColors } from '../../context/ExplorerColorContext';
import { ColumnHeader } from './ColumnHeader';
import { FilterCell } from './FilterCell';
import { VirtualRow } from './VirtualRow';
import { ColumnPickerItem } from './ColumnPickerItem';

// Lazy-load Monaco — only used in JSON detail view
const Editor = lazy(() => import('@monaco-editor/react'));

const ROW_HEIGHT = 28;
const EXPAND_COL_WIDTH = 24;
const MIN_DETAIL_WIDTH = 200;
const MAX_DETAIL_WIDTH = 800;

// --- Styles ---

// --- Module-level constants ---

const searchIcon = <SearchRegular fontSize={14} />;
const dismissSmallIcon = <DismissRegular fontSize={12} />;
const filterIcon = <FilterRegular />;
const eyeOffIcon = <EyeOffRegular />;
const columnTripleIcon = <ColumnTripleRegular />;
const highlightIcon = <HighlightRegular fontSize={14} />;
const dismissCircleIcon = <DismissCircleRegular />;
const tableSimpleIcon = <TableSimpleRegular />;
const textBulletListIcon = <TextBulletListRegular />;
const codeIcon = <CodeRegular />;

const flexOneStyle = { flex: 1 };
const minWidthAutoStyle = { minWidth: 'auto' };
const minWidthAutoPaddingZeroStyle = { minWidth: 'auto', padding: 0 };
const overflowAutoStyle = { overflow: 'auto' };
const fullHeightStyle = { height: '100%' };
const expandColPlaceholderStyle = { width: EXPAND_COL_WIDTH, minWidth: EXPAND_COL_WIDTH, flexShrink: 0 };

const monacoOptions = {
    readOnly: true,
    minimap: { enabled: false },
    lineNumbers: 'off' as const,
    scrollBeyondLastLine: false,
    folding: true,
    fontSize: 12,
    wordWrap: 'on' as const,
    padding: { top: 8, bottom: 8 },
};

const monacoFallback = <div style={fullHeightStyle} />;

interface Props {
    columns: string[];
    rows: Record<string, unknown>[];
    headerLeft?: React.ReactNode;
    headerRight?: React.ReactNode;
    isDark?: boolean;
    columnTypes?: Record<string, string>;
}

export function ResultsTable({ columns, rows, headerLeft, headerRight, isDark, columnTypes }: Props) {
    const styles = useStyles();
    const { semantic } = useExplorerColors();
    const scrollRef = useRef<HTMLDivElement>(null);
    const isDraggingCells = useRef(false);

    useEffect(() => {
        const id = 'traverse-scrollbar-style';
        if (!document.getElementById(id)) {
            const style = document.createElement('style');
            style.id = id;
            style.textContent = `
                .traverse-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
                .traverse-scroll::-webkit-scrollbar-track { background: transparent; }
                .traverse-scroll::-webkit-scrollbar-thumb { background: ${semantic.scrollThumb}; border-radius: 4px; }
                .traverse-scroll::-webkit-scrollbar-thumb:hover { background: ${semantic.scrollThumbHover}; }
            `;
            document.head.appendChild(style);
        }
    }, [semantic.scrollThumb, semantic.scrollThumbHover]);

    // --- State ---
    const [globalSearch, setGlobalSearch] = useState('');
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>(null);
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
    const [hideEmpty, setHideEmpty] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [selection, setSelection] = useState<CellRange | null>(null);
    const [detailRowIdx, setDetailRowIdx] = useState<number | null>(null);
    const [detailWidth, setDetailWidth] = useState(320);
    const [detailMode, setDetailMode] = useState<'table' | 'list' | 'json'>('table');
    const [highlightExpr, setHighlightExpr] = useState('');
    const previousDatasetRef = useRef<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);

    useEffect(() => {
        if (!previousDatasetRef.current) {
            previousDatasetRef.current = { columns, rows };
            return;
        }
        if (previousDatasetRef.current.columns === columns && previousDatasetRef.current.rows === rows) {
            return;
        }
        previousDatasetRef.current = { columns, rows };
        setGlobalSearch('');
        setColumnFilters({});
        setSortColumn(null);
        setSortDir(null);
        setHiddenColumns(new Set());
        setHideEmpty(false);
        setShowFilters(false);
        setSelection(null);
        setDetailRowIdx(null);
        setHighlightExpr('');
        scrollRef.current?.scrollTo({ top: 0 });
    }, [columns, rows]);

    // --- Derived data ---
    const emptyColumns = useMemo(() => findEmptyColumns(columns, rows), [columns, rows]);

    const visibleColumns = useMemo(() =>
        columns.filter((c) => !hiddenColumns.has(c) && !(hideEmpty && emptyColumns.has(c))),
    [columns, hiddenColumns, hideEmpty, emptyColumns]);

    const columnWidths = useMemo(() => {
        const widthArr = computeColumnWidths(visibleColumns, rows, columnTypes);
        const widths: Record<string, number> = {};
        visibleColumns.forEach((col, i) => { widths[col] = widthArr[i]; });
        return widths;
    }, [visibleColumns, rows, columnTypes]);

    const filteredRows = useMemo(
        () => filterRows(rows, visibleColumns, globalSearch, columnFilters),
        [rows, globalSearch, columnFilters, visibleColumns],
    );

    const sortedRows = useMemo(
        () => sortRows(filteredRows, sortColumn, sortDir),
        [filteredRows, sortColumn, sortDir],
    );

    const parsedHighlight = useMemo(() => parseHighlightExpr(highlightExpr), [highlightExpr]);

    // --- Selection aggregates ---
    const selectionStats = useMemo((): { cells: number; aggs: Record<string, string>; dateDelta: string | null } | null => {
        if (!selection) {
            return null;
        }
        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxRow = Math.max(selection.startRow, selection.endRow);
        const minCol = Math.min(selection.startCol, selection.endCol);
        const maxCol = Math.max(selection.startCol, selection.endCol);
        const cellCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
        if (cellCount < 2) {
            return null;
        }
        const nums: number[] = [];
        const dateStrs: string[] = [];
        for (let r = minRow; r <= maxRow && r < sortedRows.length; r++) {
            for (let c = minCol; c <= maxCol && c < visibleColumns.length; c++) {
                const v = sortedRows[r][visibleColumns[c]];
                if (v === null || v === undefined || v === '') {
                    continue;
                }
                const n = Number(v);
                if (!isNaN(n)) {
                    nums.push(n);
                }
                const s = String(v as string | number);
                if (s.match(/^\d{4}-\d{2}-\d{2}/) && !isNaN(new Date(s).getTime())) {
                    dateStrs.push(s);
                }
            }
        }
        return { cells: cellCount, aggs: computeAggregates(nums), dateDelta: computeDateDelta(dateStrs) };
    }, [selection, sortedRows, visibleColumns]);

    const detailData = useMemo(() => {
        if (detailRowIdx === null || detailRowIdx >= sortedRows.length) {
            return null;
        }
        return sortedRows[detailRowIdx];
    }, [detailRowIdx, sortedRows]);

    const detailJson = useMemo(() => {
        if (!detailData) {
            return '';
        }
        return JSON.stringify(detailData, null, 2);
    }, [detailData]);

    const virtualizer = useVirtualizer({
        count: sortedRows.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 20,
    });

    // --- Handlers ---
    const toggleSort = useCallback((col: string) => {
        setSortColumn((prev) => {
            if (prev !== col) { setSortDir('asc'); return col; }
            setSortDir((d) => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
            return prev;
        });
    }, []);

    const setFilter = useCallback((col: string, value: string) => {
        setColumnFilters((prev) => ({ ...prev, [col]: value }));
    }, []);

    const toggleColumn = useCallback((col: string) => {
        setHiddenColumns((prev) => { const next = new Set(prev); if (next.has(col)) next.delete(col); else next.add(col); return next; });
    }, []);

    const handleCellMouseDown = useCallback((rowIdx: number, colIdx: number, e: React.MouseEvent) => {
        scrollRef.current?.focus();
        if (e.shiftKey && selection) {
            setSelection({ startRow: selection.startRow, startCol: selection.startCol, endRow: rowIdx, endCol: colIdx });
        } else {
            setSelection({ startRow: rowIdx, startCol: colIdx, endRow: rowIdx, endCol: colIdx });
            isDraggingCells.current = true;
        }
    }, [selection]);

    const handleCellMouseEnter = useCallback((rowIdx: number, colIdx: number) => {
        if (!isDraggingCells.current || !selection) {
            return;
        }
        setSelection((prev) => prev ? { ...prev, endRow: rowIdx, endCol: colIdx } : null);
    }, [selection]);

    useEffect(() => {
        const onUp = () => { isDraggingCells.current = false; };
        document.addEventListener('mouseup', onUp);
        return () => document.removeEventListener('mouseup', onUp);
    }, []);

    const handleHeaderColClick = useCallback((colIdx: number) => {
        scrollRef.current?.focus();
        setSelection({ startRow: 0, startCol: colIdx, endRow: sortedRows.length - 1, endCol: colIdx });
    }, [sortedRows.length]);

    const handleCopy = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
        const selectionText = buildSelectionTsv(sortedRows, visibleColumns, selection);
        if (!selectionText) {
            return;
        }
        e.preventDefault();
        e.clipboardData.setData('text/plain', selectionText);
    }, [selection, sortedRows, visibleColumns]);

    // Detail panel resize
    const onDetailDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = detailWidth;
        const onMove = (ev: MouseEvent) => {
            const delta = startX - ev.clientX;
            setDetailWidth(Math.max(MIN_DETAIL_WIDTH, Math.min(MAX_DETAIL_WIDTH, startWidth + delta)));
        };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [detailWidth]);

    // --- Toolbar handlers ---
    const handleGlobalSearchChange = useCallback((_: unknown, d: { value: string }) => setGlobalSearch(d.value), []);
    const clearGlobalSearch = useCallback(() => setGlobalSearch(''), []);
    const toggleFilters = useCallback(() => setShowFilters((p) => !p), []);
    const toggleHideEmpty = useCallback(() => setHideEmpty((p) => !p), []);
    const handleHighlightChange = useCallback((_: unknown, d: { value: string }) => setHighlightExpr(d.value), []);
    const clearHighlight = useCallback(() => setHighlightExpr(''), []);
    const showAllColumns = useCallback(() => setHiddenColumns(new Set()), []);
    const hideAllColumns = useCallback(() => setHiddenColumns(new Set(columns)), [columns]);
    const setDetailModeTable = useCallback(() => setDetailMode('table'), []);
    const setDetailModeList = useCallback(() => setDetailMode('list'), []);
    const setDetailModeJson = useCallback(() => setDetailMode('json'), []);
    const closeDetail = useCallback(() => setDetailRowIdx(null), []);

    // --- Memoized JSX for Input contentBefore/contentAfter ---
    const searchContentAfter = useMemo(() =>
        globalSearch ? <Button appearance="transparent" icon={dismissSmallIcon} size="small" onClick={clearGlobalSearch} style={minWidthAutoPaddingZeroStyle} /> : undefined,
    [globalSearch, clearGlobalSearch]);

    const highlightContentAfter = useMemo(() =>
        highlightExpr ? <Button appearance="transparent" icon={dismissSmallIcon} size="small" onClick={clearHighlight} style={minWidthAutoPaddingZeroStyle} /> : undefined,
    [highlightExpr, clearHighlight]);

    // --- Memoized styles ---
    const hasActiveFilters = Object.values(columnFilters).some((v) => v.length > 0);
    const totalWidth = useMemo(() => EXPAND_COL_WIDTH + visibleColumns.reduce((sum, col) => sum + columnWidths[col], 0), [visibleColumns, columnWidths]);
    const innerTableStyle = useMemo(() => ({ minWidth: totalWidth, fontFamily: 'Consolas, Monaco, monospace', fontSize: '12px' }), [totalWidth]);
    const theadStyle = useMemo(() => ({ width: totalWidth }), [totalWidth]);
    const totalHeight = virtualizer.getTotalSize();
    const virtualizerContainerStyle = useMemo(() => ({ height: totalHeight, position: 'relative' as const }), [totalHeight]);
    const detailPanelStyle = useMemo(() => ({ width: detailWidth, minWidth: detailWidth }), [detailWidth]);

    return (
        <div className={styles.container}>
            <div className={styles.toolbar}>
                {headerLeft}
                <div style={flexOneStyle} />
                <Input className={styles.searchInput} contentBefore={searchIcon} placeholder="Search..." size="small"
                    value={globalSearch} onChange={handleGlobalSearchChange} contentAfter={searchContentAfter} />
                <Tooltip content="Toggle column filters" relationship="label">
                    <Button appearance="subtle" icon={filterIcon} className={hasActiveFilters || showFilters ? styles.activeFilter : undefined}
                        size="small" onClick={toggleFilters} />
                </Tooltip>
                <Tooltip content="Hide empty columns" relationship="label">
                    <Button appearance="subtle" icon={eyeOffIcon} className={hideEmpty ? styles.activeFilter : undefined}
                        size="small" onClick={toggleHideEmpty} />
                </Tooltip>
                <Popover>
                    <PopoverTrigger>
                        <Tooltip content="Choose columns" relationship="label">
                            <Button appearance="subtle" icon={columnTripleIcon} size="small" />
                        </Tooltip>
                    </PopoverTrigger>
                    <PopoverSurface>
                        <div className={styles.colPickerList}>
                            {columns.map((col) => (
                                <ColumnPickerItem key={col} col={col} isEmpty={emptyColumns.has(col)}
                                    isHidden={hiddenColumns.has(col)} toggleColumn={toggleColumn} />
                            ))}
                        </div>
                        <div className={styles.colPickerActions}>
                            <Button size="small" appearance="subtle" onClick={showAllColumns}>Show all</Button>
                            <Button size="small" appearance="subtle" onClick={hideAllColumns}>Hide all</Button>
                        </div>
                    </PopoverSurface>
                </Popover>
                <Input className={styles.highlightInput} contentBefore={highlightIcon}
                    placeholder="Highlight: col op val" size="small" value={highlightExpr}
                    onChange={handleHighlightChange} contentAfter={highlightContentAfter} />
                {headerRight}
            </div>

            <div className={styles.bodyArea}>
                <div className={`${styles.scrollContainer} traverse-scroll`} ref={scrollRef} style={overflowAutoStyle}
                    role="grid" tabIndex={0} onCopy={handleCopy}>
                    <div style={innerTableStyle}>
                        <div className={styles.thead} style={theadStyle}>
                            <div className={styles.thRow}>
                                <div className={styles.thExpand} />
                                {visibleColumns.map((col, colIdx) => (
                                    <ColumnHeader key={col} col={col} colIdx={colIdx} width={columnWidths[col]}
                                        colType={columnTypes?.[col]} sortColumn={sortColumn} sortDir={sortDir}
                                        toggleSort={toggleSort} handleHeaderColClick={handleHeaderColClick} styles={styles} />
                                ))}
                            </div>
                            {showFilters && (
                                <div className={styles.filterRow}>
                                    <div style={expandColPlaceholderStyle} />
                                    {visibleColumns.map((col) => (
                                        <FilterCell key={col} col={col} width={columnWidths[col]}
                                            value={columnFilters[col] ?? ''} setFilter={setFilter} styles={styles} />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={virtualizerContainerStyle}>
                            {virtualizer.getVirtualItems().map((vRow) => {
                                const row = sortedRows[vRow.index];
                                const isDetailOpen = detailRowIdx === vRow.index;
                                const exprMatch = parsedHighlight ? matchesHighlight(row, parsedHighlight) : false;
                                return (
                                    <VirtualRow key={vRow.key} vRow={vRow} row={row}
                                        isDetailOpen={isDetailOpen} exprMatch={exprMatch}
                                        visibleColumns={visibleColumns} columnWidths={columnWidths}
                                        selection={selection} totalWidth={totalWidth} styles={styles}
                                        setDetailRowIdx={setDetailRowIdx} handleCellMouseDown={handleCellMouseDown}
                                        handleCellMouseEnter={handleCellMouseEnter} />
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Detail panel */}
                {detailData && (
                    <>
                        <div className={styles.detailDragHandle} role="separator" onMouseDown={onDetailDragStart} />
                        <div className={styles.detailPanel} style={detailPanelStyle}>
                            <div className={styles.detailHeader}>
                                <div className={styles.detailHeaderLeft}>
                                    <span>Row {(detailRowIdx ?? 0) + 1}</span>
                                    <Tooltip content="Table view" relationship="label">
                                        <Button appearance="subtle" icon={tableSimpleIcon} size="small"
                                            className={detailMode === 'table' ? styles.activeFilter : undefined}
                                            onClick={setDetailModeTable} style={minWidthAutoStyle} />
                                    </Tooltip>
                                    <Tooltip content="List view" relationship="label">
                                        <Button appearance="subtle" icon={textBulletListIcon} size="small"
                                            className={detailMode === 'list' ? styles.activeFilter : undefined}
                                            onClick={setDetailModeList} style={minWidthAutoStyle} />
                                    </Tooltip>
                                    <Tooltip content="JSON view" relationship="label">
                                        <Button appearance="subtle" icon={codeIcon} size="small"
                                            className={detailMode === 'json' ? styles.activeFilter : undefined}
                                            onClick={setDetailModeJson} style={minWidthAutoStyle} />
                                    </Tooltip>
                                </div>
                                <Button appearance="subtle" icon={dismissCircleIcon} size="small"
                                    onClick={closeDetail} style={minWidthAutoStyle} />
                            </div>
                            {detailMode === 'table' && (
                                <div className={styles.detailBody}>
                                    {columns.map((col) => {
                                        const val = detailData[col];
                                        const display = val === null || val === undefined ? ''
                                            : typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val as string | number | boolean);
                                        return (
                                            <div key={col} className={styles.detailRow}>
                                                <span className={styles.detailKey} title={col}>{col}</span>
                                                <span className={styles.detailValue}>{display}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {detailMode === 'list' && (
                                <div className={styles.detailBody}>
                                    {columns.map((col) => {
                                        const val = detailData[col];
                                        const display = val === null || val === undefined ? ''
                                            : typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val as string | number | boolean);
                                        return (
                                            <div key={col} className={styles.detailListRow}>
                                                <span className={styles.detailListKey}>{col}</span>
                                                <span className={styles.detailListValue}>{display}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {detailMode === 'json' && (
                                <div className={styles.detailMonaco}>
                                    <Suspense fallback={monacoFallback}>
                                    <Editor height="100%" language="json" theme={isDark ? 'vs-dark' : 'vs'}
                                        value={detailJson} options={monacoOptions} />
                                    </Suspense>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <div className={styles.statusBar}>
                <div className={styles.statusLeft}>
                    <span>{sortedRows.length.toLocaleString()} / {rows.length.toLocaleString()} rows</span>
                    <span>{visibleColumns.length} / {columns.length} columns</span>
                    {parsedHighlight && <span>Highlighting: {highlightExpr}</span>}
                </div>
                {selectionStats && (
                    <div className={styles.statusRight}>
                        <span className={styles.statHighlight}>Selected: {selectionStats.cells} cells</span>
                        {Object.entries(selectionStats.aggs).map(([key, val]) => <span key={key}>{key}: {val}</span>)}
                        {selectionStats.dateDelta && <span>Δ Time: {selectionStats.dateDelta}</span>}
                    </div>
                )}
            </div>
        </div>
    );
}
