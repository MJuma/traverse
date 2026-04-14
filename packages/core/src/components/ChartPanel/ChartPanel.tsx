import { useExplorerColors } from '../../context/ExplorerColorContext';
import { Dropdown, Option, Label } from '@fluentui/react-components';
import { useState, useMemo, useCallback } from 'react';

import { VegaChart } from '../VegaChart/VegaChart';
import { useStyles } from './ChartPanel.styles';
import { CHART_TYPES, autoDetect, buildSpec, applyVisualizationHints, buildTreemapVegaSpec } from './ChartPanel.logic';
import type { ChartType } from './ChartPanel.logic';
import type { KustoVisualization } from '../../services/kusto';

// --- Component ---

interface Props {
    columns: string[];
    rows: Record<string, unknown>[];
    isDark?: boolean;
    visualization?: KustoVisualization;
}

const dropdownStyleNarrow = { minWidth: '110px' } as const;
const dropdownStyleWide = { minWidth: '120px' } as const;
const marginLeftAutoStyle = { marginLeft: 'auto' } as const;

export function ChartPanel({ columns, rows, isDark = false, visualization }: Props) {
    const { chart } = useExplorerColors();
    const chartColors = useMemo(() => {
        const base = chart.palette.slice(0, 8);
        if (!isDark) {
            return base;
        }
        // Darken palette for dark mode to improve contrast with light text
        return base.map((hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const factor = 0.7;
            return `#${Math.round(r * factor).toString(16).padStart(2, '0')}${Math.round(g * factor).toString(16).padStart(2, '0')}${Math.round(b * factor).toString(16).padStart(2, '0')}`;
        });
    }, [chart.palette, isDark]);
    const styles = useStyles();

    // Limit data to 1000 rows for chart performance
    const chartRows = useMemo(() => rows.length > 1000 ? rows.slice(0, 1000) : rows, [rows]);
    const rowsLimited = rows.length > 1000;

    const detected = useMemo(() => {
        const fromViz = applyVisualizationHints(visualization, columns, chartRows);
        return fromViz ?? autoDetect(columns, chartRows);
    }, [columns, chartRows, visualization]);

    const [chartType, setChartType] = useState<ChartType>(detected.chartType);
    const [xField, setXField] = useState(detected.xField);
    const [yField, setYField] = useState(detected.yField);
    const [colorField, setColorField] = useState<string | null>(detected.colorField);

    // Reset when data or visualization changes
    const resetKey = useMemo(() => `${columns.join(',')}_${visualization?.type ?? ''}`, [columns, visualization]);
    const [lastResetKey, setLastResetKey] = useState(resetKey);
    if (resetKey !== lastResetKey) {
        setLastResetKey(resetKey);
        setChartType(detected.chartType);
        setXField(detected.xField);
        setYField(detected.yField);
        setColorField(detected.colorField);
    }

    const spec = useMemo(() =>
        buildSpec(chartType, xField, yField, colorField, columns, chartRows, chartColors),
    [chartType, xField, yField, colorField, columns, chartRows, chartColors]);

    const rawVegaSpec = useMemo(() => {
        if (chartType === 'treemap') {
            return buildTreemapVegaSpec(xField, yField, colorField, chartRows, chartColors, isDark);
        }
        return undefined;
    }, [chartType, xField, yField, colorField, chartRows, chartColors, isDark]);

    const data = useMemo(() => ({ values: chartRows }), [chartRows]);

    const handleChartType = useCallback((_: unknown, d: { optionValue?: string }) => {
        if (d.optionValue) {
            setChartType(d.optionValue as ChartType);
        }
    }, []);
    const handleX = useCallback((_: unknown, d: { optionValue?: string }) => {
        if (d.optionValue) {
            setXField(d.optionValue);
        }
    }, []);
    const handleY = useCallback((_: unknown, d: { optionValue?: string }) => {
        if (d.optionValue) {
            setYField(d.optionValue);
        }
    }, []);
    const handleColor = useCallback((_: unknown, d: { optionValue?: string }) => {
        if (d.optionValue) {
            setColorField(d.optionValue === '(none)' ? null : d.optionValue);
        }
    }, []);

    const selectedChartType = useMemo(() => [chartType], [chartType]);
    const selectedXField = useMemo(() => [xField], [xField]);
    const selectedYField = useMemo(() => [yField], [yField]);
    const selectedColorField = useMemo(() => [colorField ?? '(none)'], [colorField]);

    if (columns.length < 2) {
        return <div className={styles.empty}>Need at least 2 columns to chart</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.controls}>
                <div className={styles.field}>
                    <Label className={styles.fieldLabel}>Type</Label>
                    <Dropdown size="small" value={CHART_TYPES.find((t) => t.value === chartType)?.label ?? ''}
                        selectedOptions={selectedChartType} onOptionSelect={handleChartType} style={dropdownStyleNarrow}>
                        {CHART_TYPES.map((t) => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                    </Dropdown>
                </div>
                <div className={styles.field}>
                    <Label className={styles.fieldLabel}>X</Label>
                    <Dropdown size="small" value={xField} selectedOptions={selectedXField}
                        onOptionSelect={handleX} style={dropdownStyleWide}>
                        {columns.map((c) => <Option key={c} value={c}>{c}</Option>)}
                    </Dropdown>
                </div>
                <div className={styles.field}>
                    <Label className={styles.fieldLabel}>Y</Label>
                    <Dropdown size="small" value={yField} selectedOptions={selectedYField}
                        onOptionSelect={handleY} style={dropdownStyleWide}>
                        {columns.map((c) => <Option key={c} value={c}>{c}</Option>)}
                    </Dropdown>
                </div>
                <div className={styles.field}>
                    <Label className={styles.fieldLabel}>Color</Label>
                    <Dropdown size="small" value={colorField ?? '(none)'} selectedOptions={selectedColorField}
                        onOptionSelect={handleColor} style={dropdownStyleWide}>
                        <Option value="(none)">(none)</Option>
                        {columns.map((c) => <Option key={c} value={c}>{c}</Option>)}
                    </Dropdown>
                </div>
                {rowsLimited && (
                    <span className={styles.fieldLabel} style={marginLeftAutoStyle}>Showing first 1,000 of {rows.length.toLocaleString()} rows</span>
                )}
            </div>
            <div className={styles.chartArea}>
                <VegaChart spec={spec} data={data} isDark={isDark} rawVegaSpec={rawVegaSpec} />
            </div>
        </div>
    );
}
