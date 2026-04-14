import { Button, Tooltip, Menu, MenuList, MenuItem, MenuPopover, MenuDivider, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger } from '@fluentui/react-components';
import { AddRegular, SplitVerticalRegular, SplitHorizontalRegular, RenameRegular, CopyRegular, DismissRegular, DismissCircleRegular } from '@fluentui/react-icons';
import React, { useState, useCallback, useRef, useMemo } from 'react';

import { useExplorerState, useExplorerDispatch } from '../../context/ExplorerStateContext';
import { useExplorerStyles } from '../ExplorerWorkspace/ExplorerWorkspace.styles';
import { TabItem } from './TabItem';
import { shouldConfirmClose, shouldConfirmCloseOthers, getDropIndicatorIndex } from './TabBar.logic';

const addIcon = <AddRegular />;
const splitVerticalIcon = <SplitVerticalRegular />;
const splitHorizontalIcon = <SplitHorizontalRegular />;
const renameIcon = <RenameRegular />;
const copyIcon = <CopyRegular />;
const dismissMenuIcon = <DismissRegular />;
const dismissCircleIcon = <DismissCircleRegular />;
const minWidthAutoStyle = { minWidth: 'auto' } as const;
const addTabButtonStyle = { minWidth: 'auto', height: '28px', marginLeft: '4px', marginRight: '4px' } as const;
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
    const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);
    const [pendingCloseOthersTabId, setPendingCloseOthersTabId] = useState<string | null>(null);
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

    const [dropIndicatorIdx, setDropIndicatorIdx] = useState<number | null>(null);

    const handleSwitch = useCallback((tabId: string) => dispatch({ type: "SWITCH_TAB", tabId }), [dispatch]);
    const handleContextMenuOpen = useCallback((tabId: string, x: number, y: number) => {
        setContextMenu({ tabId, x, y });
    }, []);
    const handleClose = useCallback((tabId: string) => {
        if (shouldConfirmClose(tabs, tabId)) {
            setPendingCloseTabId(tabId);
        } else {
            dispatch({ type: 'CLOSE_TAB', tabId });
        }
    }, [tabs, dispatch]);
    const confirmClose = useCallback(() => {
        if (pendingCloseTabId) {
            dispatch({ type: 'CLOSE_TAB', tabId: pendingCloseTabId });
            setPendingCloseTabId(null);
        }
    }, [pendingCloseTabId, dispatch]);
    const cancelClose = useCallback(() => setPendingCloseTabId(null), []);
    const confirmCloseOthers = useCallback(() => {
        if (pendingCloseOthersTabId) {
            dispatch({ type: 'CLOSE_OTHER_TABS', tabId: pendingCloseOthersTabId });
            setPendingCloseOthersTabId(null);
        }
    }, [pendingCloseOthersTabId, dispatch]);
    const cancelCloseOthers = useCallback(() => setPendingCloseOthersTabId(null), []);
    const handleDragStart = useCallback((tabIdx: number, tabId: string) => {
        dragTabRef.current = tabIdx;
        dragTabIdRef.current = tabId;
    }, [dragTabIdRef]);
    const handleDragOverTab = useCallback((e: React.DragEvent, toIdx: number) => {
        if (dragTabRef.current === null) {
            return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        setDropIndicatorIdx(getDropIndicatorIndex(dragTabRef.current, toIdx, rect, e.clientX));
    }, []);
    const handleDragDrop = useCallback((fromRef: React.MutableRefObject<number | null>, toIdx: number) => {
        if (fromRef.current !== null && fromRef.current !== toIdx) {
            dispatch({ type: "REORDER_TABS", fromIdx: fromRef.current, toIdx });
        }
        fromRef.current = null;
        dragTabIdRef.current = null;
        setDropIndicatorIdx(null);
    }, [dispatch, dragTabIdRef]);
    const handleDragEnd = useCallback(() => {
        dragTabRef.current = null;
        dragTabIdRef.current = null;
        onSetEditorDropTarget(null);
        setDropIndicatorIdx(null);
    }, [dragTabIdRef, onSetEditorDropTarget]);
    const handleAddTab = useCallback(() => dispatch({ type: "ADD_TAB" }), [dispatch]);
    const handleSplitVertical = useCallback(() => dispatch({ type: 'TOGGLE_SPLIT', direction: 'vertical' }), [dispatch]);
    const handleSplitHorizontal = useCallback(() => dispatch({ type: 'TOGGLE_SPLIT', direction: 'horizontal' }), [dispatch]);

    const handleContextRename = useCallback(() => {
        const tab = tabs.find((t) => t.id === contextMenu?.tabId);
        if (tab) {
            startRename(tab.id, tab.title);
        }
        setContextMenu(null);
    }, [tabs, contextMenu?.tabId, startRename]);

    const handleContextDuplicate = useCallback(() => {
        if (contextMenu) {
            dispatch({ type: 'DUPLICATE_TAB', tabId: contextMenu.tabId });
        }
        setContextMenu(null);
    }, [contextMenu, dispatch]);

    const handleContextClose = useCallback(() => {
        const tabId = contextMenu?.tabId;
        setContextMenu(null);
        if (tabId) {
            handleClose(tabId);
        }
    }, [contextMenu?.tabId, handleClose]);

    const handleContextCloseOthers = useCallback(() => {
        const tabId = contextMenu?.tabId;
        setContextMenu(null);
        if (!tabId) {
            return;
        }
        if (shouldConfirmCloseOthers(tabs, tabId)) {
            setPendingCloseOthersTabId(tabId);
        } else {
            dispatch({ type: 'CLOSE_OTHER_TABS', tabId });
        }
    }, [contextMenu?.tabId, tabs, dispatch]);

    const handleMenuOpenChange = useCallback((_e: unknown, data: { open: boolean }) => {
        if (!data.open) {
            setContextMenu(null);
        }
    }, []);

    const handleCloseDialogOpenChange = useCallback((_e: unknown, data: { open: boolean }) => {
        if (!data.open) {
            cancelClose();
        }
    }, [cancelClose]);

    const handleCloseOthersDialogOpenChange = useCallback((_e: unknown, data: { open: boolean }) => {
        if (!data.open) {
            cancelCloseOthers();
        }
    }, [cancelCloseOthers]);

    const contextMenuPositioning = useMemo(() => {
        if (!contextMenu) {
            return undefined;
        }
        return { target: { getBoundingClientRect: () => ({ x: contextMenu.x, y: contextMenu.y, top: contextMenu.y, left: contextMenu.x, bottom: contextMenu.y, right: contextMenu.x, width: 0, height: 0, toJSON: () => ({}) }) } };
    }, [contextMenu]);

    const tabListRef = useRef<HTMLDivElement>(null);
    const handleTabListWheel = useCallback((e: React.WheelEvent) => {
        if (tabListRef.current && e.deltaY !== 0) {
            tabListRef.current.scrollLeft += e.deltaY;
            e.preventDefault();
        }
    }, []);

    return (
        <>
            <div className={styles.queryTabBar}>
                <div className={styles.queryTabList} ref={tabListRef} onWheel={handleTabListWheel}>
                    {tabs.map((t, idx) => {
                        const isPrimary = t.id === activeTabId;
                        const isSecondary = splitEnabled && t.id === splitTabId;
                        const isActive = (focusedPane === 'primary' && isPrimary) || (focusedPane === 'secondary' && isSecondary);
                        const connColor = connections.find((c) => c.id === t.connectionId)?.color ?? connections[0]?.color ?? '#636363';
                        return (
                            <React.Fragment key={t.id}>
                                {dropIndicatorIdx === idx && <div className={styles.tabDropIndicator} />}
                                <TabItem
                                    tabId={t.id} title={t.title} idx={idx}
                                    isActive={isActive} isPrimary={isPrimary} isSecondary={isSecondary}
                                    isRenaming={renamingTabId === t.id} renameValue={renameValue}
                                    tabCount={tabs.length} splitEnabled={splitEnabled}
                                    connectionColor={connColor}
                                    activeClassName={styles.queryTabActive} inactiveClassName={styles.queryTab}
                                    closeClassName={styles.queryTabClose}
                                    splitBadgeClassName={styles.splitBadge}
                                    splitDirection={splitDirection}
                                    onSwitch={handleSwitch} onStartRename={startRename}
                                    onContextMenu={handleContextMenuOpen}
                                    onRenameChange={setRenameValue} onCommitRename={commitRename}
                                    onCancelRename={cancelRename} onClose={handleClose}
                                    onDragStart={handleDragStart} onDragOverTab={handleDragOverTab}
                                    onDragDrop={handleDragDrop}
                                    onDragEnd={handleDragEnd} dragTabRef={dragTabRef}
                                />
                            </React.Fragment>
                        );
                    })}
                    {dropIndicatorIdx === tabs.length && <div className={styles.tabDropIndicator} />}
                </div>
                <Tooltip content="New tab" relationship="label" positioning="below">
                    <Button appearance="subtle" icon={addIcon} size="small"
                        onClick={handleAddTab} style={addTabButtonStyle} />
                </Tooltip>
                <div className={styles.queryTabActions}>
                    <Tooltip content="Split vertical" relationship="label" positioning="below">
                        <Button appearance="subtle" icon={splitVerticalIcon}
                            className={splitEnabled && splitDirection === 'vertical' ? styles.activeFilter : undefined}
                            onClick={handleSplitVertical} style={minWidthAutoStyle} />
                    </Tooltip>
                    <Tooltip content="Split horizontal" relationship="label" positioning="below">
                        <Button appearance="subtle" icon={splitHorizontalIcon}
                            className={splitEnabled && splitDirection === 'horizontal' ? styles.activeFilter : undefined}
                            onClick={handleSplitHorizontal} style={minWidthAutoStyle} />
                    </Tooltip>
                </div>
            </div>

            {contextMenu && (
                <Menu open positioning={contextMenuPositioning} onOpenChange={handleMenuOpenChange}>
                    <MenuPopover>
                        <MenuList>
                            <MenuItem icon={renameIcon} onClick={handleContextRename}>Rename</MenuItem>
                            <MenuItem icon={copyIcon} onClick={handleContextDuplicate}>Duplicate</MenuItem>
                            {tabs.length > 1 && <MenuDivider />}
                            {tabs.length > 1 && (
                                <MenuItem icon={dismissMenuIcon} onClick={handleContextClose}>Close</MenuItem>
                            )}
                            {tabs.length > 1 && (
                                <MenuItem icon={dismissCircleIcon} onClick={handleContextCloseOthers}>Close Others</MenuItem>
                            )}
                        </MenuList>
                    </MenuPopover>
                </Menu>
            )}

            <Dialog open={pendingCloseTabId !== null} onOpenChange={handleCloseDialogOpenChange}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>Close tab?</DialogTitle>
                        <DialogContent>
                            This tab has unsaved content that will be lost. Are you sure you want to close it?
                        </DialogContent>
                        <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" onClick={cancelClose}>Cancel</Button>
                            </DialogTrigger>
                            <Button appearance="primary" onClick={confirmClose}>Close</Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            <Dialog open={pendingCloseOthersTabId !== null} onOpenChange={handleCloseOthersDialogOpenChange}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>Close other tabs?</DialogTitle>
                        <DialogContent>
                            Some tabs have unsaved content that will be lost. Are you sure you want to close them?
                        </DialogContent>
                        <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" onClick={cancelCloseOthers}>Cancel</Button>
                            </DialogTrigger>
                            <Button appearance="primary" onClick={confirmCloseOthers}>Close Others</Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </>
    );
}
