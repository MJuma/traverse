import { useCallback, useMemo } from 'react';
import {
    makeStyles,
    tokens,
    Subtitle2,
    Body1,
    Card,
    CardHeader,
    RadioGroup,
    Radio,
    Label,
    Input,
} from '@fluentui/react-components';

import { THEME_PRESETS } from './themes';
import type { ThemePreset } from './themes';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface SettingsThemeProps {
    themeMode: ThemeMode;
    presetId: string;
    customAccent: string;
    onThemeChange: (mode: ThemeMode) => void;
    onPresetChange: (presetId: string) => void;
    onCustomAccentChange: (color: string) => void;
}

const useStyles = makeStyles({
    card: {
        width: '100%',
    },
    description: {
        color: tokens.colorNeutralForeground2,
        marginBottom: '12px',
    },
    section: {
        marginTop: '16px',
    },
    presetGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginTop: '8px',
    },
    presetButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '6px',
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        cursor: 'pointer',
        backgroundColor: tokens.colorNeutralBackground1,
        color: tokens.colorNeutralForeground1,
        '&:hover': {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        },
    },
    presetButtonSelected: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '6px',
        border: `2px solid ${tokens.colorBrandForeground1}`,
        cursor: 'pointer',
        backgroundColor: tokens.colorNeutralBackground1,
        color: tokens.colorNeutralForeground1,
    },
    swatch: {
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        flexShrink: 0,
    },
    customRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginTop: '8px',
    },
    colorInput: {
        width: '40px',
        height: '32px',
        padding: '2px',
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: '4px',
        cursor: 'pointer',
    },
});

const header = <Subtitle2>Appearance</Subtitle2>;
const inputStyle = { width: '100px' } as const;

function PresetButton({ preset, selected, onSelect }: { preset: ThemePreset; selected: boolean; onSelect: (id: string) => void }) {
    const styles = useStyles();
    const handleClick = useCallback(() => onSelect(preset.id), [preset.id, onSelect]);
    const swatchStyle = useMemo(() => ({ backgroundColor: preset.brand[80] }), [preset.brand]);
    return (
        <button
            type="button"
            className={selected ? styles.presetButtonSelected : styles.presetButton}
            onClick={handleClick}
        >
            <span className={styles.swatch} style={swatchStyle} />
            {preset.name}
        </button>
    );
}

function CustomButton({ accent, selected, onSelect }: { accent: string; selected: boolean; onSelect: (id: string) => void }) {
    const styles = useStyles();
    const handleClick = useCallback(() => onSelect('custom'), [onSelect]);
    const swatchStyle = useMemo(() => ({ backgroundColor: accent }), [accent]);
    return (
        <button
            type="button"
            className={selected ? styles.presetButtonSelected : styles.presetButton}
            onClick={handleClick}
        >
            <span className={styles.swatch} style={swatchStyle} />
            Custom
        </button>
    );
}

export function SettingsTheme({
    themeMode, presetId, customAccent,
    onThemeChange, onPresetChange, onCustomAccentChange,
}: SettingsThemeProps) {
    const styles = useStyles();

    const handleModeChange = useCallback(
        (_e: unknown, data: { value: string }) => onThemeChange(data.value as ThemeMode),
        [onThemeChange],
    );

    const handleAccentInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => onCustomAccentChange(e.target.value),
        [onCustomAccentChange],
    );

    const handleAccentText = useCallback(
        (_e: unknown, data: { value: string }) => onCustomAccentChange(data.value),
        [onCustomAccentChange],
    );

    const isCustom = presetId === 'custom';

    return (
        <Card className={styles.card}>
            <CardHeader header={header} />
            <Body1 className={styles.description}>
                Choose how Traverse looks. System follows your OS preference.
            </Body1>

            <Label htmlFor="theme-selector">Mode</Label>
            <RadioGroup
                id="theme-selector"
                value={themeMode}
                onChange={handleModeChange}
            >
                <Radio value="system" label="System" />
                <Radio value="light" label="Light" />
                <Radio value="dark" label="Dark" />
            </RadioGroup>

            <div className={styles.section}>
                <Label>Color Theme</Label>
                <div className={styles.presetGrid}>
                    {THEME_PRESETS.map((preset) => (
                        <PresetButton
                            key={preset.id}
                            preset={preset}
                            selected={presetId === preset.id}
                            onSelect={onPresetChange}
                        />
                    ))}
                    <CustomButton accent={customAccent} selected={isCustom} onSelect={onPresetChange} />
                </div>
            </div>

            {isCustom && (
                <div className={styles.customRow}>
                    <Label htmlFor="accent-color">Accent Color</Label>
                    <input
                        id="accent-color"
                        type="color"
                        value={customAccent}
                        onChange={handleAccentInput}
                        className={styles.colorInput}
                    />
                    <Input
                        value={customAccent}
                        onChange={handleAccentText}
                        style={inputStyle}
                        size="small"
                    />
                </div>
            )}
        </Card>
    );
}
