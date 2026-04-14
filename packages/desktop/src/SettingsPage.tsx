import { makeStyles, tokens, Title2, Button, TabList, Tab } from '@fluentui/react-components';
import { ArrowLeft24Regular } from '@fluentui/react-icons';
import { useState, useCallback } from 'react';

import { SettingsAuth } from './SettingsAuth';
import { SettingsTheme } from './SettingsTheme';
import { SettingsState } from './SettingsState';
import { SettingsUpdate } from './SettingsUpdate';
import type { ThemeMode } from './SettingsTheme';

export interface SettingsPageProps {
    themeMode: ThemeMode;
    presetId: string;
    customAccent: string;
    onThemeChange: (mode: ThemeMode) => void;
    onPresetChange: (presetId: string) => void;
    onCustomAccentChange: (color: string) => void;
    onClearAuth: () => void;
    onBack: () => void;
}

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '16px 24px 0',
        flexShrink: 0,
    },
    tabs: {
        padding: '0 24px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        flexShrink: 0,
    },
    content: {
        flex: 1,
        overflow: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '720px',
    },
});

const backIcon = <ArrowLeft24Regular />;

type SettingsTab = 'appearance' | 'account' | 'advanced';

export function SettingsPage({
    themeMode, presetId, customAccent,
    onThemeChange, onPresetChange, onCustomAccentChange,
    onClearAuth, onBack,
}: SettingsPageProps) {
    const styles = useStyles();
    const [tab, setTab] = useState<SettingsTab>('appearance');

    const handleTabSelect = useCallback(
        (_e: unknown, data: { value: unknown }) => setTab(data.value as SettingsTab),
        [],
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <Button
                    appearance="subtle"
                    icon={backIcon}
                    onClick={onBack}
                />
                <Title2>Settings</Title2>
            </div>
            <div className={styles.tabs}>
                <TabList selectedValue={tab} onTabSelect={handleTabSelect}>
                    <Tab value="appearance">Appearance</Tab>
                    <Tab value="account">Account</Tab>
                    <Tab value="advanced">Advanced</Tab>
                </TabList>
            </div>
            <div className={styles.content}>
                {tab === 'appearance' && (
                    <SettingsTheme
                        themeMode={themeMode}
                        presetId={presetId}
                        customAccent={customAccent}
                        onThemeChange={onThemeChange}
                        onPresetChange={onPresetChange}
                        onCustomAccentChange={onCustomAccentChange}
                    />
                )}
                {tab === 'account' && (
                    <SettingsAuth onClearAuth={onClearAuth} />
                )}
                {tab === 'advanced' && (
                    <>
                        <SettingsUpdate />
                        <SettingsState />
                    </>
                )}
            </div>
        </div>
    );
}
