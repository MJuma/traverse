/**
 * Pure functions for SchemaSidebar — no React dependencies.
 */

import type { SchemaTable } from '../../services/schema';

export interface SchemaGroup {
    label: string;
    kind: SchemaTable['kind'];
    folders: Record<string, SchemaTable[]>;
}

const KIND_LABELS: { kind: SchemaTable['kind']; label: string }[] = [
    { kind: 'function', label: 'Functions' },
    { kind: 'materializedView', label: 'Materialized Views' },
    { kind: 'table', label: 'Tables' },
    { kind: 'externalTable', label: 'External Tables' },
];

/**
 * Group schema items by kind, then by folder within each kind.
 * Only includes kinds that have at least one item.
 */
export function groupSchemaByKindAndFolder(schema: SchemaTable[]): SchemaGroup[] {
    const groups: SchemaGroup[] = [];
    for (const { kind, label } of KIND_LABELS) {
        const items = schema.filter((t) => t.kind === kind);
        if (items.length === 0) {
            continue;
        }
        const folders: Record<string, SchemaTable[]> = {};
        for (const item of items) {
            const folder = item.folder || '';
            if (!folders[folder]) {
                folders[folder] = [];
            }
            folders[folder].push(item);
        }
        groups.push({ label, kind, folders });
    }
    return groups;
}

/**
 * Filter schema tables by a search query, matching on table name
 * or column name (case-insensitive). Returns null when query is empty.
 */
export function filterSchemaBySearch(schema: SchemaTable[], query: string): SchemaTable[] | null {
    if (!query.trim()) {
        return null;
    }
    const q = query.toLowerCase();
    return schema.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q)),
    );
}

/**
 * Compute the sets of folder and table names for the "expand all" action.
 */
export function computeExpandAllState(groups: SchemaGroup[], schema: SchemaTable[]): { allFolders: Set<string>; allTables: Set<string> } {
    const allFolders = new Set<string>();
    for (const group of groups) {
        allFolders.add(group.label);
        for (const folder of Object.keys(group.folders)) {
            if (folder) {
                allFolders.add(`${group.label}/${folder}`);
            }
        }
    }
    const allTables = new Set(schema.map((t) => t.name));
    return { allFolders, allTables };
}
