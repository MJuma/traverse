import { Button, tokens } from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { listDatabases } from '../../services/schema';
import { useExplorerState, useExplorerDispatch } from '../../context/ExplorerStateContext';
import { useKustoClient } from '../../context/KustoClientContext';
import { useExplorerColors } from '../../context/ExplorerColorContext';

const emptyDbs: string[] = [];
import type { KustoConnection } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { saveConnections } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { ConnectionRow } from './ConnectionRow';

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
const stopPropagationKeyDown = (e: React.KeyboardEvent) => e.stopPropagation();

const dismissIcon = <DismissRegular />;
const footerStyle = { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: `1px solid ${tokens.colorNeutralStroke2}`, flexShrink: 0 } as const;

const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 } as const;
const titleStyle = { fontSize: '16px', fontWeight: 600, color: tokens.colorNeutralForeground1 } as const;
const listStyle = { flex: 1, overflow: 'auto', minHeight: 0 } as const;

export interface ConnectionDialogProps {
    onClose: () => void;
}

export function ConnectionDialog({ onClose }: ConnectionDialogProps) {
    const { connections } = useExplorerState();
    const dispatch = useExplorerDispatch();
    const client = useKustoClient();
    const { semantic } = useExplorerColors();

    const backdropStyle = useMemo(() => ({ position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: semantic.backdrop, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }) as const, [semantic.backdrop]);
    const modalStyle = useMemo(() => ({ backgroundColor: tokens.colorNeutralBackground1, borderRadius: '8px', padding: '20px 24px', width: '740px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' as const, boxShadow: `0 8px 32px ${semantic.shadowMedium}` }) as const, [semantic.shadowMedium]);

    const [draft, setDraft] = useState<KustoConnection[]>([...connections]);
    const [dbCache, setDbCache] = useState<Record<string, string[]>>({});
    const [dbLoading, setDbLoading] = useState<Set<string>>(new Set());
    const dragIdx = useRef<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    // Lazy-load databases for a single cluster URL (triggered by user clicking the db dropdown)
    const loadDatabases = useCallback((clusterUrl: string) => {
        if (dbCache[clusterUrl] || dbLoading.has(clusterUrl) || !clusterUrl.startsWith('https://')) {
            return;
        }
        setDbLoading((prev) => new Set([...prev, clusterUrl]));
        void listDatabases(client, clusterUrl).then((dbs) => {
            setDbCache((prev) => ({ ...prev, [clusterUrl]: dbs }));
            setDbLoading((prev) => {
                const next = new Set(prev);
                next.delete(clusterUrl);
                return next;
            });
            if (dbs.length > 0) {
                setDraft((prev) => prev.map((c) => c.clusterUrl === clusterUrl && !c.database ? { ...c, database: dbs[0] } : c));
            }
        });
    }, [client, dbCache, dbLoading]);

    const handleBackdropClick = useCallback(() => onClose(), [onClose]);
    const handleBackdropKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    const updateField = useCallback((id: string, field: keyof KustoConnection, value: string) => {
        setDraft((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
    }, []);

    const removeConnection = useCallback((id: string) => {
        setDraft((prev) => prev.filter((c) => c.id !== id));
    }, []);

    const handleDragStart = useCallback((idx: number) => { dragIdx.current = idx; }, []);
    const handleDragOver = useCallback((idx: number) => { setDragOverIdx(idx); }, []);
    const handleDragEnd = useCallback(() => {
        if (dragIdx.current !== null && dragOverIdx !== null && dragIdx.current !== dragOverIdx) {
            setDraft((prev) => {
                const next = [...prev];
                const [moved] = next.splice(dragIdx.current!, 1);
                next.splice(dragOverIdx, 0, moved);
                return next;
            });
        }
        dragIdx.current = null;
        setDragOverIdx(null);
    }, [dragOverIdx]);

    const handleSave = useCallback(() => {
        saveConnections(draft);
        dispatch({ type: 'SET_CONNECTIONS', connections: draft });
        onClose();
    }, [draft, dispatch, onClose]);

    return (
        <div style={backdropStyle} role="dialog" onClick={handleBackdropClick} onKeyDown={handleBackdropKeyDown}>
            <div style={modalStyle} role="dialog" onClick={stopPropagation} onKeyDown={stopPropagationKeyDown}>
                <div style={headerStyle}>
                    <span style={titleStyle}>Manage Connections</span>
                    <Button appearance="subtle" icon={dismissIcon} size="small" onClick={onClose} />
                </div>

                <div style={listStyle}>
                    {draft.map((conn, i) => (
                        <ConnectionRow key={conn.id} conn={conn} idx={i} canDelete={draft.length > 1}
                            databases={dbCache[conn.clusterUrl] ?? emptyDbs}
                            dbLoading={dbLoading.has(conn.clusterUrl)}
                            isDragOver={dragOverIdx === i}
                            onUpdate={updateField} onRemove={removeConnection}
                            onLoadDatabases={loadDatabases}
                            onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />
                    ))}
                </div>

                <div style={footerStyle}>
                    <Button appearance="subtle" size="small" onClick={onClose}>Cancel</Button>
                    <Button appearance="primary" size="small" onClick={handleSave}>Save</Button>
                </div>
            </div>
        </div>
    );
}
