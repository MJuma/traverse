import { Text, Button, Tooltip, tokens, Dropdown, Option, OptionGroup } from '@fluentui/react-components';
import {
    PlayRegular,
    StopRegular,
    ArrowRepeatAllRegular,
    TextAlignLeftRegular,
    KeyboardRegular,
    DismissRegular,
} from '@fluentui/react-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { listDatabases } from '../../services/schema';
import { AddConnectionDialog } from '../ConnectionDialog/AddConnectionDialog';
import { ConnectionDialog } from '../ConnectionDialog/ConnectionDialog';
import type { KustoConnection } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { saveConnections, saveActiveConnectionId } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { KEYBOARD_SHORTCUTS } from '../ExplorerWorkspace/ExplorerWorkspace.logic';
import { useExplorerStyles } from '../ExplorerWorkspace/ExplorerWorkspace.styles';
import { useExplorerState, useExplorerDispatch } from '../../context/ExplorerStateContext';
import { useKustoClient } from '../../context/KustoClientContext';
import { useExplorerColors } from '../../context/ExplorerColorContext';

const stopIcon = <StopRegular />;
const playIcon = <PlayRegular />;
const arrowRepeatIcon = <ArrowRepeatAllRegular />;
const textAlignIcon = <TextAlignLeftRegular />;
const keyboardIcon = <KeyboardRegular />;
const dismissIcon = <DismissRegular />;

const cancelButtonStyle = { backgroundColor: tokens.colorPaletteRedBackground3 } as const;
const shortcutHintStyle = { color: tokens.colorNeutralForeground4 } as const;
const connectionDropdownStyle = { minWidth: '180px', maxWidth: '280px', overflow: 'hidden' } as const;
const dbDropdownStyle = { minWidth: '100px', maxWidth: '200px', overflow: 'hidden' } as const;
const connectionOptionStyle = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;
const connectionDotStyle = (color: string) => ({ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, marginRight: '6px', flexShrink: 0 }) as const;
const modalHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } as const;
const shortcutRowStyle = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, fontSize: '13px' } as const;
const shortcutActionStyle = { color: tokens.colorNeutralForeground1 } as const;
const shortcutCodeStyle = { backgroundColor: tokens.colorNeutralBackground3, padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontFamily: 'Consolas, Monaco, monospace', color: tokens.colorNeutralForeground2 } as const;

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
const stopPropagationKeyDown = (e: React.KeyboardEvent) => e.stopPropagation();

export interface EditorToolbarProps {
    showCancel: boolean;
    onRun: () => void;
    onCancel: () => void;
    onRecall: () => void;
    onFormat: () => void;
    connections: KustoConnection[];
    focusedConnection: KustoConnection;
}

export function EditorToolbar({ showCancel, onRun, onCancel, onRecall, onFormat, connections, focusedConnection }: EditorToolbarProps) {
    const styles = useExplorerStyles();
    const { hasSelection, canRecall, loading, activeTabId, splitTabId, focusedPane } = useExplorerState();
    const dispatch = useExplorerDispatch();
    const client = useKustoClient();
    const { semantic } = useExplorerColors();

    const backdropStyle = useMemo(() => ({ position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: semantic.backdrop, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }) as const, [semantic.backdrop]);
    const modalStyle = useMemo(() => ({ backgroundColor: tokens.colorNeutralBackground1, borderRadius: '8px', padding: '16px 20px', minWidth: '320px', boxShadow: `0 8px 32px ${semantic.shadowMedium}` }) as const, [semantic.shadowMedium]);

    const [showShortcuts, setShowShortcuts] = React.useState(false);
    const [showConnDialog, setShowConnDialog] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);

    // Database dropdown state (lazy-loaded per cluster)
    const [dbCache, setDbCache] = useState<Record<string, string[]>>({});
    const [dbLoading, setDbLoading] = useState(false);
    const lastLoadedCluster = useRef('');

    const databases = dbCache[focusedConnection.clusterUrl] ?? [];
    const selectedDb = useMemo(() => focusedConnection.database ? [focusedConnection.database] : [], [focusedConnection.database]);

    // Lazy-load databases when the dropdown opens
    const handleDbDropdownOpen = useCallback((_: unknown, data: { open: boolean }) => {
        if (!data.open) {
            return;
        }
        const url = focusedConnection.clusterUrl;
        if (dbCache[url] || lastLoadedCluster.current === url) {
            return;
        }
        lastLoadedCluster.current = url;
        setDbLoading(true);
        void listDatabases(client, url).then((dbs) => {
            setDbCache((prev) => ({ ...prev, [url]: dbs }));
        }).finally(() => setDbLoading(false));
    }, [client, focusedConnection.clusterUrl, dbCache]);

    const handleDbChange = useCallback((_: unknown, data: { optionValue?: string }) => {
        if (!data.optionValue) {
            return;
        }
        // Update the connection's database in the connections array and persist
        const updated = connections.map((c) =>
            c.id === focusedConnection.id ? { ...c, database: data.optionValue! } : c,
        );
        saveConnections(updated);
        dispatch({ type: 'SET_CONNECTIONS', connections: updated });
    }, [connections, focusedConnection.id, dispatch]);

    // Reset db cache when connection changes
    useEffect(() => {
        lastLoadedCluster.current = '';
    }, [focusedConnection.id]);

    const openShortcuts = useCallback(() => setShowShortcuts(true), []);
    const closeShortcuts = useCallback(() => setShowShortcuts(false), []);
    const closeConnDialog = useCallback(() => setShowConnDialog(false), []);
    const closeAddDialog = useCallback(() => setShowAddDialog(false), []);
    const handleBackdropKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
            closeShortcuts();
        }
    }, [closeShortcuts]);

    const handleConnectionChange = useCallback((_: unknown, data: { optionValue?: string }) => {
        if (data.optionValue === '__manage__') {
            setShowConnDialog(true);
            return;
        }
        if (data.optionValue === '__add__') {
            setShowAddDialog(true);
            return;
        }
        if (data.optionValue) {
            saveActiveConnectionId(data.optionValue);
            const tabId = focusedPane === 'primary' ? activeTabId : splitTabId;
            if (tabId) {
                dispatch({ type: 'SET_TAB_CONNECTION', tabId, connectionId: data.optionValue });
            }
        }
    }, [dispatch, focusedPane, activeTabId, splitTabId]);

    const connectionDropdownValue = focusedConnection.name;

    const connectionDropdownBorderStyle = useMemo(
        () => ({ ...connectionDropdownStyle, borderLeft: `3px solid ${focusedConnection.color}` }),
        [focusedConnection.color],
    );

    const selectedOptions = useMemo(() => [focusedConnection.id], [focusedConnection.id]);

    return (
        <>
            <div className={styles.toolbar}>
                <div className={styles.toolbarLeft}>
                    {showCancel ? (
                        <Button appearance="primary" icon={stopIcon}
                            onClick={onCancel} size="small" style={cancelButtonStyle}>
                            Cancel
                        </Button>
                    ) : (
                        <Button appearance="primary" icon={playIcon}
                            onClick={onRun} size="small">
                            {hasSelection ? 'Run Selection' : 'Run'}
                        </Button>
                    )}
                    <Tooltip content={canRecall ? 'Recall cached results (Ctrl+Shift+R)' : 'No cached results for current query'} relationship="label">
                        <Button appearance="subtle" icon={arrowRepeatIcon}
                            onClick={onRecall} disabled={loading || !canRecall} size="small">
                            Recall
                        </Button>
                    </Tooltip>
                    <Tooltip content="Format query (Ctrl+Shift+F)" relationship="label">
                        <Button appearance="subtle" icon={textAlignIcon}
                            onClick={onFormat} size="small" />
                    </Tooltip>
                    <Text size={100} style={shortcutHintStyle}>Ctrl+Shift+Enter</Text>
                </div>
                <div className={styles.toolbarRight}>
                    <Tooltip content="Keyboard shortcuts" relationship="label">
                        <Button appearance="subtle" icon={keyboardIcon} size="small"
                            onClick={openShortcuts} />
                    </Tooltip>
                    <Dropdown
                        size="small"
                        style={connectionDropdownBorderStyle}
                        value={connectionDropdownValue}
                        selectedOptions={selectedOptions}
                        onOptionSelect={handleConnectionChange}
                    >
                        <OptionGroup>
                            {connections.map((c) => (
                                <Option key={c.id} value={c.id} text={c.name}>
                                    <span style={connectionDotStyle(c.color)} />
                                    <span style={connectionOptionStyle}>{c.name}</span>
                                </Option>
                            ))}
                        </OptionGroup>
                        <OptionGroup>
                            <Option key="__manage__" value="__manage__" text="Manage">⚙ Manage</Option>
                            <Option key="__add__" value="__add__" text="Add Connection…">+ Add Connection…</Option>
                        </OptionGroup>
                    </Dropdown>
                    <Dropdown
                        size="small"
                        style={dbDropdownStyle}
                        positioning="below-end"
                        value={focusedConnection.database || 'Select DB…'}
                        selectedOptions={selectedDb}
                        onOptionSelect={handleDbChange}
                        onOpenChange={handleDbDropdownOpen}
                    >
                        {focusedConnection.database && databases.length === 0 && !dbLoading && (
                            <Option key={focusedConnection.database} value={focusedConnection.database} text={focusedConnection.database}>
                                {focusedConnection.database}
                            </Option>
                        )}
                        {databases.map((db) => (
                            <Option key={db} value={db} text={db}>{db}</Option>
                        ))}
                        {dbLoading && (
                            <Option key="__loading__" value="" text="Loading…" disabled>Loading…</Option>
                        )}
                    </Dropdown>
                </div>
            </div>

            {showConnDialog && <ConnectionDialog onClose={closeConnDialog} />}
            {showAddDialog && <AddConnectionDialog onClose={closeAddDialog} />}

            {showShortcuts && (
                <div style={backdropStyle} role="dialog"
                    onClick={closeShortcuts} onKeyDown={handleBackdropKeyDown}>
                    <div style={modalStyle}
                        role="dialog"
                        onClick={stopPropagation} onKeyDown={stopPropagationKeyDown}>
                        <div style={modalHeaderStyle}>
                            <Text weight="semibold" size={400}>Keyboard Shortcuts</Text>
                            <Button appearance="subtle" icon={dismissIcon} size="small" onClick={closeShortcuts} />
                        </div>
                        {KEYBOARD_SHORTCUTS.map((s) => (
                            <div key={s.keys} style={shortcutRowStyle}>
                                <span style={shortcutActionStyle}>{s.action}</span>
                                <code style={shortcutCodeStyle}>{s.keys}</code>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
