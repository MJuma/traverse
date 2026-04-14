import {
    Button,
    makeStyles,
    tokens,
    Subtitle2,
    Body1,
    Card,
    CardHeader,
} from '@fluentui/react-components';
import { SignOut24Regular } from '@fluentui/react-icons';

export interface SettingsAuthProps {
    onClearAuth: () => void;
}

const useStyles = makeStyles({
    card: {
        width: '100%',
    },
    description: {
        color: tokens.colorNeutralForeground2,
        marginBottom: '12px',
    },
    actions: {
        display: 'flex',
        gap: '8px',
    },
});

const signOutIcon = <SignOut24Regular />;
const header = <Subtitle2>Authentication</Subtitle2>;

export function SettingsAuth({ onClearAuth }: SettingsAuthProps) {
    const styles = useStyles();

    return (
        <Card className={styles.card}>
            <CardHeader header={header} />
            <Body1 className={styles.description}>
                Clear stored authentication tokens to sign out or resolve auth issues.
                You will need to sign in again after clearing.
            </Body1>
            <div className={styles.actions}>
                <Button
                    appearance="primary"
                    icon={signOutIcon}
                    onClick={onClearAuth}
                >
                    Clear Auth &amp; Sign Out
                </Button>
            </div>
        </Card>
    );
}
