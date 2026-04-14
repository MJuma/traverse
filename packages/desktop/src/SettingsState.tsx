import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Button,
    makeStyles,
    tokens,
    Subtitle2,
    Body1,
    Card,
    CardHeader,
    Table,
    TableHeader,
    TableHeaderCell,
    TableBody,
    TableRow,
    TableCell,
} from '@fluentui/react-components';
import { Delete24Regular, ArrowClockwise24Regular } from '@fluentui/react-icons';

import { stateService, STORE_NAMES } from '@mhjuma/traverse';
import type { StoreName, StoreStats } from '@mhjuma/traverse';

const useStyles = makeStyles({
    card: {
        width: '100%',
        overflowX: 'auto' as const,
    },
    description: {
        color: tokens.colorNeutralForeground2,
        marginBottom: '12px',
    },
    actions: {
        display: 'flex',
        gap: '8px',
        marginTop: '12px',
    },
    mono: {
        fontFamily: 'monospace',
        fontSize: tokens.fontSizeBase200,
    },
    table: {
        minWidth: '500px',
    },
    colStore: { width: '160px' },
    colEntries: { width: '70px' },
    colSize: { width: '80px' },
    colOldest: { width: '160px' },
    colAction: { width: '80px' },
});

function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(ts: number | null): string {
    if (!ts) {
        return '—';
    }
    return new Date(ts).toLocaleString();
}

const header = <Subtitle2>App State</Subtitle2>;
const refreshIcon = <ArrowClockwise24Regular />;
const deleteIcon = <Delete24Regular />;

function ClearButton({ name, disabled, onClear }: { name: StoreName; disabled: boolean; onClear: (name: StoreName) => void }) {
    const handleClick = useCallback(() => onClear(name), [name, onClear]);
    return (
        <Button
            appearance="subtle"
            icon={deleteIcon}
            size="small"
            disabled={disabled}
            onClick={handleClick}
        >
            Clear
        </Button>
    );
}

export function SettingsState() {
    const styles = useStyles();
    const [stats, setStats] = useState<StoreStats | null>(null);

    const refresh = useCallback(() => {
        setStats(stateService.stats());
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const handleClear = useCallback((store: StoreName) => {
        stateService.clear(store);
        refresh();
    }, [refresh]);

    const refreshAction = useMemo(() => (
        <Button
            appearance="subtle"
            icon={refreshIcon}
            onClick={refresh}
            size="small"
        >
            Refresh
        </Button>
    ), [refresh]);

    return (
        <Card className={styles.card}>
            <CardHeader
                header={header}
                action={refreshAction}
            />
            <Body1 className={styles.description}>
                Inspect and manage cached data. Clearing a store removes all its entries.
            </Body1>
            {stats && (
                <Table size="small" className={styles.table}>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell className={styles.colStore}>Store</TableHeaderCell>
                            <TableHeaderCell className={styles.colEntries}>Entries</TableHeaderCell>
                            <TableHeaderCell className={styles.colSize}>Size</TableHeaderCell>
                            <TableHeaderCell className={styles.colOldest}>Oldest Entry</TableHeaderCell>
                            <TableHeaderCell className={styles.colAction} />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {STORE_NAMES.map((name) => {
                            const store = stats.stores[name];
                            return (
                                <TableRow key={name}>
                                    <TableCell className={styles.mono}>{name}</TableCell>
                                    <TableCell>{store.entries}</TableCell>
                                    <TableCell>{formatBytes(store.totalSize)}</TableCell>
                                    <TableCell>{formatTimestamp(store.oldestTimestamp)}</TableCell>
                                    <TableCell>
                                        <ClearButton name={name} disabled={store.entries === 0} onClear={handleClear} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
        </Card>
    );
}
