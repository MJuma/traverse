import { Checkbox } from '@fluentui/react-components';
import { useCallback } from 'react';

export interface ColumnPickerItemProps {
    col: string;
    isEmpty: boolean;
    isHidden: boolean;
    toggleColumn: (col: string) => void;
}

export function ColumnPickerItem({ col, isEmpty, isHidden, toggleColumn }: ColumnPickerItemProps) {
    const handleChange = useCallback(() => toggleColumn(col), [toggleColumn, col]);
    return (
        <Checkbox label={col + (isEmpty ? ' (empty)' : '')} checked={!isHidden} onChange={handleChange} />
    );
}
