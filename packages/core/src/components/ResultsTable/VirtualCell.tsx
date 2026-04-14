import React, { useCallback, useMemo } from 'react';

import { formatCellDisplayValue } from './ResultsTable.logic';
import { useStyles } from './ResultsTable.styles';

type Styles = ReturnType<typeof useStyles>;

export interface VirtualCellProps {
    col: string;
    colIdx: number;
    rowIdx: number;
    row: Record<string, unknown>;
    width: number;
    selected: boolean;
    styles: Styles;
    handleCellMouseDown: (rowIdx: number, colIdx: number, e: React.MouseEvent) => void;
    handleCellMouseEnter: (rowIdx: number, colIdx: number) => void;
}

export function VirtualCell({ col, colIdx, rowIdx, row, width, selected, styles, handleCellMouseDown, handleCellMouseEnter }: VirtualCellProps) {
    const val = row[col];
    const display = formatCellDisplayValue(val);
    const style = useMemo(() => ({ width }), [width]);
    const onMouseDown = useCallback((e: React.MouseEvent) => handleCellMouseDown(rowIdx, colIdx, e), [handleCellMouseDown, rowIdx, colIdx]);
    const onMouseEnter = useCallback(() => handleCellMouseEnter(rowIdx, colIdx), [handleCellMouseEnter, rowIdx, colIdx]);
    return (
        <div className={selected ? styles.tdSelected : styles.td} role="gridcell" style={style} title={display}
            onMouseDown={onMouseDown} onMouseEnter={onMouseEnter}>
            {display}
        </div>
    );
}
