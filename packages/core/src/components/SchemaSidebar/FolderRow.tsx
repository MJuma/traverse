import React, { useCallback } from 'react';
import {
    FolderRegular,
    FolderOpenRegular,
    ChevronRightRegular,
    ChevronDownRegular,
} from '@fluentui/react-icons';

export interface FolderRowProps {
    folder: string;
    folderKey?: string;
    isExpanded: boolean;
    toggleFolder: (folder: string) => void;
    className: string;
}

export function FolderRow({ folder, folderKey, isExpanded, toggleFolder, className }: FolderRowProps) {
    const key = folderKey ?? folder;
    const handleClick = useCallback(() => toggleFolder(key), [toggleFolder, key]);
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleFolder(key);
        }
    }, [toggleFolder, key]);

    return (
        <div className={className} role="treeitem" onClick={handleClick} onKeyDown={handleKeyDown} tabIndex={0}>
            {isExpanded
                ? <><ChevronDownRegular fontSize={12} /><FolderOpenRegular fontSize={14} /></>
                : <><ChevronRightRegular fontSize={12} /><FolderRegular fontSize={14} /></>}
            <span>{folder}</span>
        </div>
    );
}
