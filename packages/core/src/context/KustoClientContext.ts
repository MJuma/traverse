import { createContext, useContext } from 'react';
import type { KustoClient } from '../services/kusto';

export const KustoClientContext = createContext<KustoClient | null>(null);

export function useKustoClient(): KustoClient {
    const client = useContext(KustoClientContext);
    if (!client) {
        throw new Error('KustoClientContext not provided');
    }
    return client;
}
