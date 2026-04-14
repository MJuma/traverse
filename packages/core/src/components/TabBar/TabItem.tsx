import { useCallback, useEffect, useRef } from 'react';
import { DismissRegular } from '@fluentui/react-icons';
import { tokens } from '@fluentui/react-components';

const connectionDotStyle = (color: string) => ({ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, flexShrink: 0, marginRight: '4px' }) as const;
const splitBadgePrimaryStyle = { backgroundColor: tokens.colorBrandBackground, color: '#fff' } as const;
const splitBadgeSecondaryStyle = { backgroundColor: tokens.colorPaletteGreenBackground3, color: '#fff' } as const;

const renameInputStyle = {
    fontSize: '12px',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    outline: `1px solid ${tokens.colorBrandStroke1}`,
    borderRadius: '2px',
    padding: '0 2px',
    fontFamily: 'inherit',
    lineHeight: 'inherit',
    minWidth: '40px',
} as const;

export interface TabItemProps {
    tabId: string;
    title: string;
    isActive: boolean;
    isPrimary: boolean;
    isSecondary: boolean;
    isRenaming: boolean;
    renameValue: string;
    tabCount: number;
    idx: number;
    connectionColor: string;
    activeClassName: string;
    inactiveClassName: string;
    closeClassName: string;
    splitBadgeClassName: string;
    splitDirection: 'vertical' | 'horizontal';
    onSwitch: (tabId: string) => void;
    onStartRename: (tabId: string, title: string) => void;
    onContextMenu: (tabId: string, x: number, y: number) => void;
    onRenameChange: (value: string) => void;
    onCommitRename: () => void;
    onCancelRename: () => void;
    onClose: (tabId: string) => void;
    onDragStart: (idx: number, tabId: string) => void;
    onDragOverTab: (e: React.DragEvent, toIdx: number) => void;
    onDragDrop: (fromRef: React.MutableRefObject<number | null>, toIdx: number) => void;
    onDragEnd: () => void;
    dragTabRef: React.MutableRefObject<number | null>;
    splitEnabled: boolean;
}

export function TabItem({
    tabId, title, isActive, isPrimary, isSecondary, isRenaming, renameValue,
    tabCount, idx, connectionColor, activeClassName, inactiveClassName, closeClassName,
    splitBadgeClassName, splitDirection,
    onSwitch, onStartRename, onContextMenu, onRenameChange, onCommitRename, onCancelRename,
    onClose, onDragStart, onDragOverTab, onDragDrop, onDragEnd, dragTabRef, splitEnabled,
}: TabItemProps) {
    const handleClick = useCallback(() => onSwitch(tabId), [onSwitch, tabId]);
    const handleDoubleClick = useCallback(() => onStartRename(tabId, title), [onStartRename, tabId, title]);
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 1 && tabCount > 1) {
            e.preventDefault();
            onClose(tabId);
        }
    }, [onClose, tabId, tabCount]);
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        onContextMenu(tabId, e.clientX, e.clientY);
    }, [onContextMenu, tabId]);
    const handleDragStartEvt = useCallback((e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', tabId);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(idx, tabId);
    }, [onDragStart, idx, tabId]);
    const handleDragOver = useCallback((e: React.DragEvent) => {
        onDragOverTab(e, idx);
    }, [onDragOverTab, idx]);
    const handleDrop = useCallback(() => {
        onDragDrop(dragTabRef, idx);
    }, [onDragDrop, dragTabRef, idx]);
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onRenameChange(e.target.value), [onRenameChange]);
    const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onCommitRename();
        }
        if (e.key === 'Escape') {
            onCancelRename();
        }
    }, [onCommitRename, onCancelRename]);
    const handleInputClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
    const handleCloseClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onClose(tabId);
    }, [onClose, tabId]);
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            handleClick();
        }
    }, [handleClick]);
    const handleCloseKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            onClose(tabId);
        }
    }, [onClose, tabId]);

    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isRenaming]);

    return (
        <div
            className={isActive ? activeClassName : inactiveClassName}
            role="tab" aria-selected={isActive}
            data-context-menu
            draggable={!isRenaming}
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStartEvt}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={onDragEnd}>
            {isRenaming ? (
                <input
                    ref={inputRef}
                    value={renameValue}
                    size={Math.max(1, renameValue.length)}
                    onChange={handleInputChange}
                    onBlur={onCommitRename}
                    onKeyDown={handleInputKeyDown}
                    onClick={handleInputClick}
                    style={renameInputStyle}
                />
            ) : (
                <>
                    <span><span style={connectionDotStyle(connectionColor)} />{title}</span>
                    {isPrimary && splitEnabled && (
                        <span className={splitBadgeClassName} style={splitBadgePrimaryStyle}>
                            {splitDirection === 'vertical' ? 'L' : 'T'}
                        </span>
                    )}
                    {isSecondary && (
                        <span className={splitBadgeClassName} style={splitBadgeSecondaryStyle}>
                            {splitDirection === 'vertical' ? 'R' : 'B'}
                        </span>
                    )}
                </>
            )}
            {!isRenaming && tabCount > 1 && (
                <span className={`${closeClassName} tab-close`} role="menuitem" tabIndex={0} onClick={handleCloseClick} onKeyDown={handleCloseKeyDown}>
                    <DismissRegular fontSize={10} />
                </span>
            )}
        </div>
    );
}
