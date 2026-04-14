import { Editor } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';

import { useExplorerColors } from '../../context/ExplorerColorContext';
import type { KustoTarget } from '../../services/kusto';
import { normalizeQuery, getHistory, saveHistoryEntry, recallResult } from '../../services/queryHistory';
import type { QueryHistoryEntry } from '../../services/queryHistory';
import { getSchema, loadSchema } from '../../services/schema';
import { EditorToolbar } from '../EditorToolbar/EditorToolbar';
import { ResultsPanel } from '../ResultsPanel/ResultsPanel';
import { SchemaSidebar } from '../SchemaSidebar/SchemaSidebar';
import { TabBar } from '../TabBar/TabBar';
import { useExplorerState, useExplorerDispatch, useActiveTabs, useFocusedConnection } from '../../context/ExplorerStateContext';
import {
    formatKql,
    getQueryToRunFromEditor,
    parseResultColumns,
    buildSuccessEntry,
    buildErrorEntry,
    saveActiveConnectionId,
    getEditorDropTarget,
    getShortcutAction,
} from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { useExplorerStyles } from './ExplorerWorkspace.styles';
import type { ExplorerProps } from '../Explorer/Explorer';
import { useKustoClient } from '../../context/KustoClientContext';
import { registerKqlLanguage, setKqlSchemaResolver } from './kqlLanguage';


const positionRelativeStyle = { position: 'relative' as const } as const;
const editorOptions = {
    minimap: { enabled: false }, fontSize: 13, fontFamily: 'Consolas, Monaco, monospace',
    lineNumbers: 'on' as const, scrollBeyondLastLine: false, wordWrap: 'on' as const, automaticLayout: true,
    suggestOnTriggerCharacters: true, quickSuggestions: true, tabSize: 4,
    renderLineHighlight: 'line' as const, overviewRulerLanes: 0, hideCursorInOverviewRuler: true,
    overviewRulerBorder: false, padding: { top: 4, bottom: 4 }, lineDecorationsWidth: 8,
    glyphMargin: false, folding: false,
    dropIntoEditor: { enabled: false },
} as const;

export function ExplorerWorkspace(props: ExplorerProps) {
    const styles = useExplorerStyles();
    const { isDark = false } = props;
    const explorerColors = useExplorerColors();
    const client = useKustoClient();
    const state = useExplorerState();
    const dispatch = useExplorerDispatch();
    const { activeTab, splitTab } = useActiveTabs();
    const focusedConnection = useFocusedConnection();

    const {
        schema, connections,
        activeTabId, splitEnabled, splitDirection, splitTabId, focusedPane,
        loading, runningQueryKey,
        rows, columns, columnTypes, resultSets, activeResultSet,
        history, editorHeight,
    } = state;

    // --- Cmd/Ctrl+T / Cmd/Ctrl+W tab shortcuts (desktop only) ---
    const activeTabKql = state.tabs.find((t) => t.id === state.activeTabId)?.kql ?? '';
    const tabCount = state.tabs.length;
    useEffect(() => {
        if (!props.enableTabShortcuts) {
            return;
        }
        function handleKeyDown(e: KeyboardEvent) {
            const action = getShortcutAction(e, tabCount, activeTabKql);
            if (!action) {
                return;
            }
            e.preventDefault();
            if (action === 'add-tab') {
                dispatch({ type: 'ADD_TAB' });
            } else if (action === 'close-tab') {
                dispatch({ type: 'CLOSE_TAB', tabId: state.activeTabId });
            } else if (action === 'close-tab-confirm') {
                if (window.confirm('This tab has unsaved content that will be lost. Close it?')) {
                    dispatch({ type: 'CLOSE_TAB', tabId: state.activeTabId });
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [props.enableTabShortcuts, dispatch, tabCount, state.activeTabId, activeTabKql]);

    // --- Live schema (per-connection) ---
    const focusedTabConnectionId = focusedPane === 'primary'
        ? (activeTab?.connectionId ?? '')
        : (splitTab?.connectionId ?? activeTab?.connectionId ?? '');
    const focusedConn = connections.find((c) => c.id === focusedTabConnectionId) ?? connections[0] ?? focusedConnection;
    const targetCluster = focusedConn.clusterUrl;
    const targetDatabase = focusedConn.database;
    const [schemaLoading, setSchemaLoading] = useState(false);
    const [schemaWidth, setSchemaWidth] = useState(220);

    useEffect(() => {
        if (!targetCluster) {
            dispatch({ type: 'SET_SCHEMA', schema: [] });
            return;
        }
        const target: KustoTarget = { clusterUrl: targetCluster, database: targetDatabase };
        setSchemaLoading(true);
        void loadSchema(client, target).then(() => {
            // getSchema with the original target — loadSchema caches under both discovered and original keys
            dispatch({ type: 'SET_SCHEMA', schema: getSchema(target) });
        }).finally(() => setSchemaLoading(false));
    }, [client, dispatch, targetCluster, targetDatabase]);

    // Target for query execution
    const focusedTarget: KustoTarget = useMemo(
        () => ({ clusterUrl: targetCluster, database: targetDatabase }),
        [targetCluster, targetDatabase],
    );

    useEffect(() => {
        setKqlSchemaResolver(() => getSchema(focusedTarget));
        saveActiveConnectionId(focusedConn.id);
    }, [focusedConn.id, focusedTarget]);

    // Setter shims — dispatch to reducer, keep same call signatures for existing callbacks
    const setHasSelection = useCallback((v: boolean) => dispatch({ type: 'SET_HAS_SELECTION', hasSelection: v }), [dispatch]);
    const setCanRecall = useCallback((v: boolean) => dispatch({ type: 'SET_CAN_RECALL', canRecall: v }), [dispatch]);
    const setHistory = useCallback((v: QueryHistoryEntry[]) => dispatch({ type: 'SET_HISTORY', history: v }), [dispatch]);
    const setEditorHeight = useCallback((v: number) => dispatch({ type: 'SET_EDITOR_HEIGHT', height: v }), [dispatch]);
    const setFocusedPane = useCallback((v: 'primary' | 'secondary') => dispatch({ type: 'SET_FOCUSED_PANE', pane: v }), [dispatch]);

    // Tab management — dispatch to reducer
    const updateTabKql = useCallback((tabId: string, kql: string) => dispatch({ type: 'UPDATE_TAB_KQL', tabId, kql }), [dispatch]);
    const closeSplit = useCallback(() => dispatch({ type: 'CLOSE_SPLIT' }), [dispatch]);

    // --- Editor refs (primary + secondary for split) ---
    const primaryEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const secondaryEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const primaryDecorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
    const secondaryDecorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
    const runQueryRef = useRef<() => void>(() => {});
    const recallQueryRef = useRef<() => void>(() => {});
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isDragging = useRef(false);
    const historyKeysRef = useRef<Set<string>>(new Set());
    const abortRef = useRef<AbortController | null>(null);

    // Convenience: the focused editor
    const getFocusedEditor = useCallback(() => {
        return focusedPane === 'primary' ? primaryEditorRef.current : secondaryEditorRef.current;
    }, [focusedPane]);


    // Load history from IndexedDB on mount
    useEffect(() => { void getHistory().then(setHistory); }, [setHistory]);

    // Keep a ref of history keys for synchronous lookup in cursor change handlers
    useEffect(() => {
        historyKeysRef.current = new Set(history.filter((h) => h.status === 'success' && h.rows).map((h) => h.key));
        // Recheck recall availability when history changes
        const ed = getFocusedEditor();
        if (ed) {
            const toRun = getQueryToRunFromEditor(ed);
            setCanRecall(toRun ? historyKeysRef.current.has(normalizeQuery(toRun.query)) : false);
        }
    }, [history, getFocusedEditor, setCanRecall]);

    const checkCanRecall = useCallback((ed: editor.IStandaloneCodeEditor) => {
        const toRun = getQueryToRunFromEditor(ed);
        if (!toRun) { setCanRecall(false); return; }
        setCanRecall(historyKeysRef.current.has(normalizeQuery(toRun.query)));
    }, [setCanRecall]);

    const updateStatementHighlight = useCallback((ed: editor.IStandaloneCodeEditor) => {
        const decRef = ed === primaryEditorRef.current ? primaryDecorationsRef : secondaryDecorationsRef;
        if (!decRef.current) {
            return;
        }
        const selection = ed.getSelection();
        // When the user has an explicit selection, don't show the block highlight
        if (selection && !selection.isEmpty()) {
            decRef.current.set([]);
            checkCanRecall(ed);
            return;
        }
        const model = ed.getModel();
        if (!model) {
            return;
        }
        const cursorLine = ed.getPosition()?.lineNumber ?? 1;
        const totalLines = model.getLineCount();

        let startLine = cursorLine;
        while (startLine > 1 && model.getLineContent(startLine - 1).trim() !== '') {
            startLine--;
        }
        let endLine = cursorLine;
        while (endLine < totalLines && model.getLineContent(endLine + 1).trim() !== '') {
            endLine++;
        }

        decRef.current.set([{
            range: {
                startLineNumber: startLine,
                startColumn: 1,
                endLineNumber: endLine,
                endColumn: model.getLineMaxColumn(endLine),
            },
            options: {
                isWholeLine: true,
                className: 'traverse-run-highlight',
            },
        }]);
        checkCanRecall(ed);
    }, [checkCanRecall]);

    const cancelQuery = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const runQuery = useCallback(async () => {
        const ed = getFocusedEditor();
        if (!ed) {
            return;
        }
        const toRun = getQueryToRunFromEditor(ed);
        if (!toRun) {
            return;
        }

        abortRef.current?.abort();
        const abort = new AbortController();
        abortRef.current = abort;
        const queryKey = normalizeQuery(toRun.query);

        dispatch({ type: 'QUERY_START', queryKey });
        const start = performance.now();
        try {
            const result = await client.queryKusto(toRun.query, abort.signal, undefined, focusedTarget, { bypassCache: true });
            const elapsedMs = Math.round(performance.now() - start);
            const { columns: cols, columnTypes: types } = parseResultColumns(result.columns);
            const resultRows = result.rows;

            dispatch({
                type: 'QUERY_SUCCESS',
                rows: resultRows,
                columns: cols,
                columnTypes: types,
                elapsed: elapsedMs,
                stats: result.stats ?? null,
                resultSets: result.resultSets,
            });

            try { window.history.replaceState(null, '', `?query=${encodeURIComponent(toRun.query)}`); } catch { /* ignore */ }

            const entry = buildSuccessEntry(toRun.query, normalizeQuery(toRun.query), elapsedMs, cols, resultRows);
            void saveHistoryEntry(entry).then(() => getHistory().then((h) => dispatch({ type: 'SET_HISTORY', history: h })));
        } catch (err) {
            if (abort.signal.aborted) {
                dispatch({ type: 'QUERY_CANCEL' });
            } else {
                const errorMsg = err instanceof Error ? err.message : String(err);
                dispatch({ type: 'QUERY_ERROR', error: errorMsg });

                const entry = buildErrorEntry(toRun.query, normalizeQuery(toRun.query), errorMsg);
                void saveHistoryEntry(entry).then(() => getHistory().then((h) => dispatch({ type: 'SET_HISTORY', history: h })));
            }
        } finally {
            abortRef.current = null;
        }
    }, [getFocusedEditor, dispatch, focusedTarget, client]);

    const doRecall = useCallback(async () => {
        const ed = getFocusedEditor();
        if (!ed) {
            return;
        }
        const toRun = getQueryToRunFromEditor(ed);
        if (!toRun) {
            return;
        }

        const entry = await recallResult(toRun.query);
        if (entry?.columns && entry?.rows) {
            dispatch({
                type: 'QUERY_SUCCESS',
                rows: entry.rows,
                columns: entry.columns,
                columnTypes: {},
                elapsed: entry.elapsed ?? 0,
                stats: null,
                resultSets: [],
            });
        }
    }, [getFocusedEditor, dispatch]);

    runQueryRef.current = runQuery;
    recallQueryRef.current = doRecall;

    const formatQuery = useCallback(() => {
        const ed = getFocusedEditor();
        if (!ed) {
            return;
        }
        const model = ed.getModel();
        if (!model) {
            return;
        }
        const formatted = formatKql(model.getValue());
        model.setValue(formatted);
        // Update the tab's KQL
        const tabId = focusedPane === 'primary' ? activeTabId : splitTabId;
        if (tabId) {
            updateTabKql(tabId, formatted);
        }
    }, [getFocusedEditor, focusedPane, activeTabId, splitTabId, updateTabKql]);
    const formatQueryRef = useRef<() => void>(() => {});
    formatQueryRef.current = formatQuery;

    const createEditorMountHandler = useCallback((pane: 'primary' | 'secondary') => {
        return (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
            const edRef = pane === 'primary' ? primaryEditorRef : secondaryEditorRef;
            const decRef = pane === 'primary' ? primaryDecorationsRef : secondaryDecorationsRef;
            edRef.current = ed;
            decRef.current = ed.createDecorationsCollection([]);
            registerKqlLanguage(monaco);
            ed.addAction({
                id: 'run-query',
                label: 'Run Query',
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter],
                run: () => { runQueryRef.current(); },
            });
            ed.addAction({
                id: 'recall-query',
                label: 'Recall Query',
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyR],
                run: () => { recallQueryRef.current(); },
            });
            ed.addAction({
                id: 'format-query',
                label: 'Format Query',
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
                run: () => { formatQueryRef.current(); },
            });

            ed.onDidChangeCursorPosition(() => updateStatementHighlight(ed));
            ed.onDidChangeCursorSelection((e) => {
                setHasSelection(!e.selection.isEmpty());
                updateStatementHighlight(ed);
            });
            ed.onDidChangeModelContent(() => updateStatementHighlight(ed));
            ed.onDidFocusEditorWidget(() => setFocusedPane(pane));

            updateStatementHighlight(ed);
            if (pane === 'primary') {
                ed.focus();
            }
        };
    }, [updateStatementHighlight, setHasSelection, setFocusedPane]);

    useEffect(() => { runQueryRef.current = runQuery; }, [runQuery]);
    useEffect(() => { recallQueryRef.current = doRecall; }, [doRecall]);

    // Inject global CSS for the run-highlight decoration (Monaco needs a real class)
    useEffect(() => {
        const id = 'traverse-run-highlight-style';
        if (!document.getElementById(id)) {
            const style = document.createElement('style');
            style.id = id;
            style.textContent = `.traverse-run-highlight { background-color: ${explorerColors.semantic.selectionBg}; transition: background-color 0.3s ease; }`;
            document.head.appendChild(style);
        }
    }, [explorerColors.semantic.selectionBg]);

    const insertText = useCallback((text: string) => {
        const ed = getFocusedEditor();
        if (!ed) {
            return;
        }
        const position = ed.getPosition();
        if (position) {
            ed.executeEdits('insert-schema', [{
                range: { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column },
                text,
            }]);
            ed.focus();
        }
    }, [getFocusedEditor]);

    const schemaContextRunQuery = useCallback((kql: string) => {
        // Set the query in the active tab and run it
        updateTabKql(activeTabId, kql);
        const ed = primaryEditorRef.current;
        if (ed) {
            ed.setValue(kql);
            ed.focus();
        }
        // Trigger run after state update
        setTimeout(() => runQueryRef.current(), 50);
    }, [activeTabId, updateTabKql]);

    // Drag resize handler
    const onDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        const startY = e.clientY;
        const startHeight = editorHeight;
        const container = containerRef.current;
        if (!container) {
            return;
        }
        const containerHeight = container.getBoundingClientRect().height - 36; // minus toolbar

        const onMove = (ev: MouseEvent) => {
            if (!isDragging.current) {
                return;
            }
            const delta = ev.clientY - startY;
            const newPct = Math.min(80, Math.max(20, startHeight + (delta / containerHeight) * 100));
            setEditorHeight(newPct);
        };
        const onUp = () => {
            isDragging.current = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [editorHeight, setEditorHeight]);

    // Schema sidebar resize handler
    const onSchemaResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = schemaWidth;
        const onMove = (ev: MouseEvent) => {
            const newWidth = Math.min(500, Math.max(140, startWidth + ev.clientX - startX));
            setSchemaWidth(newWidth);
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [schemaWidth]);

    const schemaWidthStyle = useMemo(() => ({ width: `${schemaWidth}px` }), [schemaWidth]);

    // Derive active result set columns/rows for display
    const displayColumns = useMemo(() => resultSets.length > 1 && resultSets[activeResultSet]
        ? resultSets[activeResultSet].columns.map((c: { ColumnName: string; ColumnType: string }) => c.ColumnName) : columns,
    [resultSets, activeResultSet, columns]);
    const displayColumnTypes = useMemo(() => resultSets.length > 1 && resultSets[activeResultSet]
        ? Object.fromEntries(resultSets[activeResultSet].columns.map((c: { ColumnName: string; ColumnType: string }) => [c.ColumnName, c.ColumnType])) : columnTypes,
    [resultSets, activeResultSet, columnTypes]);
    const displayRows = useMemo(() => resultSets.length > 1 && resultSets[activeResultSet]
        ? resultSets[activeResultSet].rows : rows,
    [resultSets, activeResultSet, rows]);

    const currentQueryKey = (() => {
        const ed = getFocusedEditor();
        if (!ed) {
            return null;
        }
        const toRun = getQueryToRunFromEditor(ed);
        return toRun ? normalizeQuery(toRun.query) : null;
    })();
    const showCancel = loading && runningQueryKey !== null && currentQueryKey === runningQueryKey;

    const [editorDropTarget, setEditorDropTarget] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);
    const dragTabIdRef = useRef<string | null>(null);


    const handleHistoryRecall = useCallback(async (entry: QueryHistoryEntry) => {
        if (entry.columns && entry.rows) {
            dispatch({
                type: 'QUERY_SUCCESS',
                rows: entry.rows,
                columns: entry.columns,
                columnTypes: {},
                elapsed: entry.elapsed ?? 0,
                stats: null,
                resultSets: [],
            });
            dispatch({ type: 'SET_RESULTS_TAB', tab: 'results' });
            const ed = primaryEditorRef.current;
            if (ed) {
                ed.setValue(entry.query);
                dispatch({ type: 'UPDATE_TAB_KQL', tabId: activeTabId, kql: entry.query });
            }
        }
    }, [activeTabId, dispatch]);

    // --- Extracted handlers for JSX props ---
    const focusPrimaryPane = useCallback(() => setFocusedPane('primary'), [setFocusedPane]);
    const focusPrimaryPaneKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            setFocusedPane('primary');
        }
    }, [setFocusedPane]);
    const focusSecondaryPane = useCallback(() => setFocusedPane('secondary'), [setFocusedPane]);
    const focusSecondaryPaneKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            setFocusedPane('secondary');
        }
    }, [setFocusedPane]);
    const handlePrimaryEditorChange = useCallback((v: string | undefined) => updateTabKql(activeTabId, v ?? ''), [updateTabKql, activeTabId]);
    const handleSecondaryEditorChange = useCallback((v: string | undefined) => {
        if (splitTabId) {
            updateTabKql(splitTabId, v ?? '');
        }
    }, [updateTabKql, splitTabId]);
    const handlePrimaryMount = useMemo(() => createEditorMountHandler('primary'), [createEditorMountHandler]);
    const handleSecondaryMount = useMemo(() => createEditorMountHandler('secondary'), [createEditorMountHandler]);
    const handleClearResults = useCallback(() => {
        dispatch({ type: 'QUERY_SUCCESS', rows: [], columns: [], columnTypes: {}, elapsed: 0, stats: null, resultSets: [] });
    }, [dispatch]);
    const handlePrimaryDragOver = useCallback((e: React.DragEvent) => {
        if (!dragTabIdRef.current) {
            return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragTabIdRef.current === activeTabId) {
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        setEditorDropTarget(getEditorDropTarget(rect, e.clientX, e.clientY));
    }, [dragTabIdRef, activeTabId]);
    const handleDragLeave = useCallback(() => setEditorDropTarget(null), []);
    const handlePrimaryDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (dragTabIdRef.current && dragTabIdRef.current !== activeTabId && editorDropTarget) {
            const dir = (editorDropTarget === 'left' || editorDropTarget === 'right') ? 'vertical' : 'horizontal';
            dispatch({ type: 'TOGGLE_SPLIT', direction: dir, splitTabId: dragTabIdRef.current });
            dispatch({ type: 'SET_FOCUSED_PANE', pane: 'secondary' });
        }
        setEditorDropTarget(null);
        dragTabIdRef.current = null;
    }, [dragTabIdRef, activeTabId, editorDropTarget, dispatch]);

    // --- Extracted style objects ---
    const editorAreaStyle = useMemo(() => ({ flex: `0 0 ${editorHeight}%` }), [editorHeight]);
    const editorSplitStyle = useMemo(() => ({ flexDirection: splitDirection === 'horizontal' ? 'column' as const : 'row' as const }), [splitDirection]);
    const splitHandleStyle = useMemo(() =>
        splitDirection === 'vertical'
            ? { width: '4px', cursor: 'col-resize' as const, position: 'relative' as const }
            : { height: '4px', cursor: 'row-resize' as const, position: 'relative' as const },
    [splitDirection]);
    const resultsPanelStyle = useMemo(() => ({ flex: `0 0 ${100 - editorHeight}%` }), [editorHeight]);
    const dropTargetStyle = useMemo(() =>
        editorDropTarget === 'left' ? { top: 0, left: 0, bottom: 0, width: '50%' }
            : editorDropTarget === 'right' ? { top: 0, right: 0, bottom: 0, width: '50%' }
            : editorDropTarget === 'top' ? { top: 0, left: 0, right: 0, height: '50%' }
            : { bottom: 0, left: 0, right: 0, height: '50%' },
    [editorDropTarget]);

    return (
        <div className={props.className ?? styles.page}>
            <TabBar
                dragTabIdRef={dragTabIdRef}
                onSetEditorDropTarget={setEditorDropTarget}
            />

            <EditorToolbar
                showCancel={showCancel}
                onRun={runQuery}
                onCancel={cancelQuery}
                onRecall={doRecall}
                onFormat={formatQuery}
                connections={connections}
                focusedConnection={focusedConnection}
            />

            <div className={styles.splitContainer} ref={containerRef}>
            {/* Editor + Schema sidebar */}
            <div className={styles.editorArea} style={editorAreaStyle}>
                <div style={schemaWidthStyle}>
                    <SchemaSidebar schema={schema} insertText={insertText} schemaContextRunQuery={schemaContextRunQuery} loading={schemaLoading} />
                </div>
                <div className={styles.schemaResizeHandle} role="separator" onMouseDown={onSchemaResizeStart} />
                <div className={styles.editorSplitArea} style={editorSplitStyle}>
                    {/* Primary editor pane */}
                    <div className={focusedPane === 'primary' ? styles.editorPaneFocused : styles.editorPaneUnfocused}
                        role="tabpanel"
                        style={positionRelativeStyle}
                        onClick={focusPrimaryPane}
                        onKeyDown={focusPrimaryPaneKeyDown}
                        onDragOver={handlePrimaryDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handlePrimaryDrop}>
                        {editorDropTarget && (
                            <div className={styles.editorDropTarget}
                                style={dropTargetStyle}>
                                {(editorDropTarget === 'left' || editorDropTarget === 'right') ? '⬓ Vertical split' : '⬔ Horizontal split'}
                            </div>
                        )}
                        <Editor
                            height="100%"
                            language="kql"
                            theme={isDark ? 'vs-dark' : 'vs'}
                            value={activeTab.kql}
                            onChange={handlePrimaryEditorChange}
                            onMount={handlePrimaryMount}
                            options={editorOptions}
                        />
                    </div>
                    {/* Split handle + secondary editor */}
                    {splitEnabled && splitTab && (
                        <>
                            <div className={styles.editorSplitHandle}
                                style={splitHandleStyle}
                                onDoubleClick={closeSplit} title="Double-click to close split" />
                            <div className={focusedPane === 'secondary' ? styles.editorPaneFocused : styles.editorPaneUnfocused}
                                role="tabpanel"
                                onClick={focusSecondaryPane}
                                onKeyDown={focusSecondaryPaneKeyDown}>
                                <Editor
                                    height="100%"
                                    language="kql"
                                    theme={isDark ? 'vs-dark' : 'vs'}
                                    value={splitTab.kql}
                                    onChange={handleSecondaryEditorChange}
                                    onMount={handleSecondaryMount}
                                    options={editorOptions}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Drag handle */}
            <div className={styles.dragHandle} role="separator" onMouseDown={onDragStart} />

            {/* Results */}
            <div className={styles.resultsPanel} style={resultsPanelStyle}>
                <ResultsPanel
                    isDark={isDark}
                    displayRows={displayRows}
                    displayColumns={displayColumns}
                    displayColumnTypes={displayColumnTypes}
                    onRecall={handleHistoryRecall}
                    onClear={handleClearResults}
                />
            </div>
            </div>
        </div>
    );
}
