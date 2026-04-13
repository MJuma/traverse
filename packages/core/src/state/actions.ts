import type { QueryStats, KustoResultSet } from '../services/kusto';
import type { QueryHistoryEntry } from '../services/queryHistory';
import type { SchemaTable } from '../services/schema';
import type { KustoConnection } from '../components/ExplorerWorkspace/ExplorerWorkspace.logic';
import type { ExplorerState } from './types';

export type ExplorerAction =
    // Connections
    | { type: 'SET_CONNECTIONS'; connections: KustoConnection[] }
    | { type: 'SET_TAB_CONNECTION'; tabId: string; connectionId: string }

    // Schema
    | { type: 'SET_SCHEMA'; schema: SchemaTable[] }
    | { type: 'SET_SCHEMA_SEARCH'; search: string }
    | { type: 'TOGGLE_FOLDER'; folder: string }
    | { type: 'TOGGLE_TABLE'; table: string }
    | { type: 'EXPAND_ALL_FOLDERS'; folders: string[] }
    | { type: 'COLLAPSE_ALL_FOLDERS' }
    | { type: 'SET_SCHEMA_CONTEXT_MENU'; menu: ExplorerState['schemaContextMenu'] }

    // Tabs
    | { type: 'ADD_TAB' }
    | { type: 'CLOSE_TAB'; tabId: string }
    | { type: 'SWITCH_TAB'; tabId: string }
    | { type: 'UPDATE_TAB_KQL'; tabId: string; kql: string }
    | { type: 'RENAME_TAB'; tabId: string; title: string }
    | { type: 'REORDER_TABS'; fromIdx: number; toIdx: number }
    | { type: 'TOGGLE_SPLIT'; direction: 'vertical' | 'horizontal' }
    | { type: 'CLOSE_SPLIT' }
    | { type: 'SET_FOCUSED_PANE'; pane: 'primary' | 'secondary' }

    // Query execution
    | { type: 'QUERY_START'; queryKey: string }
    | { type: 'QUERY_SUCCESS'; rows: Record<string, unknown>[]; columns: string[]; columnTypes: Record<string, string>; elapsed: number; stats: QueryStats | null; resultSets: KustoResultSet[] }
    | { type: 'QUERY_ERROR'; error: string }
    | { type: 'QUERY_CANCEL' }

    // Results
    | { type: 'SET_RESULTS_TAB'; tab: ExplorerState['resultsTab'] }
    | { type: 'SET_ACTIVE_RESULT_SET'; index: number }
    | { type: 'SET_HISTORY'; history: QueryHistoryEntry[] }
    | { type: 'LOAD_HISTORY_ENTRY'; rows: Record<string, unknown>[]; columns: string[]; columnTypes: Record<string, string>; kql: string }

    // UI
    | { type: 'SET_EDITOR_HEIGHT'; height: number }
    | { type: 'SET_HAS_SELECTION'; hasSelection: boolean }
    | { type: 'SET_CAN_RECALL'; canRecall: boolean };
