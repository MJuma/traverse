import React, { useCallback } from 'react';
import { tokens } from '@fluentui/react-components';

const matchHighlightStyle: React.CSSProperties = { color: tokens.colorBrandForeground1 };

export interface SchemaColumnItemProps {
    column: { name: string; type: string };
    insertText: (text: string) => void;
    schemaColumnClassName: string;
    schemaColTypeClassName: string;
    isMatch?: boolean;
}

export function SchemaColumnItem({ column, insertText, schemaColumnClassName, schemaColTypeClassName, isMatch }: SchemaColumnItemProps) {
    const handleClick = useCallback(() => insertText(column.name), [insertText, column.name]);
    const handleDragStart = useCallback((e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', column.name);
        e.dataTransfer.effectAllowed = 'copy';
        e.stopPropagation();
    }, [column.name]);
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            insertText(column.name);
        }
    }, [insertText, column.name]);

    return (
        <div className={schemaColumnClassName}
            role="treeitem"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            draggable
            onDragStart={handleDragStart}
            style={isMatch ? matchHighlightStyle : undefined}>
            <span>{column.name}</span>
            <span className={schemaColTypeClassName}>{column.type}</span>
        </div>
    );
}
