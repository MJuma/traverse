import { Input, Button, Spinner, Tooltip } from '@fluentui/react-components';
import {
    ChevronRightRegular,
    ChevronDownRegular,
    SearchRegular,
    DismissRegular,
} from '@fluentui/react-icons';
import React, { useMemo, useCallback, useState } from 'react';

import type { SchemaTable } from '../../services/schema';
import { useExplorerStyles } from '../ExplorerWorkspace/ExplorerWorkspace.styles';
import { SchemaTableItem } from './SchemaTableItem';
import { SchemaColumnItem } from './SchemaColumnItem';
import { FolderRow } from './FolderRow';
import { SchemaContextMenu } from './SchemaContextMenu';
import { groupSchemaByKindAndFolder, filterSchemaBySearch, computeExpandAllState } from './SchemaSidebar.logic';

const searchContainerStyle: React.CSSProperties = { display: 'flex', gap: '4px', alignItems: 'center' };
const clearButtonStyle: React.CSSProperties = { minWidth: 'auto', padding: 0 };
const expandButtonStyle: React.CSSProperties = { minWidth: 'auto' };

const searchIcon = <SearchRegular fontSize={12} />;
const dismissIcon = <DismissRegular fontSize={10} />;

interface SchemaSidebarProps {
    schema: SchemaTable[];
    insertText: (text: string) => void;
    schemaContextRunQuery: (kql: string) => void;
    loading?: boolean;
}

const loadingContainerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 } as const;
const folderPaddingStyle = { paddingLeft: '12px' } as const;

export function SchemaSidebar({ schema, insertText, schemaContextRunQuery, loading }: SchemaSidebarProps) {
    const styles = useExplorerStyles();
    const [schemaSearch, setSchemaSearch] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
    const [schemaContextMenu, setSchemaContextMenu] = useState<{ tableName: string; x: number; y: number } | null>(null);

    const toggleFolder = useCallback((folder: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folder)) {
                next.delete(folder);
            } else {
                next.add(folder);
            }
            return next;
        });
    }, []);

    const toggleTable = useCallback((tableName: string) => {
        setExpandedTables((prev) => {
            const next = new Set(prev);
            if (next.has(tableName)) {
                next.delete(tableName);
            } else {
                next.add(tableName);
            }
            return next;
        });
    }, []);

    const groupedByKind = useMemo(() => groupSchemaByKindAndFolder(schema), [schema]);

    const filteredSchema = useMemo(() => filterSchemaBySearch(schema, schemaSearch), [schema, schemaSearch]);

    const handleSearchChange = useCallback((_: React.ChangeEvent<HTMLInputElement>, data: { value: string }) => {
        setSchemaSearch(data.value);
    }, []);

    const handleClearSearch = useCallback(() => setSchemaSearch(''), []);

    const handleToggleAll = useCallback(() => {
        if (expandedTables.size > 0 || expandedFolders.size > 0) {
            setExpandedFolders(new Set());
            setExpandedTables(new Set());
        } else {
            const { allFolders, allTables } = computeExpandAllState(groupedByKind, schema);
            setExpandedFolders(allFolders);
            setExpandedTables(allTables);
        }
    }, [expandedTables, expandedFolders, groupedByKind, schema]);

    const contentAfter = useMemo(() => {
        if (!schemaSearch) {
            return undefined;
        }
        return <Button appearance="transparent" icon={dismissIcon} size="small" onClick={handleClearSearch} style={clearButtonStyle} />;
    }, [schemaSearch, handleClearSearch]);

    const expandCollapseIcon = useMemo(
        () => (expandedTables.size > 0 ? <ChevronDownRegular /> : <ChevronRightRegular />),
        [expandedTables],
    );

    return (
        <div className={styles.schemaList}>
            <div className={styles.schemaSearch}>
                <div style={searchContainerStyle}>
                    <Input className={styles.schemaSearchInput} size="small"
                        contentBefore={searchIcon}
                        placeholder="Search..."
                        value={schemaSearch}
                        onChange={handleSearchChange}
                        contentAfter={contentAfter}
                    />
                    <Tooltip content={expandedTables.size > 0 ? 'Collapse all' : 'Expand all'} relationship="label">
                        <Button appearance="subtle" size="small"
                            icon={expandCollapseIcon}
                            style={expandButtonStyle}
                            onClick={handleToggleAll} />
                    </Tooltip>
                </div>
            </div>
            <div className={styles.schemaTree}>
                {loading ? (
                    <div style={loadingContainerStyle}><Spinner size="small" label="Loading schema…" /></div>
                ) : filteredSchema ? (
                    filteredSchema.map((t) => {
                        const matchingCols = schemaSearch ? t.columns.filter((c) => c.name.toLowerCase().includes(schemaSearch.toLowerCase())) : [];
                        return (
                            <div key={t.name}>
                                <SchemaTableItem
                                    table={t}
                                    isExpanded={expandedTables.has(t.name)}
                                    toggleTable={toggleTable}
                                    setSchemaContextMenu={setSchemaContextMenu}
                                    schemaItemClassName={styles.schemaItem}
                                    schemaColTypeClassName={styles.schemaColType}
                                />
                                {(expandedTables.has(t.name) || matchingCols.length > 0) && t.columns.map((c) => {
                                    const isMatch = schemaSearch && c.name.toLowerCase().includes(schemaSearch.toLowerCase());
                                    if (schemaSearch && !expandedTables.has(t.name) && !isMatch) {
                                        return null;
                                    }
                                    return (
                                        <SchemaColumnItem
                                            key={c.name}
                                            column={c}
                                            insertText={insertText}
                                            schemaColumnClassName={styles.schemaColumn}
                                            schemaColTypeClassName={styles.schemaColType}
                                            isMatch={!!isMatch}
                                        />
                                    );
                                })}
                            </div>
                        );
                    })
                ) : (
                    groupedByKind.map((group) => (
                        <div key={group.label}>
                            <FolderRow
                                folder={group.label}
                                isExpanded={expandedFolders.has(group.label)}
                                toggleFolder={toggleFolder}
                                className={styles.folderRow}
                            />
                            {expandedFolders.has(group.label) && (
                                <>
                                    {Object.keys(group.folders).sort().map((folder) => {
                                        const items = group.folders[folder];
                                        if (!folder) {
                                            // No sub-folder — render tables directly
                                            return items.map((t) => (
                                                <div key={t.name}>
                                                    <SchemaTableItem
                                                        table={t}
                                                        isExpanded={expandedTables.has(t.name)}
                                                        toggleTable={toggleTable}
                                                        setSchemaContextMenu={setSchemaContextMenu}
                                                        schemaItemClassName={styles.schemaItem}
                                                        schemaColTypeClassName={styles.schemaColType}
                                                    />
                                                    {expandedTables.has(t.name) && t.columns.map((c) => (
                                                        <SchemaColumnItem
                                                            key={c.name}
                                                            column={c}
                                                            insertText={insertText}
                                                            schemaColumnClassName={styles.schemaColumn}
                                                            schemaColTypeClassName={styles.schemaColType}
                                                        />
                                                    ))}
                                                </div>
                                            ));
                                        }
                                        // Sub-folder within the kind
                                        return (
                                            <div key={folder} style={folderPaddingStyle}>
                                                <FolderRow
                                                    folder={folder}
                                                    folderKey={`${group.label}/${folder}`}
                                                    isExpanded={expandedFolders.has(`${group.label}/${folder}`)}
                                                    toggleFolder={toggleFolder}
                                                    className={styles.folderRow}
                                                />
                                                {expandedFolders.has(`${group.label}/${folder}`) && items.map((t) => (
                                                    <div key={t.name}>
                                                        <SchemaTableItem
                                                            table={t}
                                                            isExpanded={expandedTables.has(t.name)}
                                                            toggleTable={toggleTable}
                                                            setSchemaContextMenu={setSchemaContextMenu}
                                                            schemaItemClassName={styles.schemaItem}
                                                            schemaColTypeClassName={styles.schemaColType}
                                                        />
                                                        {expandedTables.has(t.name) && t.columns.map((c) => (
                                                            <SchemaColumnItem
                                                                key={c.name}
                                                                column={c}
                                                                insertText={insertText}
                                                                schemaColumnClassName={styles.schemaColumn}
                                                                schemaColTypeClassName={styles.schemaColType}
                                                            />
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
            {schemaContextMenu && (
                <SchemaContextMenu
                    tableName={schemaContextMenu.tableName}
                    x={schemaContextMenu.x}
                    y={schemaContextMenu.y}
                    insertText={insertText}
                    schemaContextRunQuery={schemaContextRunQuery}
                    setSchemaContextMenu={setSchemaContextMenu}
                    contextMenuClassName={styles.contextMenu}
                    contextMenuItemClassName={styles.contextMenuItem}
                />
            )}
        </div>
    );
}
