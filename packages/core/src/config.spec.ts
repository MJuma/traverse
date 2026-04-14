import { describe, it, expect } from 'vitest';

import { CONNECTION_COLORS, DEFAULT_CONNECTION, DEFAULT_QUERY, KEYBOARD_SHORTCUTS, buildWellKnownClusters } from './config';
import type { WellKnownCluster } from './config';

describe('config', () => {
    it('CONNECTION_COLORS has 5 entries', () => {
        expect(CONNECTION_COLORS).toHaveLength(5);
    });

    it('DEFAULT_CONNECTION has required fields', () => {
        expect(DEFAULT_CONNECTION.id).toBeTruthy();
        expect(DEFAULT_CONNECTION.clusterUrl).toContain('kusto.windows.net');
        expect(DEFAULT_CONNECTION.database).toBeTruthy();
        expect(DEFAULT_CONNECTION.color).toBeTruthy();
    });

    it('DEFAULT_QUERY is non-empty', () => {
        expect(DEFAULT_QUERY.length).toBeGreaterThan(0);
    });

    it('KEYBOARD_SHORTCUTS has entries', () => {
        expect(KEYBOARD_SHORTCUTS.length).toBeGreaterThan(0);
        expect(KEYBOARD_SHORTCUTS[0].keys).toBeTruthy();
        expect(KEYBOARD_SHORTCUTS[0].action).toBeTruthy();
    });

    it('buildWellKnownClusters assigns colors cyclically', () => {
        const clusters: WellKnownCluster[] = [
            { id: 'a', name: 'A', clusterUrl: 'https://a.kusto.windows.net', database: 'DB' },
            { id: 'b', name: 'B', clusterUrl: 'https://b.kusto.windows.net', database: 'DB' },
            { id: 'c', name: 'C', clusterUrl: 'https://c.kusto.windows.net', database: 'DB' },
            { id: 'd', name: 'D', clusterUrl: 'https://d.kusto.windows.net', database: 'DB' },
            { id: 'e', name: 'E', clusterUrl: 'https://e.kusto.windows.net', database: 'DB' },
            { id: 'f', name: 'F', clusterUrl: 'https://f.kusto.windows.net', database: 'DB' },
        ];
        const result = buildWellKnownClusters(clusters);
        expect(result).toHaveLength(6);
        expect(result[0].color).toBe(CONNECTION_COLORS[0]);
        expect(result[5].color).toBe(CONNECTION_COLORS[0]); // Wraps around
        expect(result[0].id).toBe('a');
        expect(result[0].clusterUrl).toBe('https://a.kusto.windows.net');
    });
});
