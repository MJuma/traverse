import { createDarkTheme, createLightTheme } from '@fluentui/react-components';
import type { BrandVariants, Theme } from '@fluentui/react-components';

import type { ExplorerColorConfig } from '@mhjuma/traverse';

export interface ThemePreset {
    id: string;
    name: string;
    brand: BrandVariants;
    colors: ExplorerColorConfig;
}

const DEFAULT_COLORS: ExplorerColorConfig = {
    semantic: {
        backdrop: 'rgba(0, 0, 0, 0.4)',
        functionBadge: '#4caf50',
        highlightHoverBg: 'rgba(255, 200, 0, 0.2)',
        lookupBadge: '#e8912d',
        materializedViewBadge: '#9c6ade',
        scrollThumb: 'rgba(128, 128, 128, 0.4)',
        scrollThumbHover: 'rgba(128, 128, 128, 0.6)',
        selectionBg: 'rgba(0, 120, 212, 0.15)',
        selectionSubtle: 'rgba(0, 120, 212, 0.06)',
        shadowLight: 'rgba(0, 0, 0, 0.15)',
        shadowMedium: 'rgba(0, 0, 0, 0.3)',
    },
    chart: {
        palette: ['#6a8799', '#909d63', '#ebc17a', '#bc5653', '#b06698', '#c9dfff', '#7eaac7', '#acbbd0', '#636363', '#d9d9d9'],
    },
};

// Default Fluent blue brand
const fluentBrand: BrandVariants = {
    10: '#020305',
    20: '#111723',
    30: '#16263D',
    40: '#193253',
    50: '#1B3F6A',
    60: '#1B4C82',
    70: '#18599B',
    80: '#1267B4',
    90: '#3174C2',
    100: '#4F82C8',
    110: '#6790CF',
    120: '#7D9ED5',
    130: '#92ACDC',
    140: '#A6BAE2',
    150: '#BAC9E9',
    160: '#CDD8EF',
};

const nordBrand: BrandVariants = {
    10: '#0B1017',
    20: '#141D2B',
    30: '#1A2940',
    40: '#1F3554',
    50: '#244168',
    60: '#2E5076',
    70: '#3B6087',
    80: '#5E81AC',
    90: '#6E8DB6',
    100: '#7E99BF',
    110: '#8EA5C9',
    120: '#9EB1D2',
    130: '#AEBDDB',
    140: '#BEC9E4',
    150: '#CED5ED',
    160: '#DEE2F6',
};

const draculaBrand: BrandVariants = {
    10: '#0D0B14',
    20: '#1A1525',
    30: '#261F38',
    40: '#33294B',
    50: '#40335F',
    60: '#4D3D73',
    70: '#5B4887',
    80: '#BD93F9',
    90: '#C49EFA',
    100: '#CBA9FB',
    110: '#D2B4FC',
    120: '#D9BFFD',
    130: '#E0CAFE',
    140: '#E7D5FE',
    150: '#EEE0FF',
    160: '#F5EBFF',
};

const solarizedBrand: BrandVariants = {
    10: '#00141A',
    20: '#002B36',
    30: '#073642',
    40: '#0A4050',
    50: '#104A5E',
    60: '#18556C',
    70: '#22607A',
    80: '#268BD2',
    90: '#3D96D7',
    100: '#54A1DC',
    110: '#6BABE1',
    120: '#82B6E6',
    130: '#99C1EB',
    140: '#B0CCF0',
    150: '#C7D7F5',
    160: '#DEE2FA',
};

const rosePineBrand: BrandVariants = {
    10: '#100E17',
    20: '#1F1D2E',
    30: '#26233A',
    40: '#302D45',
    50: '#3A3750',
    60: '#44415B',
    70: '#524F67',
    80: '#C4A7E7',
    90: '#CAB0EA',
    100: '#D0B9ED',
    110: '#D6C2F0',
    120: '#DCCBF3',
    130: '#E2D4F6',
    140: '#E8DDF9',
    150: '#EEE6FC',
    160: '#F4EFFF',
};

const nordColors: ExplorerColorConfig = {
    semantic: {
        ...DEFAULT_COLORS.semantic,
        functionBadge: '#A3BE8C',
        lookupBadge: '#D08770',
        materializedViewBadge: '#B48EAD',
        selectionBg: 'rgba(94, 129, 172, 0.15)',
        selectionSubtle: 'rgba(94, 129, 172, 0.06)',
    },
    chart: {
        palette: ['#5E81AC', '#A3BE8C', '#EBCB8B', '#BF616A', '#B48EAD', '#88C0D0', '#81A1C1', '#8FBCBB', '#D8DEE9', '#4C566A'],
    },
};

const draculaColors: ExplorerColorConfig = {
    semantic: {
        ...DEFAULT_COLORS.semantic,
        functionBadge: '#50FA7B',
        lookupBadge: '#FFB86C',
        materializedViewBadge: '#BD93F9',
        selectionBg: 'rgba(189, 147, 249, 0.15)',
        selectionSubtle: 'rgba(189, 147, 249, 0.06)',
    },
    chart: {
        palette: ['#BD93F9', '#50FA7B', '#F1FA8C', '#FF5555', '#FF79C6', '#8BE9FD', '#6272A4', '#FFB86C', '#F8F8F2', '#44475A'],
    },
};

const solarizedColors: ExplorerColorConfig = {
    semantic: {
        ...DEFAULT_COLORS.semantic,
        functionBadge: '#859900',
        lookupBadge: '#CB4B16',
        materializedViewBadge: '#6C71C4',
        selectionBg: 'rgba(38, 139, 210, 0.15)',
        selectionSubtle: 'rgba(38, 139, 210, 0.06)',
    },
    chart: {
        palette: ['#268BD2', '#859900', '#B58900', '#DC322F', '#D33682', '#2AA198', '#6C71C4', '#CB4B16', '#93A1A1', '#586E75'],
    },
};

const rosePineColors: ExplorerColorConfig = {
    semantic: {
        ...DEFAULT_COLORS.semantic,
        functionBadge: '#9CCFD8',
        lookupBadge: '#F6C177',
        materializedViewBadge: '#C4A7E7',
        selectionBg: 'rgba(196, 167, 231, 0.15)',
        selectionSubtle: 'rgba(196, 167, 231, 0.06)',
    },
    chart: {
        palette: ['#C4A7E7', '#9CCFD8', '#F6C177', '#EB6F92', '#EBBCBA', '#31748F', '#E0DEF4', '#908CAA', '#6E6A86', '#524F67'],
    },
};

export const THEME_PRESETS: ThemePreset[] = [
    { id: 'default', name: 'Default', brand: fluentBrand, colors: DEFAULT_COLORS },
    { id: 'nord', name: 'Nord', brand: nordBrand, colors: nordColors },
    { id: 'dracula', name: 'Dracula', brand: draculaBrand, colors: draculaColors },
    { id: 'solarized', name: 'Solarized', brand: solarizedBrand, colors: solarizedColors },
    { id: 'rose-pine', name: 'Rosé Pine', brand: rosePineBrand, colors: rosePineColors },
];

export function buildThemes(brand: BrandVariants): { light: Theme; dark: Theme } {
    return {
        light: createLightTheme(brand),
        dark: createDarkTheme(brand),
    };
}

export function getPreset(id: string): ThemePreset {
    return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}
