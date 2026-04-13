import { Button, Input, Dropdown, Option, Spinner, Tooltip, tokens } from '@fluentui/react-components';
import { DeleteRegular, ReOrderDotsVerticalRegular } from '@fluentui/react-icons';
import { useCallback, useMemo } from 'react';

import type { KustoConnection } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { CONNECTION_COLORS } from '../ExplorerWorkspace/ExplorerWorkspace.logic';

const rowStyle = { display: 'flex', gap: '6px', alignItems: 'flex-end', padding: '6px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` } as const;
const dragHandleStyle = { cursor: 'grab', color: tokens.colorNeutralForeground4, marginBottom: '6px', flexShrink: 0 } as const;
const rowDragOverStyle = { display: 'flex', gap: '6px', alignItems: 'flex-end', padding: '6px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, borderTop: `2px solid ${tokens.colorBrandForeground1}` } as const;
const labelStyle = { fontSize: '10px', color: tokens.colorNeutralForeground3, marginBottom: '1px' } as const;
const nameFieldStyle = { width: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column' as const, gap: '2px' } as const;
const urlFieldStyle = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: '2px' } as const;
const dbFieldStyle = { width: '140px', flexShrink: 0, display: 'flex', flexDirection: 'column' as const, gap: '2px' } as const;
const dbDropdownStyle = { minWidth: '120px', maxWidth: '140px', overflow: 'hidden' } as const;
const colorDotStyle = (color: string) => ({
    width: '16px', height: '16px', borderRadius: '50%', backgroundColor: color, cursor: 'pointer',
    border: `2px solid ${tokens.colorNeutralStroke1}`, flexShrink: 0, marginBottom: '6px',
}) as const;
const deleteButtonStyle = { minWidth: 'auto', marginBottom: '2px' } as const;
const readOnlyInputStyle = { opacity: 0.7 } as const;
const deleteIcon = <DeleteRegular />;

export interface ConnectionRowProps {
    conn: KustoConnection;
    idx: number;
    canDelete: boolean;
    databases: string[];
    dbLoading: boolean;
    isDragOver: boolean;
    onUpdate: (id: string, field: keyof KustoConnection, value: string) => void;
    onRemove: (id: string) => void;
    onLoadDatabases: (clusterUrl: string) => void;
    onDragStart: (idx: number) => void;
    onDragOver: (idx: number) => void;
    onDragEnd: () => void;
}

export function ConnectionRow({ conn, idx, canDelete, databases, dbLoading, isDragOver, onUpdate, onRemove, onLoadDatabases, onDragStart, onDragOver, onDragEnd }: ConnectionRowProps) {
    const handleNameChange = useCallback((_: unknown, d: { value: string }) => onUpdate(conn.id, 'name', d.value), [onUpdate, conn.id]);
    const handleRemove = useCallback(() => onRemove(conn.id), [onRemove, conn.id]);
    const handleDragStart = useCallback(() => onDragStart(idx), [onDragStart, idx]);
    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); onDragOver(idx); }, [onDragOver, idx]);
    const handleColorCycle = useCallback(() => {
        const idx2 = CONNECTION_COLORS.indexOf(conn.color);
        const next = CONNECTION_COLORS[(idx2 + 1) % CONNECTION_COLORS.length];
        onUpdate(conn.id, 'color', next);
    }, [onUpdate, conn.id, conn.color]);
    const handleColorKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            handleColorCycle();
        }
    }, [handleColorCycle]);
    const handleDbSelect = useCallback((_: unknown, data: { optionValue?: string }) => {
        if (data.optionValue) {
            onUpdate(conn.id, 'database', data.optionValue);
        }
    }, [onUpdate, conn.id]);
    const handleDbDropdownOpen = useCallback(() => {
        onLoadDatabases(conn.clusterUrl);
    }, [onLoadDatabases, conn.clusterUrl]);

    const selectedDb = useMemo(() => conn.database ? [conn.database] : [], [conn.database]);

    return (
        <div style={isDragOver ? rowDragOverStyle : rowStyle}
            draggable onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={onDragEnd}>
            <ReOrderDotsVerticalRegular style={dragHandleStyle} />
            <Tooltip content="Click to change color" relationship="label">
                <div style={colorDotStyle(conn.color)} role="menuitem" tabIndex={0} onClick={handleColorCycle} onKeyDown={handleColorKeyDown} />
            </Tooltip>
            <div style={nameFieldStyle}>
                <div style={labelStyle}>Name</div>
                <Input size="small" value={conn.name} onChange={handleNameChange} />
            </div>
            <div style={urlFieldStyle}>
                <div style={labelStyle}>Cluster URL</div>
                <Input size="small" value={conn.clusterUrl} readOnly style={readOnlyInputStyle} />
            </div>
            <div style={dbFieldStyle}>
                <div style={labelStyle}>Database</div>
                {dbLoading ? (
                    <Spinner size="tiny" />
                ) : databases.length > 0 ? (
                    <Dropdown size="small" style={dbDropdownStyle}
                        value={conn.database || 'Select…'}
                        selectedOptions={selectedDb}
                        onOptionSelect={handleDbSelect}>
                        {databases.map((db) => (
                            <Option key={db} value={db} text={db}>{db}</Option>
                        ))}
                    </Dropdown>
                ) : conn.database ? (
                    <Tooltip content="Click to switch database" relationship="label">
                        <Input size="small" value={conn.database} readOnly
                            style={readOnlyInputStyle} onClick={handleDbDropdownOpen} />
                    </Tooltip>
                ) : (
                    <Tooltip content="Click to load databases" relationship="label">
                        <Input size="small" value="Click to load…" readOnly
                            style={readOnlyInputStyle} onClick={handleDbDropdownOpen} />
                    </Tooltip>
                )}
            </div>
            {canDelete && (
                <Tooltip content="Remove" relationship="label">
                    <Button appearance="subtle" icon={deleteIcon} size="small"
                        onClick={handleRemove} style={deleteButtonStyle} />
                </Tooltip>
            )}
        </div>
    );
}
