import { useMemo, useReducer } from 'react';

import type { ExplorerColorConfig } from '../../colors';
import type { KustoClient } from '../../services/kusto';
import { KustoClientContext } from '../../context/KustoClientContext';
import { ExplorerColorProvider } from '../../context/ExplorerColorContext';
import { ExplorerStateContext, ExplorerDispatchContext } from '../../context/ExplorerStateContext';
import { explorerReducer, createInitialState } from '../../state';
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
}

export function Explorer(props: ExplorerProps) {
    const initialQuery = useMemo(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const q = params.get('query');
            if (q) {
                return q;
            }
        } catch { /* ignore */ }
        return DEFAULT_QUERY;
    }, []);

    const defaultClusters = useMemo(() => buildWellKnownClusters(props.clusters ?? []), [props.clusters]);
    const initArgs = useMemo(() => ({ initialQuery, defaultClusters }), [initialQuery, defaultClusters]);
    const [state, dispatch] = useReducer(explorerReducer, initArgs, createInitialState);

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
