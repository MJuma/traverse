import { createContext, useContext } from 'react';
import type { ExplorerColorConfig } from '../colors';

const ExplorerColorContext = createContext<ExplorerColorConfig | null>(null);

export const ExplorerColorProvider = ExplorerColorContext.Provider;

export function useExplorerColors(): ExplorerColorConfig {
    const config = useContext(ExplorerColorContext);
    if (!config) {
        throw new Error('ExplorerColorProvider not provided');
    }
    return config;
}
