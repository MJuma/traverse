/**
 * Explorer configuration — types, defaults, and constants.
 */

export interface KustoConnection {
    id: string;
    name: string;
    clusterUrl: string;
    database: string;
    color: string;
}

export const CONNECTION_COLORS = ['#909d63', '#6a8799', '#ebc17a', '#bc5653', '#b06698'];

export const DEFAULT_CONNECTION: KustoConnection = {
    id: 'kusto-help',
    name: 'help',
    clusterUrl: 'https://help.kusto.windows.net',
    database: 'Samples',
    color: CONNECTION_COLORS[0],
};

export type WellKnownCluster = { id: string; name: string; clusterUrl: string; database: string };

export function buildWellKnownClusters(clusters: readonly WellKnownCluster[]): KustoConnection[] {
    return clusters.map((c, i) => ({
        ...c,
        color: CONNECTION_COLORS[i % CONNECTION_COLORS.length],
    }));
}

export const DEFAULT_QUERY = `StormEvents
| summarize count() by State
| top 10 by count_
| render barchart`;

export const KEYBOARD_SHORTCUTS = [
    { keys: 'Ctrl+Shift+Enter', action: 'Run query / selection' },
    { keys: 'Ctrl+Shift+R', action: 'Recall cached results' },
    { keys: 'Ctrl+Shift+F', action: 'Format query' },
    { keys: 'Ctrl+/', action: 'Toggle comment' },
    { keys: 'Ctrl+D', action: 'Duplicate line' },
    { keys: 'Ctrl+Shift+K', action: 'Delete line' },
    { keys: 'Alt+↑/↓', action: 'Move line up/down' },
    { keys: 'Ctrl+Space', action: 'Trigger autocomplete' },
    { keys: 'Ctrl+Z / Ctrl+Y', action: 'Undo / Redo' },
];
