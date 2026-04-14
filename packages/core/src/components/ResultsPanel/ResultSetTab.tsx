import { useCallback } from 'react';

export interface ResultSetTabProps {
    index: number;
    isActive: boolean;
    activeClassName: string;
    inactiveClassName: string;
    onSelect: (i: number) => void;
}

export function ResultSetTab({ index, isActive, activeClassName, inactiveClassName, onSelect }: ResultSetTabProps) {
    const handleClick = useCallback(() => onSelect(index), [onSelect, index]);
    return (
        <button type="button" className={isActive ? activeClassName : inactiveClassName} onClick={handleClick}>
            Table {index + 1}
        </button>
    );
}
