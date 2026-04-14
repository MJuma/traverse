import { Button, makeStyles, Title1, Body1, tokens } from '@fluentui/react-components';
import { ArrowClockwise24Regular, LockClosed24Regular } from '@fluentui/react-icons';

export interface AuthErrorProps {
    message: string;
    onRetry: () => void;
}

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '16px',
        padding: '32px',
        textAlign: 'center',
    },
    icon: {
        color: tokens.colorPaletteRedForeground1,
        fontSize: '48px',
    },
    message: {
        maxWidth: '480px',
        color: tokens.colorNeutralForeground2,
        wordBreak: 'break-word',
    },
});

const retryIcon = <ArrowClockwise24Regular />;

export function AuthError({ message, onRetry }: AuthErrorProps) {
    const styles = useStyles();

    return (
        <div className={styles.container}>
            <LockClosed24Regular className={styles.icon} />
            <Title1>Authentication Failed</Title1>
            <Body1 className={styles.message}>{message}</Body1>
            <Button appearance="primary" icon={retryIcon} onClick={onRetry}>
                Retry
            </Button>
        </div>
    );
}
