import { tokens } from '@fluentui/react-components';
import React, { useCallback } from 'react';

import type { QueryHistoryEntry } from '../../services/queryHistory';
import { useExplorerStyles } from '../ExplorerWorkspace/ExplorerWorkspace.styles';

const deleteButtonStyle = { cursor: 'pointer', color: tokens.colorNeutralForeground3, fontSize: '12px', padding: '0 2px', background: 'none', border: 'none', outline: 'none' } as const;

export interface HistoryItemProps {
    entry: QueryHistoryEntry;
    styles: ReturnType<typeof useExplorerStyles>;
    onRecall: (entry: QueryHistoryEntry) => void;
    onDelete: (entry: QueryHistoryEntry) => void;
}

export function HistoryItem({ entry, styles, onRecall, onDelete }: HistoryItemProps) {
    const handleClick = useCallback(() => onRecall(entry), [onRecall, entry]);
    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(entry);
    }, [onDelete, entry]);

    const handleDeleteKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            onDelete(entry);
        }
    }, [onDelete, entry]);
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            handleClick();
        }
    }, [handleClick]);

    return (
        <div className={styles.historyItem} role="treeitem" tabIndex={0}
            onClick={handleClick} onKeyDown={handleKeyDown}>
            <div className={styles.historyQuery}>{entry.query}</div>
            <div className={styles.historyMeta}>
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
                {entry.status === 'success' && (
                    <>
                        <span>{entry.rowCount?.toLocaleString()} rows × {entry.columnCount} cols</span>
                        {entry.elapsed !== null && <span>{entry.elapsed}ms</span>}
                        {entry.rows && <span className={styles.historyRecallable}>● recallable</span>}
                    </>
                )}
                {entry.status === 'error' && (
                    <span className={styles.historyError}>error</span>
                )}
                <button type="button" title="Delete" onClick={handleDelete} onKeyDown={handleDeleteKeyDown}
                    style={deleteButtonStyle}>✕</button>
            </div>
        </div>
    );
}
