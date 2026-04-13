import { ChevronRightRegular } from '@fluentui/react-icons';
import React, { useCallback, useMemo } from 'react';

import { isCellInRange } from './ResultsTable.logic';
import type { CellRange } from './ResultsTable.logic';
import { useStyles } from './ResultsTable.styles';
import { VirtualCell } from './VirtualCell';

type Styles = ReturnType<typeof useStyles>;

const ROW_HEIGHT = 28;
const chevronCollapsedStyle = { transition: 'transform 0.15s' };
const chevronExpandedStyle = { transform: 'rotate(90deg)', transition: 'transform 0.15s' };

export interface VirtualRowProps {
    vRow: { index: number; start: number; key: string | number | bigint };
    row: Record<string, unknown>;
    isDetailOpen: boolean;
    exprMatch: boolean;
    visibleColumns: string[];
    columnWidths: Record<string, number>;
    selection: CellRange | null;
    totalWidth: number;
    styles: Styles;
    setDetailRowIdx: React.Dispatch<React.SetStateAction<number | null>>;
    handleCellMouseDown: (rowIdx: number, colIdx: number, e: React.MouseEvent) => void;
    handleCellMouseEnter: (rowIdx: number, colIdx: number) => void;
}

export function VirtualRow({ vRow, row, isDetailOpen, exprMatch, visibleColumns, columnWidths, selection, totalWidth, styles, setDetailRowIdx, handleCellMouseDown, handleCellMouseEnter }: VirtualRowProps) {
    const rowIdx = vRow.index;
    const rowClass = isDetailOpen ? styles.trDetailOpen : exprMatch ? styles.trExprHighlight : styles.tr;
    const rowStyle = useMemo(() => ({
        position: 'absolute' as const, top: 0, left: 0, width: totalWidth,
        height: ROW_HEIGHT, transform: `translateY(${vRow.start}px)`,
    }), [totalWidth, vRow.start]);
    const handleExpandClick = useCallback(() => {
        setDetailRowIdx(isDetailOpen ? null : rowIdx);
    }, [setDetailRowIdx, isDetailOpen, rowIdx]);
    const handleExpandKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleExpandClick(); }
    }, [handleExpandClick]);
    return (
        <div className={rowClass} style={rowStyle}>
            <button type="button" className={styles.expandBtn} onClick={handleExpandClick} onKeyDown={handleExpandKeyDown}>
                <ChevronRightRegular fontSize={12} style={isDetailOpen ? chevronExpandedStyle : chevronCollapsedStyle} />
            </button>
            {visibleColumns.map((col, colIdx) => (
                <VirtualCell key={col} col={col} colIdx={colIdx} rowIdx={rowIdx} row={row}
                    width={columnWidths[col]} selected={selection ? isCellInRange(rowIdx, colIdx, selection) : false}
                    styles={styles} handleCellMouseDown={handleCellMouseDown} handleCellMouseEnter={handleCellMouseEnter} />
            ))}
        </div>
    );
}
