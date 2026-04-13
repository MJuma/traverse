import React, { useMemo, useCallback } from 'react';

import { ContextMenuItem } from './ContextMenuItem';

export interface SchemaContextMenuProps {
    tableName: string;
    x: number;
    y: number;
    insertText: (text: string) => void;
    schemaContextRunQuery: (kql: string) => void;
    setSchemaContextMenu: (menu: null) => void;
    contextMenuClassName: string;
    contextMenuItemClassName: string;
}

export function SchemaContextMenu({ tableName, x, y, insertText, schemaContextRunQuery, setSchemaContextMenu, contextMenuClassName, contextMenuItemClassName }: SchemaContextMenuProps) {
    const menuStyle = useMemo<React.CSSProperties>(() => ({ top: y, left: x, position: 'fixed' }), [x, y]);
    const handleInsertName = useCallback(() => { insertText(tableName); setSchemaContextMenu(null); }, [insertText, tableName, setSchemaContextMenu]);
    const handleTake100 = useCallback(() => schemaContextRunQuery(`${tableName}\n| take 100`), [schemaContextRunQuery, tableName]);
    const handleCount = useCallback(() => schemaContextRunQuery(`${tableName}\n| count`), [schemaContextRunQuery, tableName]);
    const handleShowSchema = useCallback(() => schemaContextRunQuery(`${tableName}\n| getschema`), [schemaContextRunQuery, tableName]);
    const handleDateRange = useCallback(() => schemaContextRunQuery(`${tableName}\n| take 1000\n| summarize min(Timestamp), max(Timestamp)`), [schemaContextRunQuery, tableName]);

    return (
        <div className={contextMenuClassName} style={menuStyle}>
            <ContextMenuItem className={contextMenuItemClassName} label="Insert name" onClick={handleInsertName} />
            <ContextMenuItem className={contextMenuItemClassName} label="Take 100" onClick={handleTake100} />
            <ContextMenuItem className={contextMenuItemClassName} label="Count rows" onClick={handleCount} />
            <ContextMenuItem className={contextMenuItemClassName} label="Show schema" onClick={handleShowSchema} />
            <ContextMenuItem className={contextMenuItemClassName} label="Date range" onClick={handleDateRange} />
        </div>
    );
}
