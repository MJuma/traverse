import { Button, Input, Dropdown, Option, Spinner, tokens } from '@fluentui/react-components';
import { CheckmarkRegular, DismissRegular } from '@fluentui/react-icons';
import React, { useCallback, useMemo, useState } from 'react';

import { listDatabases } from '../../services/schema';
import { useExplorerState, useExplorerDispatch } from '../../context/ExplorerStateContext';
import { useKustoClient } from '../../context/KustoClientContext';
import { useExplorerColors } from '../../context/ExplorerColorContext';
import type { KustoConnection } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { CONNECTION_COLORS, saveConnections } from '../ExplorerWorkspace/ExplorerWorkspace.logic';

const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } as const;
const titleStyle = { fontSize: '16px', fontWeight: 600, color: tokens.colorNeutralForeground1 } as const;
const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: '4px', marginBottom: '12px' } as const;
const labelStyle = { fontSize: '11px', color: tokens.colorNeutralForeground3 } as const;
const testRowStyle = { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' } as const;
const footerStyle = { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: `1px solid ${tokens.colorNeutralStroke2}` } as const;
const dbDropdownStyle = { minWidth: '200px' } as const;

const dismissIcon = <DismissRegular />;
const checkIcon = <CheckmarkRegular />;

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
const stopPropagationKeyDown = (e: React.KeyboardEvent) => e.stopPropagation();

export interface AddConnectionDialogProps {
    onClose: () => void;
}

export function AddConnectionDialog({ onClose }: AddConnectionDialogProps) {
    const { connections } = useExplorerState();
    const dispatch = useExplorerDispatch();
    const client = useKustoClient();
    const { semantic } = useExplorerColors();

    const backdropStyle = useMemo(() => ({ position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: semantic.backdrop, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }) as const, [semantic.backdrop]);
    const modalStyle = useMemo(() => ({ backgroundColor: tokens.colorNeutralBackground1, borderRadius: '8px', padding: '20px 24px', width: '500px', boxShadow: `0 8px 32px ${semantic.shadowMedium}` }) as const, [semantic.shadowMedium]);
    const statusStyle = useCallback((ok: boolean) => ({ fontSize: '12px', color: ok ? semantic.functionBadge : tokens.colorPaletteRedForeground1 }) as const, [semantic.functionBadge]);

    const [name, setName] = useState('');
    const [clusterUrl, setClusterUrl] = useState('https://');
    const [database, setDatabase] = useState('');
    const [databases, setDatabases] = useState<string[]>([]);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
    const [testError, setTestError] = useState('');

    const handleBackdropClick = useCallback(() => onClose(), [onClose]);
    const handleBackdropKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    const handleNameChange = useCallback((_: unknown, d: { value: string }) => setName(d.value), []);
    const handleClusterChange = useCallback((_: unknown, d: { value: string }) => setClusterUrl(d.value), []);

    const handleTest = useCallback(async () => {
        if (!clusterUrl.startsWith('https://')) {
            return;
        }
        setTesting(true);
        setTestResult(null);
        setTestError('');
        setDatabases([]);
        try {
            const dbs = await listDatabases(client, clusterUrl);
            if (dbs.length > 0) {
                setDatabases(dbs);
                setTestResult('success');
                if (!database) {
                    setDatabase(dbs[0]);
                }
                if (!name) {
                    const short = clusterUrl.replace(/^https?:\/\//, '').replace(/\.kusto\.windows\.net$/, '');
                    setName(short);
                }
            } else {
                setTestResult('error');
                setTestError('No databases found or access denied');
            }
        } catch (err) {
            setTestResult('error');
            setTestError(err instanceof Error ? err.message : String(err));
        } finally {
            setTesting(false);
        }
    }, [client, clusterUrl, database, name]);

    const handleDbSelect = useCallback((_: unknown, data: { optionValue?: string }) => {
        if (data.optionValue) {
            setDatabase(data.optionValue);
        }
    }, []);

    const handleAdd = useCallback(() => {
        if (!name.trim() || !clusterUrl.trim() || !database) {
            return;
        }
        const usedColors = new Set(connections.map((c) => c.color));
        const color = CONNECTION_COLORS.find((c) => !usedColors.has(c)) ?? CONNECTION_COLORS[connections.length % CONNECTION_COLORS.length];
        const newConn: KustoConnection = { id: `conn-${Date.now()}`, name: name.trim(), clusterUrl: clusterUrl.trim(), database, color };
        const updated = [...connections, newConn];
        saveConnections(updated);
        dispatch({ type: 'SET_CONNECTIONS', connections: updated });
        onClose();
    }, [name, clusterUrl, database, connections, dispatch, onClose]);

    const selectedDb = useMemo(() => database ? [database] : [], [database]);
    const canAdd = name.trim() !== '' && clusterUrl.startsWith('https://') && database !== '';

    return (
        <div style={backdropStyle} role="dialog" onClick={handleBackdropClick} onKeyDown={handleBackdropKeyDown}>
            <div style={modalStyle} role="dialog" onClick={stopPropagation} onKeyDown={stopPropagationKeyDown}>
                <div style={headerStyle}>
                    <span style={titleStyle}>Add Connection</span>
                    <Button appearance="subtle" icon={dismissIcon} size="small" onClick={onClose} />
                </div>

                <div style={fieldStyle}>
                    <div style={labelStyle}>Cluster URL</div>
                    <Input size="small" value={clusterUrl} onChange={handleClusterChange}
                        placeholder="https://mycluster.kusto.windows.net" />
                </div>

                <div style={testRowStyle}>
                    <Button appearance="primary" size="small" icon={testing ? undefined : checkIcon}
                        onClick={handleTest} disabled={testing || !clusterUrl.startsWith('https://')}>
                        {testing ? <><Spinner size="tiny" />&nbsp;Testing…</> : 'Test Connection'}
                    </Button>
                    {testResult === 'success' && <span style={statusStyle(true)}>✓ Connected — {databases.length} database{databases.length !== 1 ? 's' : ''} found</span>}
                    {testResult === 'error' && <span style={statusStyle(false)}>✗ {testError}</span>}
                </div>

                {databases.length > 0 && (
                    <>
                        <div style={fieldStyle}>
                            <div style={labelStyle}>Database</div>
                            <Dropdown size="small" style={dbDropdownStyle}
                                value={database || 'Select…'}
                                selectedOptions={selectedDb}
                                onOptionSelect={handleDbSelect}>
                                {databases.map((db) => (
                                    <Option key={db} value={db} text={db}>{db}</Option>
                                ))}
                            </Dropdown>
                        </div>

                        <div style={fieldStyle}>
                            <div style={labelStyle}>Display Name</div>
                            <Input size="small" value={name} onChange={handleNameChange}
                                placeholder="My Cluster" />
                        </div>
                    </>
                )}

                <div style={footerStyle}>
                    <Button appearance="subtle" size="small" onClick={onClose}>Cancel</Button>
                    <Button appearance="primary" size="small" onClick={handleAdd} disabled={!canAdd}>
                        Add
                    </Button>
                </div>
            </div>
        </div>
    );
}
