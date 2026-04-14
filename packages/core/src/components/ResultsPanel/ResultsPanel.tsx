import { Text, Button, Tooltip, Spinner, tokens } from '@fluentui/react-components';
import { DocumentCopyRegular, DeleteRegular, ArrowDownloadRegular } from '@fluentui/react-icons';
import { useCallback, useMemo } from 'react';

import { getHistory, clearHistory, deleteHistoryEntry } from '../../services/queryHistory';
import type { QueryHistoryEntry } from '../../services/queryHistory';
import { useExplorerState, useExplorerDispatch } from '../../context/ExplorerStateContext';
import { formatBytes, exportCsv, exportJson } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { useExplorerStyles } from '../ExplorerWorkspace/ExplorerWorkspace.styles';
import { ChartPanel } from '../ChartPanel/ChartPanel';
import { ResultsTable } from '../ResultsTable/ResultsTable';
import { ElapsedTimer } from './ElapsedTimer';
import { TabButton } from './TabButton';
import { ResultSetTab } from './ResultSetTab';
import { HistoryItem } from './HistoryItem';

const documentCopyIcon = <DocumentCopyRegular />;
const deleteIcon = <DeleteRegular />;
const arrowDownloadIcon = <ArrowDownloadRegular />;

const emptyRows: Record<string, unknown>[] = [];
const noWrapStyle = { whiteSpace: 'nowrap' } as const;
const cursorDefaultStyle = { cursor: 'default' } as const;
const jsonButtonStyle = { fontFamily: 'Consolas', fontSize: '10px', minWidth: 'auto', padding: '0 4px' } as const;
const resultSetSeparatorStyle = { borderLeft: `1px solid ${tokens.colorNeutralStroke2}`, margin: '0 4px', height: '16px' } as const;

export interface ResultsPanelProps {
    isDark: boolean;
    displayRows: Record<string, unknown>[] | null;
    displayColumns: string[];
    displayColumnTypes: Record<string, string>;
    onRecall: (entry: QueryHistoryEntry) => void;
    onClear?: () => void;
}

export function ResultsPanel({ isDark, displayRows, displayColumns, displayColumnTypes, onRecall, onClear }: ResultsPanelProps) {
    const styles = useExplorerStyles();
    const {
        rows, columns, elapsed, resultTime, error, loading, queryStartTime,
        resultsTab, history, queryStats, resultSets, activeResultSet,
    } = useExplorerState();
    const dispatch = useExplorerDispatch();

    const setResultsTab = useCallback((tab: 'results' | 'chart' | 'stats' | 'history') => dispatch({ type: 'SET_RESULTS_TAB', tab }), [dispatch]);
    const setHistory = useCallback((h: QueryHistoryEntry[]) => dispatch({ type: 'SET_HISTORY', history: h }), [dispatch]);
    const setActiveResultSet = useCallback((i: number) => dispatch({ type: 'SET_ACTIVE_RESULT_SET', index: i }), [dispatch]);

    const handleResultsTab = useCallback(() => setResultsTab('results'), [setResultsTab]);
    const handleChartTab = useCallback(() => setResultsTab('chart'), [setResultsTab]);
    const handleStatsTab = useCallback(() => setResultsTab('stats'), [setResultsTab]);
    const handleHistoryTab = useCallback(() => setResultsTab('history'), [setResultsTab]);

    const safeDisplayRows = useMemo(() => displayRows ?? emptyRows, [displayRows]);

    const handleCopyTsv = useCallback(() => {
        if (!rows || !columns.length) {
            return;
        }
        const tsv = [columns.join('\t'), ...rows.map((r) => columns.map((c) => String((r[c] ?? '') as string | number)).join('\t'))].join('\n');
        void navigator.clipboard.writeText(tsv);
    }, [rows, columns]);

    const handleExportCsv = useCallback(() => {
        if (rows && columns.length) {
            exportCsv(columns, rows);
        }
    }, [rows, columns]);

    const handleExportJson = useCallback(() => {
        if (rows && columns.length) {
            exportJson(columns, rows);
        }
    }, [rows, columns]);

    const handleClearResults = useCallback(() => onClear?.(), [onClear]);

    const handleClearHistory = useCallback(() => {
        void clearHistory().then(() => setHistory([]));
    }, [setHistory]);

    const handleDeleteHistoryEntry = useCallback((entry: QueryHistoryEntry) => {
        void deleteHistoryEntry(entry.key).then(() => getHistory().then(setHistory));
    }, [setHistory]);

    const resultSetTabs = useMemo(() =>
        resultSets.map((_, i) => ({ id: `rs-${i}`, index: i })),
        [resultSets],
    );

    const tooltipContent = useMemo(() => (
        <div style={noWrapStyle}>
            <div>{(displayRows?.length ?? 0).toLocaleString()} rows × {displayColumns.length} cols</div>
            {resultSets.length > 1 && <div>Result set {activeResultSet + 1} of {resultSets.length}</div>}
            {elapsed !== null && <div>Elapsed: {elapsed}ms</div>}
            {resultTime && <div>Returned: {resultTime.toLocaleTimeString()}</div>}
        </div>
    ), [displayRows?.length, displayColumns.length, resultSets.length, activeResultSet, elapsed, resultTime]);

    const headerLeft = useMemo(() => (
        <div className={styles.tabStrip}>
            <TabButton className={resultsTab === 'results' ? styles.tabActive : styles.tab} onClick={handleResultsTab}>RESULTS</TabButton>
            <TabButton className={resultsTab === 'chart' ? styles.tabActive : styles.tab} onClick={handleChartTab}>CHART</TabButton>
            <TabButton className={resultsTab === 'stats' ? styles.tabActive : styles.tab} onClick={handleStatsTab}>STATS</TabButton>
            <TabButton className={resultsTab === 'history' ? styles.tabActive : styles.tab} onClick={handleHistoryTab}>HISTORY{history.length > 0 ? ` (${history.length})` : ''}</TabButton>
            {resultSets.length > 1 && (
                <>
                    <span style={resultSetSeparatorStyle} />
                    {resultSetTabs.map((tab) => (
                        <ResultSetTab
                            key={tab.id}
                            index={tab.index}
                            isActive={tab.index === activeResultSet}
                            activeClassName={styles.tabActive}
                            inactiveClassName={styles.tab}
                            onSelect={setActiveResultSet}
                        />
                    ))}
                </>
            )}
        </div>
    ), [styles, resultsTab, handleResultsTab, handleChartTab, handleStatsTab, handleHistoryTab, history.length, resultSets.length, resultSetTabs, activeResultSet, setActiveResultSet]);

    const headerRight = useMemo(() => (
        <div className={styles.resultsStats}>
            <Tooltip content={tooltipContent} relationship="label">
                <Text className={styles.stat} style={cursorDefaultStyle}>
                    {(displayRows?.length ?? 0).toLocaleString()} rows{elapsed !== null ? ` · ${elapsed}ms` : ''}
                </Text>
            </Tooltip>
            <Tooltip content="Copy as TSV" relationship="label">
                <Button appearance="subtle" icon={documentCopyIcon} size="small"
                    onClick={handleCopyTsv} />
            </Tooltip>
            <Tooltip content="Download CSV" relationship="label">
                <Button appearance="subtle" icon={arrowDownloadIcon} size="small"
                    onClick={handleExportCsv} />
            </Tooltip>
            <Tooltip content="Download JSON" relationship="label">
                <Button appearance="subtle" size="small"
                    onClick={handleExportJson}
                    style={jsonButtonStyle}>
                    {'{}'}
                </Button>
            </Tooltip>
            <Tooltip content="Clear results" relationship="label">
                <Button appearance="subtle" icon={deleteIcon} size="small"
                    onClick={handleClearResults} />
            </Tooltip>
        </div>
    ), [styles, tooltipContent, displayRows?.length, elapsed, handleCopyTsv, handleExportCsv, handleExportJson, handleClearResults]);

    return (
        <>
                {loading && queryStartTime && (
                    <div className={styles.resultsHeader}>
                        {headerLeft}
                    </div>
                )}
                {loading && queryStartTime && (
                    <div className={styles.emptyState}>
                        <Spinner size="small" />
                        <Text size={200}>Executing query... <ElapsedTimer startTime={queryStartTime} /></Text>
                    </div>
                )}

                {!loading && resultsTab === 'results' && (
                    <>
                        {error && <div className={styles.errorBox}>{error}</div>}

                        {!rows && !error && (
                            <>
                                <div className={styles.resultsHeader}>
                                    {headerLeft}
                                </div>
                                <div className={styles.emptyState}>
                                    <Text size={200}>Run a query to see results</Text>
                                </div>
                            </>
                        )}

                        {rows && rows.length > 0 && (
                            <ResultsTable columns={displayColumns} rows={safeDisplayRows} isDark={isDark} columnTypes={displayColumnTypes}
                                headerLeft={headerLeft}
                                headerRight={headerRight}
                            />
                        )}

                        {rows && rows.length === 0 && (
                            <>
                                <div className={styles.resultsHeader}>
                                    {headerLeft}
                                </div>
                                <div className={styles.emptyState}>
                                    <Text size={200}>Query returned 0 rows</Text>
                                </div>
                            </>
                        )}
                    </>
                )}

                {!loading && resultsTab !== 'results' && (
                    <div className={styles.resultsHeader}>
                        {headerLeft}
                        {resultsTab === 'history' && history.length > 0 && (
                            <Tooltip content="Clear history" relationship="label">
                                <Button appearance="subtle" icon={deleteIcon} size="small"
                                    onClick={handleClearHistory} />
                            </Tooltip>
                        )}
                    </div>
                )}

                {!loading && resultsTab === 'chart' && (
                    <>
                        {displayRows && displayRows.length > 0 ? (
                            <ChartPanel columns={displayColumns} rows={displayRows} isDark={isDark} visualization={resultSets[activeResultSet]?.visualization} />
                        ) : (
                            <div className={styles.emptyState}>
                                <Text size={200}>Run a query to chart results</Text>
                            </div>
                        )}
                    </>
                )}

                {!loading && resultsTab === 'stats' && (
                    <>
                        {!queryStats && (
                            <div className={styles.emptyState}>
                                <Text size={200}>Run a query to see execution stats</Text>
                            </div>
                        )}
                        {queryStats && (
                            <div className={styles.statsGrid}>
                                {elapsed !== null && (
                                    <div className={styles.statsCard}>
                                        <span className={styles.statsLabel}>Client Round-Trip</span>
                                        <span className={styles.statsValue}>{elapsed.toLocaleString()} ms</span>
                                    </div>
                                )}
                                {queryStats.executionTime && (
                                    <div className={styles.statsCard}>
                                        <span className={styles.statsLabel}>Server Execution Time</span>
                                        <span className={styles.statsValue}>{queryStats.executionTime}</span>
                                    </div>
                                )}
                                {queryStats.cpuTime && (
                                    <div className={styles.statsCard}>
                                        <span className={styles.statsLabel}>CPU Time</span>
                                        <span className={styles.statsValue}>{queryStats.cpuTime}</span>
                                    </div>
                                )}
                                {queryStats.memoryPeak !== null && queryStats.memoryPeak !== undefined && (
                                    <div className={styles.statsCard}>
                                        <span className={styles.statsLabel}>Memory Peak</span>
                                        <span className={styles.statsValue}>{(queryStats.memoryPeak / (1024 * 1024)).toFixed(1)} MB</span>
                                    </div>
                                )}
                                {queryStats.resultRows !== null && queryStats.resultRows !== undefined && (
                                    <div className={styles.statsCard}>
                                        <span className={styles.statsLabel}>Result Rows</span>
                                        <span className={styles.statsValue}>{queryStats.resultRows.toLocaleString()}</span>
                                    </div>
                                )}
                                {queryStats.resultSize !== null && queryStats.resultSize !== undefined && (
                                    <div className={styles.statsCard}>
                                        <span className={styles.statsLabel}>Result Size</span>
                                        <span className={styles.statsValue}>{(queryStats.resultSize / 1024).toFixed(1)} KB</span>
                                    </div>
                                )}
                                {queryStats.extentsScanned !== null && queryStats.extentsScanned !== undefined && (
                                    <div className={styles.statsCard}>
                                        <span className={styles.statsLabel}>Extents Scanned</span>
                                        <span className={styles.statsValue}>{queryStats.extentsScanned.toLocaleString()} / {queryStats.extentsTotal?.toLocaleString() ?? '?'}</span>
                                    </div>
                                )}
                                {queryStats.rowsScanned !== null && queryStats.rowsScanned !== undefined && (
                                    <div className={styles.statsCard}>
                                        <span className={styles.statsLabel}>Rows Scanned</span>
                                        <span className={styles.statsValue}>{queryStats.rowsScanned.toLocaleString()} / {queryStats.rowsTotal?.toLocaleString() ?? '?'}</span>
                                    </div>
                                )}
                                {(queryStats.cacheHitBytes !== null || queryStats.cacheMissBytes !== null) && (
                                    <div className={styles.statsCard}>
                                        <span className={styles.statsLabel}>Shard Cache Hit / Miss</span>
                                        <span className={styles.statsValue}>{formatBytes(queryStats.cacheHitBytes ?? 0)} / {formatBytes(queryStats.cacheMissBytes ?? 0)}</span>
                                    </div>
                                )}
                                {queryStats.fromCache !== null && (
                                    <div className={styles.statsCard}>
                                        <span className={styles.statsLabel}>Server Cache</span>
                                        <span className={styles.statsValue}>{queryStats.fromCache ? '✓ Hit' : '✗ Miss'}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {resultsTab === 'history' && (
                    <>
                        {history.length === 0 && (
                            <div className={styles.emptyState}>
                                <Text size={200}>No query history yet</Text>
                            </div>
                        )}
                        <div className={styles.historyList}>
                            {history.map((entry) => (
                                <HistoryItem
                                    key={entry.key + entry.timestamp}
                                    entry={entry}
                                    styles={styles}
                                    onRecall={onRecall}
                                    onDelete={handleDeleteHistoryEntry}
                                />
                            ))}
                        </div>
                    </>
                )}
        </>
    );
}
