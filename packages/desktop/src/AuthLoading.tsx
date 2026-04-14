import { makeStyles, Spinner, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '16px',
        color: tokens.colorNeutralForeground2,
    },
});

export function AuthLoading() {
    const styles = useStyles();

    return (
        <div className={styles.container}>
            <Spinner size="large" label="Signing in…" />
        </div>
    );
}
