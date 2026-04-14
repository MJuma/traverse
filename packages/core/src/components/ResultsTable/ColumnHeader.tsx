import { ArrowSortUpRegular, ArrowSortDownRegular } from '@fluentui/react-icons';
import { useCallback, useMemo } from 'react';

import { shortType } from './ResultsTable.logic';
import type { SortDir } from './ResultsTable.logic';
import { useStyles } from './ResultsTable.styles';

type Styles = ReturnType<typeof useStyles>;

const typeAnnotationStyle = { fontWeight: 'normal', opacity: 0.5, fontSize: '10px' };

export interface ColumnHeaderProps {
    col: string;
    colIdx: number;
    width: number;
    colType: string | undefined;
    sortColumn: string | null;
    sortDir: SortDir;
    toggleSort: (col: string) => void;
    handleHeaderColClick: (colIdx: number) => void;
    styles: Styles;
}

export function ColumnHeader({ col, colIdx, width, colType, sortColumn, sortDir, toggleSort, handleHeaderColClick, styles }: ColumnHeaderProps) {
    const handleClick = useCallback(() => toggleSort(col), [toggleSort, col]);
    const handleDoubleClick = useCallback(() => handleHeaderColClick(colIdx), [handleHeaderColClick, colIdx]);
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(col); }
    }, [toggleSort, col]);
    const style = useMemo(() => ({ width }), [width]);
    return (
        <button type="button" className={styles.th} style={style} onClick={handleClick} onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}>
            <span className={styles.thLabel}>
                <span className={styles.thName}>{col}</span>
                {colType && <span style={typeAnnotationStyle}>{shortType(colType)}</span>}
            </span>
            {sortColumn === col && sortDir === 'asc' && <ArrowSortUpRegular className={styles.sortIcon} />}
            {sortColumn === col && sortDir === 'desc' && <ArrowSortDownRegular className={styles.sortIcon} />}
        </button>
    );
}
