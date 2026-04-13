import type { QueryStats, KustoResultSet } from '../services/kusto';
import type { QueryHistoryEntry } from '../services/queryHistory';
import type { SchemaTable } from '../services/schema';
import type { QueryTab, KustoConnection } from '../components/ExplorerWorkspace/ExplorerWorkspace.logic';

export interface ExplorerState {
    // Connections
    connections: KustoConnection[];

    // Schema
    schema: SchemaTable[];
    schemaSearch: string;
    expandedFolders: Set<string>;
    expandedTables: Set<string>;
    schemaContextMenu: { tableName: string; x: number; y: number } | null;

    // Tabs
    tabs: QueryTab[];
    activeTabId: string;
    splitEnabled: boolean;
    splitDirection: 'vertical' | 'horizontal';
    splitTabId: string | null;
    focusedPane: 'primary' | 'secondary';

    // Query execution
    loading: boolean;
    error: string | null;
    queryStartTime: number | null;
    runningQueryKey: string | null;

    // Results
    rows: Record<string, unknown>[] | null;
    columns: string[];
    columnTypes: Record<string, string>;
    elapsed: number | null;
    resultTime: Date | null;
    queryStats: QueryStats | null;
    resultSets: KustoResultSet[];
    activeResultSet: number;
    resultsTab: 'results' | 'chart' | 'stats' | 'history';

    // History
    history: QueryHistoryEntry[];

    // UI
    editorHeight: number;
    hasSelection: boolean;
    canRecall: boolean;
}

export interface InitialStateArgs {
    initialQuery: string;
    defaultClusters: KustoConnection[];
}
