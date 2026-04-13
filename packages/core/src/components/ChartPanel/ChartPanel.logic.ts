import type { VisualizationSpec } from '../VegaChart/VegaChart';

export type ChartType = 'bar' | 'line' | 'area' | 'donut' | 'grouped-bar' | 'scatter';

export const CHART_TYPES: { value: ChartType; label: string }[] = [
    { value: 'bar', label: 'Bar' },
    { value: 'line', label: 'Line' },
    { value: 'area', label: 'Stacked Area' },
    { value: 'donut', label: 'Donut' },
    { value: 'grouped-bar', label: 'Grouped Bar' },
    { value: 'scatter', label: 'Scatter' },
];

export interface DetectedConfig {
    chartType: ChartType;
    xField: string;
    yField: string;
    colorField: string | null;
}

export function classifyColumns(columns: string[], rows: Record<string, unknown>[]): { strings: string[]; numbers: string[]; datetimes: string[] } {
    const strings: string[] = [];
    const numbers: string[] = [];
    const datetimes: string[] = [];

    for (const col of columns) {
        const samples = rows.slice(0, 20).map((r) => r[col]).filter((v) => v !== null && v !== undefined && v !== '');
        if (samples.length === 0) { strings.push(col); continue; }

        const allNumeric = samples.every((v) => !isNaN(Number(v)));
        if (allNumeric) { numbers.push(col); continue; }

        const allDatetime = samples.every((v) => {
            const s = String(v);
            return s.match(/^\d{4}-\d{2}-\d{2}/) && !isNaN(new Date(s).getTime());
        });
        if (allDatetime) { datetimes.push(col); continue; }

        strings.push(col);
    }

    return { strings, numbers, datetimes };
}

export function autoDetect(columns: string[], rows: Record<string, unknown>[]): DetectedConfig {
    const { strings, numbers, datetimes } = classifyColumns(columns, rows);

    if (datetimes.length >= 1 && numbers.length >= 1 && strings.length >= 1) {
        return { chartType: 'line', xField: datetimes[0], yField: numbers[0], colorField: strings[0] };
    }
    if (datetimes.length >= 1 && numbers.length >= 1) {
        return { chartType: 'line', xField: datetimes[0], yField: numbers[0], colorField: null };
    }
    if (strings.length >= 1 && numbers.length >= 1) {
        return { chartType: 'bar', xField: strings[0], yField: numbers[0], colorField: null };
    }
    if (numbers.length >= 2) {
        return { chartType: 'scatter', xField: numbers[0], yField: numbers[1], colorField: strings[0] ?? null };
    }
    if (strings.length >= 2 && numbers.length >= 1) {
        return { chartType: 'donut', xField: strings[0], yField: numbers[0], colorField: strings[1] };
    }
    return { chartType: 'bar', xField: columns[0] ?? '', yField: columns[1] ?? '', colorField: null };
}

export function buildSpec(chartType: ChartType, xField: string, yField: string, colorField: string | null, columns: string[], rows: Record<string, unknown>[], chartColors: string[]): VisualizationSpec {
    const { datetimes } = classifyColumns(columns, rows);
    const xIsTime = datetimes.includes(xField);
    const xType = xIsTime ? 'temporal' : 'nominal';

    switch (chartType) {
        case 'bar':
            return {
                mark: { type: 'bar', cornerRadiusEnd: 3 },
                encoding: {
                    y: { field: xField, type: 'nominal', sort: '-x', axis: { labelLimit: 200 } },
                    x: { field: yField, type: 'quantitative' },
                    ...(colorField ? { color: { field: colorField, type: 'nominal', scale: { range: chartColors } } } : { color: { value: chartColors[0] } }),
                },
            } as VisualizationSpec;
        case 'line':
            return {
                mark: { type: 'line', point: { filled: true, size: 30 } },
                encoding: {
                    x: { field: xField, type: xType },
                    y: { field: yField, type: 'quantitative' },
                    ...(colorField ? { color: { field: colorField, type: 'nominal', scale: { range: chartColors } } } : { color: { value: chartColors[0] } }),
                },
            } as VisualizationSpec;
        case 'area':
            return {
                mark: { type: 'area', line: true, point: false, opacity: 0.6 },
                encoding: {
                    x: { field: xField, type: xType },
                    y: { field: yField, type: 'quantitative', stack: 'zero' },
                    ...(colorField ? { color: { field: colorField, type: 'nominal', scale: { range: chartColors } } } : { color: { value: chartColors[0] } }),
                },
            } as VisualizationSpec;
        case 'donut':
            return {
                mark: { type: 'arc', innerRadius: 50 },
                encoding: {
                    theta: { field: yField, type: 'quantitative', stack: true },
                    color: { field: xField, type: 'nominal', scale: { range: chartColors } },
                },
            } as VisualizationSpec;
        case 'grouped-bar':
            return {
                mark: { type: 'bar', cornerRadiusEnd: 3 },
                encoding: {
                    x: { field: xField, type: 'nominal' },
                    y: { field: yField, type: 'quantitative' },
                    ...(colorField ? {
                        xOffset: { field: colorField, type: 'nominal' },
                        color: { field: colorField, type: 'nominal', scale: { range: chartColors } },
                    } : { color: { value: chartColors[0] } }),
                },
            } as VisualizationSpec;
        case 'scatter':
            return {
                mark: { type: 'circle', opacity: 0.7 },
                encoding: {
                    x: { field: xField, type: 'quantitative' },
                    y: { field: yField, type: 'quantitative' },
                    ...(colorField ? { color: { field: colorField, type: 'nominal', scale: { range: chartColors } } } : { color: { value: chartColors[0] } }),
                    size: { value: 60 },
                },
            } as VisualizationSpec;
        default:
            return { mark: 'bar' } as VisualizationSpec;
    }
}
