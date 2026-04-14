import { createContext, useContext, useMemo } from 'react';
import type { Dispatch } from 'react';

import type { ExplorerState, ExplorerAction } from '../state';
import type { KustoConnection } from '../components/ExplorerWorkspace/ExplorerWorkspace.logic';
import { DEFAULT_CONNECTION } from '../components/ExplorerWorkspace/ExplorerWorkspace.logic';

export const ExplorerStateContext = createContext<ExplorerState | null>(null);
export const ExplorerDispatchContext = createContext<Dispatch<ExplorerAction> | null>(null);

export function useExplorerState(): ExplorerState {
    const ctx = useContext(ExplorerStateContext);
    if (!ctx) {
        throw new Error('useExplorerState must be used within ExplorerProvider');
    }
    return ctx;
}

export function useExplorerDispatch(): Dispatch<ExplorerAction> {
    const ctx = useContext(ExplorerDispatchContext);
    if (!ctx) {
        throw new Error('useExplorerDispatch must be used within ExplorerProvider');
    }
    return ctx;
}

export function useActiveTabs() {
    const { tabs, activeTabId, splitEnabled, splitTabId } = useExplorerState();
    const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId) ?? tabs[0], [tabs, activeTabId]);
    const splitTab = useMemo(() => splitEnabled ? (tabs.find((t) => t.id === splitTabId) ?? null) : null, [tabs, splitEnabled, splitTabId]);
    return { activeTab, splitTab };
}

export function useConnection(connectionId: string): KustoConnection {
    const { connections } = useExplorerState();
    return useMemo(
        () => connections.find((c) => c.id === connectionId) ?? connections[0] ?? DEFAULT_CONNECTION,
        [connections, connectionId],
    );
}

export function useFocusedConnection(): KustoConnection {
    const { tabs, activeTabId, splitTabId, focusedPane, connections } = useExplorerState();
    return useMemo(() => {
        const tabId = focusedPane === 'primary' ? activeTabId : splitTabId;
        const tab = tabs.find((t) => t.id === tabId) ?? tabs[0];
        return connections.find((c) => c.id === tab?.connectionId) ?? connections[0] ?? DEFAULT_CONNECTION;
    }, [tabs, activeTabId, splitTabId, focusedPane, connections]);
}
