import { useEffect, useMemo, useReducer, useRef } from 'react';

import type { ExplorerColorConfig } from '../../colors';
import type { KustoClient } from '../../services/kusto';
import { KustoClientContext } from '../../context/KustoClientContext';
import { ExplorerColorProvider } from '../../context/ExplorerColorContext';
import { ExplorerStateContext, ExplorerDispatchContext } from '../../context/ExplorerStateContext';
import { explorerReducer, createInitialState } from '../../state';
import { SNAPSHOT_VERSION, saveSnapshot } from '../../state/persistence';
import type { ExplorerTabsSnapshot } from '../../state/persistence';
import { DEFAULT_QUERY, buildWellKnownClusters } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import type { WellKnownCluster } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { ExplorerWorkspace } from '../ExplorerWorkspace/ExplorerWorkspace';

export interface ExplorerProps {
    className?: string;
    isDark?: boolean;
    kustoClient: KustoClient;
    colors: ExplorerColorConfig;
    clusters?: readonly WellKnownCluster[];
    enableTabShortcuts?: boolean;
    /**
     * Query to seed the editor with on first load when there is no
     * persisted tab snapshot and no `?query=` URL parameter.
     * Falls back to the package's built-in `DEFAULT_QUERY` when omitted.
     */
    initialQuery?: string;
}

/**
 * Debounce window (ms) for persisting the tab snapshot. Long enough to
 * coalesce keystrokes into a single write, short enough that a casual
 * tab-switch or refresh after typing still captures the user's edits.
 */
const SNAPSHOT_SAVE_DEBOUNCE_MS = 300;

export function Explorer(props: ExplorerProps) {
    const { initialQuery: providedInitialQuery } = props;

    const { initialQuery, hasUrlQuery } = useMemo(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const q = params.get('query');
            if (q) {
                return { initialQuery: q, hasUrlQuery: true };
            }
        } catch { /* ignore */ }
        return { initialQuery: providedInitialQuery ?? DEFAULT_QUERY, hasUrlQuery: false };
    }, [providedInitialQuery]);

    const defaultClusters = useMemo(() => buildWellKnownClusters(props.clusters ?? []), [props.clusters]);
    const initArgs = useMemo(
        () => ({ initialQuery, defaultClusters, skipSnapshot: hasUrlQuery }),
        [initialQuery, defaultClusters, hasUrlQuery],
    );
    const [state, dispatch] = useReducer(explorerReducer, initArgs, createInitialState);

    // Persist tab/split state with a small debounce.
    //
    // - Deep-link mode (URL `?query=`) treats the visible workspace as
    //   ephemeral. We never write it back to the snapshot store, so the
    //   user's normal saved workspace is preserved.
    // - On rapid unmount or page-hide (refresh, tab close), a pending
    //   debounced save would otherwise be cancelled. `pendingRef` lets
    //   us flush the latest snapshot synchronously in those moments so
    //   recent edits are not dropped.
    const { tabs, activeTabId, splitEnabled, splitDirection, splitTabId, focusedPane } = state;
    const pendingRef = useRef<ExplorerTabsSnapshot | null>(null);

    useEffect(() => {
        if (hasUrlQuery) {
            return;
        }
        const snap: ExplorerTabsSnapshot = {
            version: SNAPSHOT_VERSION,
            tabs, activeTabId, splitEnabled, splitDirection, splitTabId, focusedPane,
        };
        pendingRef.current = snap;
        const handle = setTimeout(() => {
            saveSnapshot(snap);
            pendingRef.current = null;
        }, SNAPSHOT_SAVE_DEBOUNCE_MS);
        return () => clearTimeout(handle);
    }, [hasUrlQuery, tabs, activeTabId, splitEnabled, splitDirection, splitTabId, focusedPane]);

    useEffect(() => {
        if (hasUrlQuery) {
            return;
        }
        const flush = () => {
            if (pendingRef.current) {
                saveSnapshot(pendingRef.current);
                pendingRef.current = null;
            }
        };
        window.addEventListener('pagehide', flush);
        return () => {
            window.removeEventListener('pagehide', flush);
            flush();
        };
    }, [hasUrlQuery]);

    return (
        <KustoClientContext.Provider value={props.kustoClient}>
            <ExplorerColorProvider value={props.colors}>
                <ExplorerStateContext.Provider value={state}>
                    <ExplorerDispatchContext.Provider value={dispatch}>
                        <ExplorerWorkspace {...props} />
                    </ExplorerDispatchContext.Provider>
                </ExplorerStateContext.Provider>
            </ExplorerColorProvider>
        </KustoClientContext.Provider>
    );
}
