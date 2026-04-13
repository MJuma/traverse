import { useCallback, useEffect, useMemo, useRef } from 'react';
import { DismissRegular } from '@fluentui/react-icons';
import { tokens } from '@fluentui/react-components';

const connectionDotStyle = (color: string) => ({ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, flexShrink: 0, marginRight: '4px' }) as const;

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
    onSwitch: (tabId: string) => void;
    onStartRename: (tabId: string, title: string) => void;
    onContextMenu: (tabId: string, x: number, y: number) => void;
    onRenameChange: (value: string) => void;
    onCommitRename: () => void;
    onCancelRename: () => void;
    onClose: (tabId: string) => void;
    onDragStart: (idx: number, tabId: string) => void;
    onDragDrop: (fromRef: React.MutableRefObject<number | null>, toIdx: number) => void;
    onDragEnd: () => void;
    dragTabRef: React.MutableRefObject<number | null>;
    splitEnabled: boolean;
}

export function TabItem({
    tabId, title, isActive, isPrimary, isSecondary, isRenaming, renameValue,
    tabCount, idx, connectionColor, activeClassName, inactiveClassName, closeClassName,
    onSwitch, onStartRename, onContextMenu, onRenameChange, onCommitRename, onCancelRename,
    onClose, onDragStart, onDragDrop, onDragEnd, dragTabRef, splitEnabled,
}: TabItemProps) {
    const handleClick = useCallback(() => onSwitch(tabId), [onSwitch, tabId]);
    const handleDoubleClick = useCallback(() => onStartRename(tabId, title), [onStartRename, tabId, title]);
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        onContextMenu(tabId, e.clientX, e.clientY);
    }, [onContextMenu, tabId]);
    const handleDragStartEvt = useCallback(() => onDragStart(idx, tabId), [onDragStart, idx, tabId]);
    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);
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
        }
    }, [isRenaming]);

    const inputStyle = useMemo(() => ({
        width: Math.max(40, renameValue.length * 7) + 'px',
        fontSize: '11px', border: 'none', background: 'transparent', color: 'inherit',
        outline: `1px solid ${tokens.colorBrandStroke1}`, padding: '0 2px',
    }), [renameValue.length]);

    return (
        <div
            className={isActive ? activeClassName : inactiveClassName}
            role="tab" aria-selected={isActive}
            draggable={!isRenaming}
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
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
                    onChange={handleInputChange}
                    onBlur={onCommitRename}
                    onKeyDown={handleInputKeyDown}
                    onClick={handleInputClick}
                    style={inputStyle}
                />
            ) : (
                <span><span style={connectionDotStyle(connectionColor)} />{title}{isPrimary && splitEnabled ? ' \u2460' : ''}{isSecondary ? ' \u2461' : ''}</span>
            )}
            {!isRenaming && tabCount > 1 && (
                <span className={closeClassName} role="menuitem" tabIndex={0} onClick={handleCloseClick} onKeyDown={handleCloseKeyDown}>
                    <DismissRegular fontSize={10} />
                </span>
            )}
        </div>
    );
}
