import { Button, tokens, Textarea, Spinner, Menu, MenuList, MenuItem, MenuPopover, MenuTrigger, MenuSplitGroup } from '@fluentui/react-components';
import { DismissRegular, AddRegular, ArrowExportRegular, ChevronDownRegular } from '@fluentui/react-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { listDatabases, getPersistedDatabases, persistDatabases, reloadSchema, getSchema } from '../../services/schema';
import { useExplorerState, useExplorerDispatch } from '../../context/ExplorerStateContext';
import { useKustoClient } from '../../context/KustoClientContext';
import { useExplorerColors } from '../../context/ExplorerColorContext';

const emptyDbs: string[] = [];
import type { KustoConnection } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { saveConnections, shortenClusterUrl } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { CONNECTION_COLORS } from '../../config';
import { ConnectionRow } from './ConnectionRow';
import type { ValidationStatus } from './ConnectionRow';

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
const stopPropagationKeyDown = (e: React.KeyboardEvent) => e.stopPropagation();

const dismissIcon = <DismissRegular />;
const addIcon = <AddRegular />;
const exportIcon = <ArrowExportRegular />;
const footerStyle = { display: 'flex', justifyContent: 'space-between', gap: '8px', paddingTop: '12px', borderTop: `1px solid ${tokens.colorNeutralStroke2}`, flexShrink: 0 } as const;
const footerLeftStyle = { display: 'flex', gap: '8px' } as const;
const footerRightStyle = { display: 'flex', gap: '8px' } as const;
const importAreaStyle = { padding: '12px 0', borderTop: `1px solid ${tokens.colorNeutralStroke2}`, marginTop: '8px' } as const;
const importHintStyle = { fontSize: '12px', color: tokens.colorNeutralForeground3, marginBottom: '8px' } as const;
const saveSummaryStyle = { fontSize: '12px', color: tokens.colorPaletteRedForeground1, marginTop: '8px', flexShrink: 0 } as const;

const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 } as const;
const titleStyle = { fontSize: '16px', fontWeight: 600, color: tokens.colorNeutralForeground1 } as const;
const listStyle = { flex: 1, overflow: 'auto', minHeight: 0 } as const;

const hiddenInputStyle = { display: 'none' } as const;
const importTextareaStyle = { width: '100%', minHeight: '80px' } as const;
const importResultsContainerStyle = { marginTop: '8px', fontSize: '12px' } as const;
const importResultSuccessStyle = { padding: '2px 0', color: tokens.colorPaletteGreenForeground1 } as const;
const importResultErrorStyle = { padding: '2px 0', color: tokens.colorPaletteRedForeground1 } as const;
const importActionsStyle = { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '8px' } as const;
const chevronDownIcon = <ChevronDownRegular />;
const menuTriggerButtonStyle = { minWidth: 'auto', padding: '0 4px' } as const;

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

    const originalIds = useMemo(() => new Set(connections.map((c) => c.id)), [connections]);
    const originalMap = useMemo(() => {
        const map: Record<string, KustoConnection> = {};
        for (const c of connections) {
            map[c.id] = c;
        }
        return map;
    }, [connections]);

    const [draft, setDraft] = useState<KustoConnection[]>([...connections]);
    const [dbCache, setDbCache] = useState<Record<string, string[]>>(() => {
        const initial: Record<string, string[]> = {};
        for (const conn of connections) {
            const cached = getPersistedDatabases(conn.clusterUrl);
            if (cached) {
                initial[conn.clusterUrl] = cached;
            }
        }
        return initial;
    });
    const [dbLoading, setDbLoading] = useState<Set<string>>(new Set());
    const [validationStatus, setValidationStatus] = useState<Record<string, ValidationStatus>>({});
    const [saving, setSaving] = useState(false);
    const [saveSummary, setSaveSummary] = useState('');
    const dragIdx = useRef<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isNewConnection = useCallback((conn: KustoConnection) => !originalIds.has(conn.id), [originalIds]);
    const isModifiedConnection = useCallback((conn: KustoConnection) => {
        const orig = originalMap[conn.id];
        if (!orig) {
            return false;
        }
        return orig.clusterUrl !== conn.clusterUrl || orig.database !== conn.database;
    }, [originalMap]);

    const [dbLoadFailed, setDbLoadFailed] = useState<Set<string>>(new Set());

    // Lazy-load databases for a single cluster URL (triggered by user clicking the db dropdown)
    const loadDatabases = useCallback((clusterUrl: string) => {
        if (dbLoading.has(clusterUrl) || !clusterUrl.startsWith('https://')) {
            return;
        }
        // Check if already cached in local state
        const cached = dbCache[clusterUrl];
        if (cached && cached.length > 0) {
            // Already have it — just ensure the draft row has a database set
            setDraft((prev) => prev.map((c) => {
                if (c.clusterUrl !== clusterUrl) {
                    return c;
                }
                const updates: Partial<KustoConnection> = {};
                if (!c.database) {
                    updates.database = cached[0];
                }
                if (!c.name) {
                    updates.name = shortenClusterUrl(clusterUrl);
                }
                return Object.keys(updates).length > 0 ? { ...c, ...updates } : c;
            }));
            return;
        }
        // Check persistent cache
        const persisted = getPersistedDatabases(clusterUrl);
        if (persisted && persisted.length > 0) {
            setDbCache((prev) => ({ ...prev, [clusterUrl]: persisted }));
            setDraft((prev) => prev.map((c) => {
                if (c.clusterUrl !== clusterUrl) {
                    return c;
                }
                const updates: Partial<KustoConnection> = {};
                if (!c.database) {
                    updates.database = persisted[0];
                }
                if (!c.name) {
                    updates.name = shortenClusterUrl(clusterUrl);
                }
                return Object.keys(updates).length > 0 ? { ...c, ...updates } : c;
            }));
            return;
        }
        // Fetch from network
        setDbLoadFailed((prev) => { const next = new Set(prev); next.delete(clusterUrl); return next; });
        setDbLoading((prev) => new Set([...prev, clusterUrl]));
        void listDatabases(client, clusterUrl, true).then((dbs) => {
            setDbCache((prev) => ({ ...prev, [clusterUrl]: dbs }));
            setDbLoading((prev) => {
                const next = new Set(prev);
                next.delete(clusterUrl);
                return next;
            });
            if (dbs.length > 0) {
                setDbLoadFailed((prev) => { const next = new Set(prev); next.delete(clusterUrl); return next; });
                setDraft((prev) => prev.map((c) => {
                    if (c.clusterUrl !== clusterUrl) {
                        return c;
                    }
                    const updates: Partial<KustoConnection> = {};
                    if (!c.database) {
                        updates.database = dbs[0];
                    }
                    if (!c.name) {
                        updates.name = shortenClusterUrl(clusterUrl);
                    }
                    return Object.keys(updates).length > 0 ? { ...c, ...updates } : c;
                }));
            } else {
                console.error('[conn] listDatabases returned empty for:', clusterUrl);
                setDbLoadFailed((prev) => new Set([...prev, clusterUrl]));
            }
        }).catch((err) => {
            console.error('[conn] listDatabases error for:', clusterUrl, err);
            setDbLoading((prev) => {
                const next = new Set(prev);
                next.delete(clusterUrl);
                return next;
            });
            setDbLoadFailed((prev) => new Set([...prev, clusterUrl]));
        });
    }, [client, dbCache, dbLoading]);

    const handleRefreshSchema = useCallback(async (clusterUrl: string, database: string) => {
        if (!clusterUrl || !database) {
            return;
        }
        const target = { clusterUrl, database };
        await reloadSchema(client, target);
        dispatch({ type: 'SET_SCHEMA', schema: getSchema(target) });
        // Also refresh the database list
        setDbLoading((prev) => new Set([...prev, clusterUrl]));
        void listDatabases(client, clusterUrl, true).then((dbs) => {
            setDbCache((prev) => ({ ...prev, [clusterUrl]: dbs }));
            setDbLoading((prev) => {
                const next = new Set(prev);
                next.delete(clusterUrl);
                return next;
            });
        });
    }, [client, dispatch]);

    const handleBackdropClick = useCallback(() => onClose(), [onClose]);
    const handleBackdropKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    const updateField = useCallback((id: string, field: keyof KustoConnection, value: string) => {
        setDraft((prev) => {
            if (field === 'clusterUrl') {
                return prev.map((c) => c.id === id ? { ...c, clusterUrl: value, database: '' } : c);
            }
            return prev.map((c) => c.id === id ? { ...c, [field]: value } : c);
        });
        // Clear validation status and cached dbs when user edits a field
        if (field === 'clusterUrl') {
            setDbCache((prev) => {
                const conn = draft.find((c) => c.id === id);
                if (conn && prev[conn.clusterUrl]) {
                    const next = { ...prev };
                    delete next[conn.clusterUrl];
                    return next;
                }
                return prev;
            });
        }
        setValidationStatus((prev) => {
            if (prev[id]) {
                const next = { ...prev };
                delete next[id];
                return next;
            }
            return prev;
        });
    }, [draft]);

    const removeConnection = useCallback((id: string) => {
        setDraft((prev) => prev.filter((c) => c.id !== id));
        setValidationStatus((prev) => {
            if (prev[id]) {
                const next = { ...prev };
                delete next[id];
                return next;
            }
            return prev;
        });
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

    // --- Add split button ---
    const handleAddEmpty = useCallback(() => {
        const colorIdx = draft.length;
        const newConn: KustoConnection = {
            id: `conn-${Date.now()}-${colorIdx}`,
            name: '',
            clusterUrl: 'https://',
            database: '',
            color: CONNECTION_COLORS[colorIdx % CONNECTION_COLORS.length],
        };
        setDraft((prev) => [...prev, newConn]);
    }, [draft.length]);

    const hasDuplicateUrls = useMemo(() => {
        const urls = draft.map((c) => c.clusterUrl.toLowerCase()).filter((u) => u !== 'https://');
        return new Set(urls).size !== urls.length;
    }, [draft]);

    // --- Import from text ---
    const [showImportText, setShowImportText] = useState(false);
    const [importText, setImportText] = useState('');
    const [importLoading, setImportLoading] = useState(false);
    const [importResults, setImportResults] = useState<{ url: string; status: 'success' | 'error'; dbs: string[] }[]>([]);

    const handleImportFromTextOpen = useCallback(() => {
        setShowImportText(true);
        setImportText('');
        setImportResults([]);
    }, []);

    const handleImportTextClose = useCallback(() => {
        setShowImportText(false);
        setImportText('');
        setImportResults([]);
    }, []);

    const handleImportTextChange = useCallback((_: unknown, data: { value: string }) => {
        setImportText(data.value);
    }, []);

    const handleImportTextConfirm = useCallback(async () => {
        const lines = importText
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && l.startsWith('https://'));

        if (lines.length === 0) {
            return;
        }

        const existingUrls = new Set(draft.map((c) => c.clusterUrl.toLowerCase()));
        const uniqueLines = lines.filter((url) => !existingUrls.has(url.toLowerCase()));

        if (uniqueLines.length === 0) {
            return;
        }

        setImportLoading(true);
        setImportResults([]);

        const results = await Promise.all(
            uniqueLines.map(async (url) => {
                const dbs = await listDatabases(client, url);
                return { url, status: (dbs.length > 0 ? 'success' : 'error') as 'success' | 'error', dbs };
            }),
        );

        setImportResults(results);
        setImportLoading(false);

        const valid = results.filter((r) => r.status === 'success');
        if (valid.length > 0) {
            let colorIdx = draft.length;
            const newConns: KustoConnection[] = valid.map((r) => {
                const conn: KustoConnection = {
                    id: `conn-${Date.now()}-${colorIdx}`,
                    name: shortenClusterUrl(r.url),
                    clusterUrl: r.url,
                    database: r.dbs[0] ?? '',
                    color: CONNECTION_COLORS[colorIdx % CONNECTION_COLORS.length],
                };
                colorIdx++;
                setDbCache((prev) => ({ ...prev, [r.url]: r.dbs }));
                return conn;
            });
            setDraft((prev) => [...prev, ...newConns]);
        }

        if (results.every((r) => r.status === 'success')) {
            setShowImportText(false);
            setImportText('');
            setImportResults([]);
        }
    }, [importText, draft, client]);

    // --- Import from file ---
    const handleImportFromFile = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result as string) as Array<{ name?: string; clusterUrl?: string; database?: string }>;
                if (!Array.isArray(parsed)) {
                    return;
                }
                const existingUrls = new Set(draft.map((c) => c.clusterUrl.toLowerCase()));
                let colorIdx = draft.length;
                const newConns: KustoConnection[] = [];
                for (const item of parsed) {
                    if (!item.clusterUrl || existingUrls.has(item.clusterUrl.toLowerCase())) {
                        continue;
                    }
                    existingUrls.add(item.clusterUrl.toLowerCase());
                    newConns.push({
                        id: `conn-${Date.now()}-${colorIdx}`,
                        name: item.name || shortenClusterUrl(item.clusterUrl),
                        clusterUrl: item.clusterUrl,
                        database: item.database || '',
                        color: CONNECTION_COLORS[colorIdx % CONNECTION_COLORS.length],
                    });
                    colorIdx++;
                }
                if (newConns.length > 0) {
                    setDraft((prev) => [...prev, ...newConns]);
                }
            } catch {
                // Invalid JSON — ignore
            }
        };
        reader.readAsText(file);
        // Reset so the same file can be re-selected
        e.target.value = '';
    }, [draft]);

    // --- Export split button ---
    const [exportLabel, setExportLabel] = useState('Export');

    const buildExportJson = useCallback(() => {
        return JSON.stringify(draft.map((c) => ({
            name: c.name,
            clusterUrl: c.clusterUrl,
            database: c.database,
        })), null, 2);
    }, [draft]);

    const handleExportClipboard = useCallback(() => {
        const json = buildExportJson();
        void navigator.clipboard.writeText(json).then(() => {
            setExportLabel('Copied!');
            setTimeout(() => setExportLabel('Export'), 2000);
        }).catch(() => {
            // Clipboard failed — fallback to download
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'traverse-connections.json';
            a.click();
            URL.revokeObjectURL(url);
        });
    }, [buildExportJson]);

    const handleExportToFile = useCallback(() => {
        const json = buildExportJson();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'traverse-connections.json';
        a.click();
        URL.revokeObjectURL(url);
        setExportLabel('Downloaded!');
        setTimeout(() => setExportLabel('Export'), 2000);
    }, [buildExportJson]);

    // --- Save with validation ---
    const handleSave = useCallback(async () => {
        const toValidate = draft.filter((c) => isNewConnection(c) || isModifiedConnection(c));

        if (toValidate.length === 0) {
            saveConnections(draft);
            dispatch({ type: 'SET_CONNECTIONS', connections: draft });
            onClose();
            return;
        }

        setSaving(true);
        setSaveSummary('');

        // Mark all targets as validating
        const validatingStatus: Record<string, ValidationStatus> = {};
        for (const c of toValidate) {
            validatingStatus[c.id] = 'validating';
        }
        setValidationStatus((prev) => ({ ...prev, ...validatingStatus }));

        const results = await Promise.all(
            toValidate.map(async (conn) => {
                if (!conn.clusterUrl.startsWith('https://')) {
                    return { id: conn.id, ok: false, dbs: [] as string[] };
                }
                try {
                    const dbs = await listDatabases(client, conn.clusterUrl);
                    return { id: conn.id, ok: dbs.length > 0, dbs };
                } catch {
                    return { id: conn.id, ok: false, dbs: [] as string[] };
                }
            }),
        );

        const newStatus: Record<string, ValidationStatus> = {};
        const failedIds = new Set<string>();
        let updatedDraft = [...draft];

        for (const r of results) {
            if (r.ok) {
                newStatus[r.id] = 'valid';
                persistDatabases(
                    updatedDraft.find((c) => c.id === r.id)!.clusterUrl,
                    r.dbs,
                );
                setDbCache((prev) => ({
                    ...prev,
                    [updatedDraft.find((c) => c.id === r.id)!.clusterUrl]: r.dbs,
                }));
                // Auto-select first database if none set
                const conn = updatedDraft.find((c) => c.id === r.id)!;
                if (!conn.database && r.dbs.length > 0) {
                    updatedDraft = updatedDraft.map((c) =>
                        c.id === r.id ? { ...c, database: r.dbs[0] } : c,
                    );
                }
            } else {
                newStatus[r.id] = 'invalid';
                failedIds.add(r.id);
            }
        }

        setValidationStatus((prev) => ({ ...prev, ...newStatus }));
        setDraft(updatedDraft);

        if (failedIds.size > 0) {
            const validConns = updatedDraft.filter((c) => !failedIds.has(c.id));
            const failedCount = failedIds.size;
            setSaveSummary(`${failedCount} connection${failedCount !== 1 ? 's' : ''} failed validation and were not saved.`);

            // Save only the valid connections
            if (validConns.length > 0) {
                saveConnections(validConns);
                dispatch({ type: 'SET_CONNECTIONS', connections: validConns });
            }
        } else {
            saveConnections(updatedDraft);
            dispatch({ type: 'SET_CONNECTIONS', connections: updatedDraft });
            onClose();
        }

        setSaving(false);
    }, [draft, isNewConnection, isModifiedConnection, client, dispatch, onClose]);

    const hasChanges = useMemo(() => {
        if (draft.length !== connections.length) {
            return true;
        }
        return draft.some((c, i) => {
            const orig = connections[i];
            return !orig || c.id !== orig.id || c.name !== orig.name || c.clusterUrl !== orig.clusterUrl || c.database !== orig.database || c.color !== orig.color;
        });
    }, [draft, connections]);

    return (
        <div style={backdropStyle} role="dialog" onClick={handleBackdropClick} onKeyDown={handleBackdropKeyDown}>
            <div style={modalStyle} role="dialog" onClick={stopPropagation} onKeyDown={stopPropagationKeyDown}>
                <div style={headerStyle}>
                    <span style={titleStyle}>Manage Connections</span>
                    <Button appearance="subtle" icon={dismissIcon} size="small" onClick={onClose} />
                </div>

                <div style={listStyle}>
                    {draft.map((conn, i) => (
                        <ConnectionRow key={conn.id} conn={conn} idx={i}
                            isNew={isNewConnection(conn)}
                            canDelete={draft.length > 1}
                            databases={dbCache[conn.clusterUrl] ?? emptyDbs}
                            dbLoading={dbLoading.has(conn.clusterUrl)}
                            dbLoadFailed={dbLoadFailed.has(conn.clusterUrl)}
                            isDragOver={dragOverIdx === i}
                            validationStatus={validationStatus[conn.id] ?? 'none'}
                            onUpdate={updateField} onRemove={removeConnection}
                            onLoadDatabases={loadDatabases}
                            onRefreshSchema={handleRefreshSchema}
                            onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />
                    ))}
                </div>

                {showImportText && (
                    <div style={importAreaStyle}>
                        <div style={importHintStyle}>Paste cluster URLs, one per line (e.g., https://mycluster.kusto.windows.net)</div>
                        <Textarea
                            value={importText}
                            onChange={handleImportTextChange}
                            placeholder="https://cluster1.kusto.windows.net&#10;https://cluster2.kusto.windows.net"
                            resize="vertical"
                            disabled={importLoading}
                            style={importTextareaStyle}
                        />
                        {importResults.length > 0 && (
                            <div style={importResultsContainerStyle}>
                                {importResults.map((r) => (
                                    <div key={r.url} style={r.status === 'success' ? importResultSuccessStyle : importResultErrorStyle}>
                                        {r.status === 'success' ? '✓' : '✗'} {shortenClusterUrl(r.url)}
                                        {r.status === 'success' ? ` (${r.dbs.length} databases)` : ' — unreachable or unauthorized'}
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={importActionsStyle}>
                            {importLoading && <Spinner size="tiny" />}
                            <Button appearance="subtle" size="small" onClick={handleImportTextClose} disabled={importLoading}>Cancel</Button>
                            <Button appearance="primary" size="small" onClick={handleImportTextConfirm} disabled={importLoading}>
                                {importLoading ? 'Validating...' : 'Add Clusters'}
                            </Button>
                        </div>
                    </div>
                )}

                {saveSummary && (
                    <div style={saveSummaryStyle}>{saveSummary}</div>
                )}
                {hasDuplicateUrls && (
                    <div style={saveSummaryStyle}>Duplicate cluster URLs are not allowed. Remove duplicates to save.</div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    style={hiddenInputStyle}
                    onChange={handleFileChange}
                />

                <div style={footerStyle}>
                    <div style={footerLeftStyle}>
                        <Menu>
                            <MenuSplitGroup>
                                <Button appearance="subtle" size="small" icon={addIcon} onClick={handleAddEmpty}>
                                    Add
                                </Button>
                                <MenuTrigger disableButtonEnhancement>
                                    <Button appearance="subtle" size="small" icon={chevronDownIcon} style={menuTriggerButtonStyle} />
                                </MenuTrigger>
                            </MenuSplitGroup>
                            <MenuPopover>
                                <MenuList>
                                    <MenuItem onClick={handleImportFromTextOpen}>Import from text</MenuItem>
                                    <MenuItem onClick={handleImportFromFile}>Import from file</MenuItem>
                                </MenuList>
                            </MenuPopover>
                        </Menu>
                        <Menu>
                            <MenuSplitGroup>
                                <Button appearance="subtle" size="small" icon={exportIcon} onClick={handleExportClipboard}>
                                    {exportLabel}
                                </Button>
                                <MenuTrigger disableButtonEnhancement>
                                    <Button appearance="subtle" size="small" icon={chevronDownIcon} style={menuTriggerButtonStyle} />
                                </MenuTrigger>
                            </MenuSplitGroup>
                            <MenuPopover>
                                <MenuList>
                                    <MenuItem onClick={handleExportToFile}>Export to file</MenuItem>
                                </MenuList>
                            </MenuPopover>
                        </Menu>
                    </div>
                    <div style={footerRightStyle}>
                        <Button appearance="subtle" size="small" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button appearance="primary" size="small" onClick={handleSave} disabled={saving || !hasChanges || hasDuplicateUrls}>
                            {saving ? <><Spinner size="tiny" />&nbsp;Saving…</> : 'Save'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
