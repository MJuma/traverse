import { useState, useEffect, useCallback, useRef } from 'react';

import type { KustoClient, KustoResult, QueryPriority } from './kusto';

interface UseKustoQueryOptions {
    priority?: QueryPriority;
    client: KustoClient;
}

interface UseKustoQueryResult<T> {
    data: T[] | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
    kql: string;
}

export function useKustoQuery<T = Record<string, unknown>>(kql: string, options: UseKustoQueryOptions): UseKustoQueryResult<T> {
    const { client, priority } = options;
    const [data, setData] = useState<T[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

    useEffect(() => {
        if (!kql || !kql.trim()) {
            setData(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        client.queryKusto<T>(kql, undefined, priority)
            .then((result: KustoResult<T>) => {
                if (!cancelled) {
                    setData(result.rows);
                    setLoading(false);
                }
            })
            .catch((err: Error) => {
                if (!cancelled) {
                    setError(err.message);
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [kql, refreshKey, priority, client]);

    return { data, loading, error, refresh, kql };
}

export function useDeferredKustoQuery<T = Record<string, unknown>>(
    kql: string,
    options: UseKustoQueryOptions,
): UseKustoQueryResult<T> & { containerRef: React.RefObject<HTMLDivElement | null> } {
    const [visible, setVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '400px' },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const result = useKustoQuery<T>(visible ? kql : '', options);
    return { ...result, containerRef };
}

export function useKustoMgmtQuery<T = Record<string, unknown>>(kql: string, options: { client: KustoClient }): UseKustoQueryResult<T> {
    const { client } = options;
    const [data, setData] = useState<T[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        client.queryKustoMgmt<T>(kql)
            .then((result: KustoResult<T>) => {
                if (!cancelled) {
                    setData(result.rows);
                    setLoading(false);
                }
            })
            .catch((err: Error) => {
                if (!cancelled) {
                    setError(err.message);
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [kql, refreshKey, client]);

    return { data, loading, error, refresh, kql };
}
