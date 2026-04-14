import { Input } from '@fluentui/react-components';
import { useCallback, useMemo } from 'react';

import { useStyles } from './ResultsTable.styles';

type Styles = ReturnType<typeof useStyles>;

export interface FilterCellProps {
    col: string;
    width: number;
    value: string;
    setFilter: (col: string, value: string) => void;
    styles: Styles;
}

export function FilterCell({ col, width, value, setFilter, styles }: FilterCellProps) {
    const handleChange = useCallback((_: unknown, d: { value: string }) => setFilter(col, d.value), [setFilter, col]);
    const style = useMemo(() => ({ width }), [width]);
    return (
        <div className={styles.filterCell} style={style}>
            <Input className={styles.filterInput} size="small" placeholder="filter..." value={value} onChange={handleChange} />
        </div>
    );
}
