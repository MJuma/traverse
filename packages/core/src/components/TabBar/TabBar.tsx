import { Button, Tooltip } from '@fluentui/react-components';
import { AddRegular, SplitVerticalRegular, SplitHorizontalRegular } from '@fluentui/react-icons';
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';

import { useExplorerState, useExplorerDispatch } from '../../context/ExplorerStateContext';
import { useExplorerStyles } from '../ExplorerWorkspace/ExplorerWorkspace.styles';
import { TabItem } from './TabItem';

const addIcon = <AddRegular />;
const splitVerticalIcon = <SplitVerticalRegular />;
const splitHorizontalIcon = <SplitHorizontalRegular />;
const minWidthAutoStyle = { minWidth: 'auto' } as const;
const addTabButtonStyle = { minWidth: 'auto', height: '28px' } as const;
export interface TabBarProps {
    dragTabIdRef: React.MutableRefObject<string | null>;
    onSetEditorDropTarget: (target: 'left' | 'right' | 'top' | 'bottom' | null) => void;
}

export function TabBar({ dragTabIdRef, onSetEditorDropTarget }: TabBarProps) {
    const styles = useExplorerStyles();
    const { tabs, activeTabId, splitTabId, splitEnabled, splitDirection, focusedPane, connections } = useExplorerState();
    const dispatch = useExplorerDispatch();

    const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
    const dragTabRef = useRef<number | null>(null);

    const startRename = useCallback((tabId: string, currentTitle: string) => {
        setRenamingTabId(tabId);
        setRenameValue(currentTitle);
        setContextMenu(null);
    }, []);

    const commitRename = useCallback(() => {
        if (renamingTabId && renameValue.trim()) {
            dispatch({ type: "RENAME_TAB", tabId: renamingTabId, title: renameValue.trim() });
        }
        setRenamingTabId(null);
    }, [renamingTabId, renameValue, dispatch]);

    const cancelRename = useCallback(() => setRenamingTabId(null), []);

    useEffect(() => {
        if (!contextMenu) {
            return;
        }
        const handler = () => setContextMenu(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [contextMenu]);

    const handleSwitch = useCallback((tabId: string) => dispatch({ type: "SWITCH_TAB", tabId }), [dispatch]);
    const handleContextMenuOpen = useCallback((tabId: string, x: number, y: number) => {
        setContextMenu({ tabId, x, y });
    }, []);
    const handleClose = useCallback((tabId: string) => dispatch({ type: 'CLOSE_TAB', tabId }), [dispatch]);
    const handleDragStart = useCallback((tabIdx: number, tabId: string) => {
        dragTabRef.current = tabIdx;
        dragTabIdRef.current = tabId;
    }, [dragTabIdRef]);
    const handleDragDrop = useCallback((fromRef: React.MutableRefObject<number | null>, toIdx: number) => {
        if (fromRef.current !== null && fromRef.current !== toIdx) {
            dispatch({ type: "REORDER_TABS", fromIdx: fromRef.current, toIdx });
        }
        fromRef.current = null;
        dragTabIdRef.current = null;
    }, [dispatch, dragTabIdRef]);
    const handleDragEnd = useCallback(() => {
        dragTabRef.current = null;
        dragTabIdRef.current = null;
        onSetEditorDropTarget(null);
    }, [dragTabIdRef, onSetEditorDropTarget]);
    const handleAddTab = useCallback(() => dispatch({ type: "ADD_TAB" }), [dispatch]);
    const handleSplitVertical = useCallback(() => dispatch({ type: 'TOGGLE_SPLIT', direction: 'vertical' }), [dispatch]);
    const handleSplitHorizontal = useCallback(() => dispatch({ type: 'TOGGLE_SPLIT', direction: 'horizontal' }), [dispatch]);

    const contextMenuStyle = useMemo(() =>
        contextMenu ? { top: contextMenu.y, left: contextMenu.x, position: 'fixed' as const } : undefined,
    [contextMenu]);

    const handleContextRename = useCallback(() => {
        const tab = tabs.find((t) => t.id === contextMenu?.tabId);
        if (tab) {
            startRename(tab.id, tab.title);
        }
    }, [tabs, contextMenu?.tabId, startRename]);

    const handleContextDelete = useCallback(() => {
        if (contextMenu) {
            dispatch({ type: 'CLOSE_TAB', tabId: contextMenu.tabId });
            setContextMenu(null);
        }
    }, [contextMenu, dispatch]);

    const handleContextRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            handleContextRename();
        }
    }, [handleContextRename]);

    const handleContextDeleteKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            handleContextDelete();
        }
    }, [handleContextDelete]);

    return (
        <>
            <div className={styles.queryTabBar}>
                <div className={styles.queryTabList}>
                    {tabs.map((t, idx) => {
                        const isActive = (focusedPane === 'primary' && t.id === activeTabId) || (focusedPane === 'secondary' && t.id === splitTabId);
                        const isPrimary = t.id === activeTabId;
                        const isSecondary = splitEnabled && t.id === splitTabId;
                        const connColor = connections.find((c) => c.id === t.connectionId)?.color ?? connections[0]?.color ?? '#636363';
                        return (
                            <TabItem key={t.id}
                                tabId={t.id} title={t.title} idx={idx}
                                isActive={isActive} isPrimary={isPrimary} isSecondary={isSecondary}
                                isRenaming={renamingTabId === t.id} renameValue={renameValue}
                                tabCount={tabs.length} splitEnabled={splitEnabled}
                                connectionColor={connColor}
                                activeClassName={styles.queryTabActive} inactiveClassName={styles.queryTab}
                                closeClassName={styles.queryTabClose}
                                onSwitch={handleSwitch} onStartRename={startRename}
                                onContextMenu={handleContextMenuOpen}
                                onRenameChange={setRenameValue} onCommitRename={commitRename}
                                onCancelRename={cancelRename} onClose={handleClose}
                                onDragStart={handleDragStart} onDragDrop={handleDragDrop}
                                onDragEnd={handleDragEnd} dragTabRef={dragTabRef}
                            />
                        );
                    })}
                    <Tooltip content="New tab" relationship="label">
                        <Button appearance="subtle" icon={addIcon} size="small"
                            onClick={handleAddTab} style={addTabButtonStyle} />
                    </Tooltip>
                </div>
                <div className={styles.queryTabActions}>
                    <Tooltip content="Split vertical" relationship="label">
                        <Button appearance="subtle" icon={splitVerticalIcon}
                            className={splitEnabled && splitDirection === 'vertical' ? styles.activeFilter : undefined}
                            onClick={handleSplitVertical} style={minWidthAutoStyle} />
                    </Tooltip>
                    <Tooltip content="Split horizontal" relationship="label">
                        <Button appearance="subtle" icon={splitHorizontalIcon}
                            className={splitEnabled && splitDirection === 'horizontal' ? styles.activeFilter : undefined}
                            onClick={handleSplitHorizontal} style={minWidthAutoStyle} />
                    </Tooltip>
                </div>
            </div>

            {contextMenu && (
                <div className={styles.contextMenu} style={contextMenuStyle}>
                    <div className={styles.contextMenuItem} role="menuitem" tabIndex={0}
                        onClick={handleContextRename} onKeyDown={handleContextRenameKeyDown}>Rename</div>
                    {tabs.length > 1 && (
                        <div className={styles.contextMenuDanger} role="menuitem" tabIndex={0}
                            onClick={handleContextDelete} onKeyDown={handleContextDeleteKeyDown}>Delete</div>
                    )}
                </div>
            )}
        </>
    );
}
