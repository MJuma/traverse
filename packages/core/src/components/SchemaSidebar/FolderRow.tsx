import React, { useCallback } from 'react';
import {
    FolderRegular,
    FolderOpenRegular,
    ChevronRightRegular,
    ChevronDownRegular,
} from '@fluentui/react-icons';

export interface FolderRowProps {
    folder: string;
    isExpanded: boolean;
    toggleFolder: (folder: string) => void;
    className: string;
}

export function FolderRow({ folder, isExpanded, toggleFolder, className }: FolderRowProps) {
    const handleClick = useCallback(() => toggleFolder(folder), [toggleFolder, folder]);
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleFolder(folder);
        }
    }, [toggleFolder, folder]);

    return (
        <div className={className} role="treeitem" onClick={handleClick} onKeyDown={handleKeyDown} tabIndex={0}>
            {isExpanded
                ? <><ChevronDownRegular fontSize={12} /><FolderOpenRegular fontSize={14} /></>
                : <><ChevronRightRegular fontSize={12} /><FolderRegular fontSize={14} /></>}
            <span>{folder}</span>
        </div>
    );
}
