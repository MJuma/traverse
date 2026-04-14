import { Button, Input, Dropdown, Option, Spinner, Tooltip, tokens, makeStyles } from '@fluentui/react-components';
import { DeleteRegular, ReOrderDotsVerticalRegular, ArrowSyncRegular } from '@fluentui/react-icons';
import React, { useCallback, useMemo } from 'react';

import type { KustoConnection } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { CONNECTION_COLORS } from '../ExplorerWorkspace/ExplorerWorkspace.logic';

export type ValidationStatus = 'none' | 'validating' | 'valid' | 'invalid';

const rowStyle = { display: 'flex', gap: '6px', alignItems: 'flex-end', padding: '6px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` } as const;
const dragHandleStyle = { cursor: 'grab', color: tokens.colorNeutralForeground4, marginBottom: '6px', flexShrink: 0 } as const;
const rowDragOverStyle = { display: 'flex', gap: '6px', alignItems: 'flex-end', padding: '6px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, borderTop: `2px solid ${tokens.colorBrandForeground1}` } as const;
const labelStyle = { fontSize: '10px', color: tokens.colorNeutralForeground3, marginBottom: '1px' } as const;
const nameFieldStyle = { width: '140px', flexShrink: 0, display: 'flex', flexDirection: 'column' as const, gap: '2px' } as const;
const urlFieldStyle = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: '2px' } as const;
const dbFieldStyle = { width: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column' as const, gap: '2px', overflow: 'hidden' } as const;
const dbDropdownStyle = { minWidth: '180px', maxWidth: '200px' } as const;

const useDbDropdownStyles = makeStyles({
    root: {},
    listbox: {
        width: 'auto !important' as unknown as string,
        minWidth: '200px',
        maxWidth: '400px',
    },
});
const colorDotStyle = (color: string) => ({
    width: '16px', height: '16px', borderRadius: '50%', backgroundColor: color, cursor: 'pointer',
    border: `2px solid ${tokens.colorNeutralStroke1}`, flexShrink: 0, marginBottom: '6px',
}) as const;
const deleteButtonStyle = { minWidth: 'auto', marginBottom: '2px' } as const;
const dbLoadFailedButtonStyle = { width: '100%', justifyContent: 'flex-start', fontSize: '12px', color: tokens.colorPaletteRedForeground1 } as const;
const loadDbButtonStyle = { width: '100%', justifyContent: 'flex-start', fontSize: '12px', color: tokens.colorNeutralForeground3 } as const;
const readOnlyInputStyle = { opacity: 0.7 } as const;
const statusIndicatorStyle = { flexShrink: 0, marginBottom: '6px', fontSize: '14px', width: '18px', textAlign: 'center' as const } as const;
const statusValidStyle = { ...statusIndicatorStyle, color: tokens.colorPaletteGreenForeground1 } as const;
const statusInvalidStyle = { ...statusIndicatorStyle, color: tokens.colorPaletteRedForeground1 } as const;
const deleteIcon = <DeleteRegular />;
const refreshIcon = <ArrowSyncRegular />;

export interface ConnectionRowProps {
    conn: KustoConnection;
    idx: number;
    isNew?: boolean;
    canDelete: boolean;
    databases: string[];
    dbLoading: boolean;
    dbLoadFailed: boolean;
    isDragOver: boolean;
    validationStatus?: ValidationStatus;
    onUpdate: (id: string, field: keyof KustoConnection, value: string) => void;
    onRemove: (id: string) => void;
    onLoadDatabases: (clusterUrl: string) => void;
    onRefreshSchema: (clusterUrl: string, database: string) => void;
    onDragStart: (idx: number) => void;
    onDragOver: (idx: number) => void;
    onDragEnd: () => void;
}

export function ConnectionRow({ conn, idx, isNew = false, canDelete, databases, dbLoading, dbLoadFailed, isDragOver, validationStatus = 'none', onUpdate, onRemove, onLoadDatabases, onRefreshSchema, onDragStart, onDragOver, onDragEnd }: ConnectionRowProps) {
    const dbStyles = useDbDropdownStyles();
    const listboxProp = useMemo(() => ({ className: dbStyles.listbox }), [dbStyles.listbox]);
    const selectedDbOptions = useMemo(() => conn.database ? [conn.database] : [], [conn.database]);
    const selectedDbSingle = useMemo(() => [conn.database], [conn.database]);
    const handleNameChange = useCallback((_: unknown, d: { value: string }) => onUpdate(conn.id, 'name', d.value), [onUpdate, conn.id]);
    const handleUrlChange = useCallback((_: unknown, d: { value: string }) => onUpdate(conn.id, 'clusterUrl', d.value), [onUpdate, conn.id]);
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

    const handleRefresh = useCallback(() => {
        onRefreshSchema(conn.clusterUrl, conn.database);
    }, [onRefreshSchema, conn.clusterUrl, conn.database]);

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
                {isNew ? (
                    <Input size="small" value={conn.clusterUrl} onChange={handleUrlChange}
                        placeholder="https://mycluster.kusto.windows.net" />
                ) : (
                    <Input size="small" value={conn.clusterUrl} readOnly style={readOnlyInputStyle} />
                )}
            </div>
            <div style={dbFieldStyle}>
                <div style={labelStyle}>Database</div>
                {dbLoading ? (
                    <Spinner size="tiny" />
                ) : databases.length > 0 ? (
                    <div className={dbStyles.root}>
                        <Dropdown size="small" style={dbDropdownStyle}
                            positioning="below-end"
                            listbox={listboxProp}
                            value={conn.database || 'Select…'}
                            selectedOptions={selectedDbOptions}
                            onOptionSelect={handleDbSelect}>
                            {databases.map((db) => (
                                <Option key={db} value={db} text={db}>{db}</Option>
                            ))}
                        </Dropdown>
                    </div>
                ) : conn.database ? (
                    <div className={dbStyles.root}>
                        <Dropdown size="small" style={dbDropdownStyle}
                            positioning="below-end"
                            listbox={listboxProp}
                            value={conn.database}
                            selectedOptions={selectedDbSingle}
                            onOptionSelect={handleDbSelect}
                            onOpenChange={handleDbDropdownOpen}>
                            <Option key={conn.database} value={conn.database} text={conn.database}>{conn.database}</Option>
                        </Dropdown>
                    </div>
                ) : dbLoadFailed ? (
                    <Button appearance="subtle" size="small" onClick={handleDbDropdownOpen}
                        style={dbLoadFailedButtonStyle}>
                        Failed — retry
                    </Button>
                ) : (
                    <Button appearance="subtle" size="small" onClick={handleDbDropdownOpen}
                        style={loadDbButtonStyle}>
                        Load databases…
                    </Button>
                )}
            </div>
            <div style={statusIndicatorStyle}>
                {validationStatus === 'validating' && <Spinner size="tiny" />}
                {validationStatus === 'valid' && <span style={statusValidStyle}>✓</span>}
                {validationStatus === 'invalid' && (
                    <Tooltip content="Connection failed — unreachable or unauthorized" relationship="label">
                        <span style={statusInvalidStyle}>✗</span>
                    </Tooltip>
                )}
            </div>
            {!isNew && conn.database && (
                <Tooltip content="Refresh schema" relationship="label">
                    <Button appearance="subtle" icon={refreshIcon} size="small"
                        onClick={handleRefresh} style={deleteButtonStyle} />
                </Tooltip>
            )}
            {canDelete && (
                <Tooltip content="Remove" relationship="label">
                    <Button appearance="subtle" icon={deleteIcon} size="small"
                        onClick={handleRemove} style={deleteButtonStyle} />
                </Tooltip>
            )}
        </div>
    );
}
