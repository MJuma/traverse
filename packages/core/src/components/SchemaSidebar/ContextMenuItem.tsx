import React, { useCallback } from 'react';

export interface ContextMenuItemProps {
    label: string;
    onClick: () => void;
    className: string;
}

export function ContextMenuItem({ label, onClick, className }: ContextMenuItemProps) {
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    }, [onClick]);

    return (
        <div className={className} role="menuitem" onClick={onClick} onKeyDown={handleKeyDown} tabIndex={0}>
            {label}
        </div>
    );
}
