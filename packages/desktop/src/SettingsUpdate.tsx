import { useState, useEffect, useCallback } from 'react';
import {
    Button,
    makeStyles,
    tokens,
    Subtitle2,
    Body1,
    Card,
    CardHeader,
    Badge,
    Spinner,
} from '@fluentui/react-components';
import { ArrowDownload24Regular, ArrowClockwise24Regular } from '@fluentui/react-icons';

import { checkForUpdate, installUpdate } from './updater';
import type { Update } from './updater';

type UpdateState =
    | { status: 'idle' }
    | { status: 'checking' }
    | { status: 'up-to-date' }
    | { status: 'available'; version: string; update: Update }
    | { status: 'downloading' }
    | { status: 'error'; message: string };

const useStyles = makeStyles({
    card: {
        width: '100%',
    },
    description: {
        color: tokens.colorNeutralForeground2,
        marginBottom: '12px',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
});

const header = <Subtitle2>Updates</Subtitle2>;
const checkIcon = <ArrowClockwise24Regular />;
const downloadIcon = <ArrowDownload24Regular />;

export function SettingsUpdate() {
    const styles = useStyles();
    const [state, setState] = useState<UpdateState>({ status: 'idle' });

    const handleCheck = useCallback(async () => {
        setState({ status: 'checking' });
        try {
            const update = await checkForUpdate();
            if (update) {
                setState({ status: 'available', version: update.version, update });
            } else {
                setState({ status: 'up-to-date' });
            }
        } catch (err) {
            setState({ status: 'error', message: String(err) });
        }
    }, []);

    const handleInstall = useCallback(async () => {
        if (state.status !== 'available') {
            return;
        }
        setState({ status: 'downloading' });
        try {
            await installUpdate(state.update);
        } catch (err) {
            setState({ status: 'error', message: String(err) });
        }
    }, [state]);

    useEffect(() => {
        void handleCheck();
    }, [handleCheck]);

    return (
        <Card className={styles.card}>
            <CardHeader header={header} />
            <Body1 className={styles.description}>
                Current version: 0.1.0
            </Body1>
            <div className={styles.row}>
                {state.status === 'idle' && (
                    <Button appearance="subtle" icon={checkIcon} onClick={handleCheck}>
                        Check for Updates
                    </Button>
                )}
                {state.status === 'checking' && (
                    <Spinner size="tiny" label="Checking for updates…" />
                )}
                {state.status === 'up-to-date' && (
                    <>
                        <Badge appearance="filled" color="success">Up to date</Badge>
                        <Button appearance="subtle" icon={checkIcon} onClick={handleCheck} size="small">
                            Check Again
                        </Button>
                    </>
                )}
                {state.status === 'available' && (
                    <>
                        <Badge appearance="filled" color="informative">v{state.version} available</Badge>
                        <Button appearance="primary" icon={downloadIcon} onClick={handleInstall}>
                            Download &amp; Install
                        </Button>
                    </>
                )}
                {state.status === 'downloading' && (
                    <Spinner size="tiny" label="Downloading update…" />
                )}
                {state.status === 'error' && (
                    <>
                        <Body1>Update check unavailable</Body1>
                        <Button appearance="subtle" icon={checkIcon} onClick={handleCheck} size="small">
                            Retry
                        </Button>
                    </>
                )}
            </div>
        </Card>
    );
}
