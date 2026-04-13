import React, { useMemo, useCallback } from 'react';
import { ChevronDownRegular, ChevronRightRegular, TableSimpleRegular } from '@fluentui/react-icons';

import type { SchemaTable } from '../../services/schema';
import { useExplorerColors } from '../../context/ExplorerColorContext';

const badgeBaseStyle: React.CSSProperties = { fontSize: '9px', fontWeight: 700, width: '14px', textAlign: 'center', flexShrink: 0 };
const tableIconFlexStyle: React.CSSProperties = { flexShrink: 0 };

interface BadgeStyles {
    functionBadge: React.CSSProperties;
    mvBadge: React.CSSProperties;
    lookupBadge: React.CSSProperties;
}

export function tableIcon(table: SchemaTable, badges: BadgeStyles): React.ReactNode {
    if (table.kind === 'function') {
        return <span title="Function" style={badges.functionBadge}>fn</span>;
    }
    if (table.kind === 'materializedView') {
        return <span title="Materialized View" style={badges.mvBadge}>MV</span>;
    }
    if (table.folder === 'Lookup') {
        return <span title="Lookup Table" style={badges.lookupBadge}>LU</span>;
    }
    return <TableSimpleRegular fontSize={12} style={tableIconFlexStyle} />;
}

export interface SchemaTableItemProps {
    table: SchemaTable;
    isExpanded: boolean;
    toggleTable: (name: string) => void;
    setSchemaContextMenu: (menu: { tableName: string; x: number; y: number }) => void;
    schemaItemClassName: string;
    schemaColTypeClassName: string;
}

export function SchemaTableItem({ table, isExpanded, toggleTable, setSchemaContextMenu, schemaItemClassName, schemaColTypeClassName }: SchemaTableItemProps) {
    const { semantic } = useExplorerColors();
    const badges = useMemo<BadgeStyles>(() => ({
        functionBadge: { ...badgeBaseStyle, color: semantic.functionBadge },
        mvBadge: { ...badgeBaseStyle, color: semantic.materializedViewBadge },
        lookupBadge: { ...badgeBaseStyle, color: semantic.lookupBadge },
    }), [semantic.functionBadge, semantic.materializedViewBadge, semantic.lookupBadge]);
    const handleClick = useCallback(() => toggleTable(table.name), [toggleTable, table.name]);
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setSchemaContextMenu({ tableName: table.name, x: e.clientX, y: e.clientY });
    }, [setSchemaContextMenu, table.name]);
    const handleDragStart = useCallback((e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', table.name);
        e.dataTransfer.effectAllowed = 'copy';
    }, [table.name]);
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleTable(table.name);
        }
    }, [toggleTable, table.name]);

    return (
        <div className={schemaItemClassName}
            role="treeitem"
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            draggable
            onDragStart={handleDragStart}
            title={table.description}>
            {isExpanded ? <ChevronDownRegular fontSize={10} /> : <ChevronRightRegular fontSize={10} />}
            {tableIcon(table, badges)}<span>{table.name}</span>
            <span className={schemaColTypeClassName}>{table.columns.length}</span>
        </div>
    );
}
