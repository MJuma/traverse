import type { VisualizationSpec } from '../VegaChart/VegaChart';
import type { KustoVisualization } from '../../services/kusto';

export type ChartType = 'bar' | 'line' | 'area' | 'donut' | 'grouped-bar' | 'scatter' | 'treemap' | 'card' | 'heatmap' | 'pivot';

export const CHART_TYPES: { value: ChartType; label: string }[] = [
    { value: 'bar', label: 'Bar' },
    { value: 'line', label: 'Line' },
    { value: 'area', label: 'Stacked Area' },
    { value: 'donut', label: 'Donut' },
    { value: 'grouped-bar', label: 'Grouped Bar' },
    { value: 'scatter', label: 'Scatter' },
    { value: 'heatmap', label: 'Heatmap' },
    { value: 'treemap', label: 'Treemap' },
    { value: 'card', label: 'Card' },
    { value: 'pivot', label: 'Pivot' },
];

const RENDER_TYPE_MAP: Record<string, ChartType> = {
    timechart: 'line',
    linechart: 'line',
    barchart: 'bar',
    columnchart: 'grouped-bar',
    piechart: 'donut',
    areachart: 'area',
    stackedareachart: 'area',
    scatterchart: 'scatter',
    treemap: 'treemap',
    card: 'card',
    timepivot: 'pivot',
    pivotchart: 'pivot',
};

export const SUPPORTED_RENDER_TYPES = new Set(Object.keys(RENDER_TYPE_MAP));

export function mapRenderType(renderType: string): ChartType | null {
    return RENDER_TYPE_MAP[renderType.toLowerCase()] ?? null;
}

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

export function applyVisualizationHints(viz: KustoVisualization | undefined, columns: string[], rows: Record<string, unknown>[]): DetectedConfig | null {
    if (!viz) {
        return null;
    }
    const mapped = mapRenderType(viz.type);
    if (!mapped) {
        return null;
    }

    const fallback = autoDetect(columns, rows);
    const config: DetectedConfig = {
        chartType: mapped,
        xField: viz.xColumn ?? fallback.xField,
        yField: viz.yColumns?.[0] ?? fallback.yField,
        colorField: viz.series ?? fallback.colorField,
    };

    return config;
}

export function buildTreemapVegaSpec(xField: string, yField: string, colorField: string | null, rows: Record<string, unknown>[], chartColors: string[], isDark: boolean): Record<string, unknown> {
    const groupField = colorField ?? xField;
    const groups = [...new Set(rows.map((r) => String(r[groupField] ?? '')))];

    // Build flat hierarchy: root → group → leaf
    const treeData: { id: string; parent: string | null; size: number; label: string; group: string }[] = [
        { id: 'root', parent: null, size: 0, label: '', group: '' },
    ];

    if (colorField && colorField !== xField) {
        for (const g of groups) {
            treeData.push({ id: `group:${g}`, parent: 'root', size: 0, label: g, group: g });
        }
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const g = String(r[groupField] ?? '');
            const val = Math.max(0, Number(r[yField]) || 0);
            treeData.push({ id: `leaf:${i}`, parent: `group:${g}`, size: val, label: String(r[xField] ?? ''), group: g });
        }
    } else {
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const val = Math.max(0, Number(r[yField]) || 0);
            const g = String(r[xField] ?? '');
            treeData.push({ id: `leaf:${i}`, parent: 'root', size: val, label: g, group: g });
        }
    }

    const textColor = isDark ? '#fff' : '#222';

    return {
        $schema: 'https://vega.github.io/schema/vega/v6.json',
        padding: 2,
        autosize: 'none',
        signals: [
            { name: 'width', update: 'containerSize()[0] - 4' },
            { name: 'height', value: 300 },
        ],
        data: [
            {
                name: 'tree',
                values: treeData,
                transform: [
                    { type: 'stratify', key: 'id', parentKey: 'parent' },
                    { type: 'treemap', field: 'size', sort: { field: 'value' }, round: true, method: 'squarify', ratio: 1.6, size: [{ signal: 'width' }, { signal: 'height' }] },
                ],
            },
            {
                name: 'leaves',
                source: 'tree',
                transform: [{ type: 'filter', expr: '!datum.children' }],
            },
        ],
        scales: [
            { name: 'color', type: 'ordinal', domain: groups, range: chartColors },
        ],
        marks: [
            {
                type: 'rect',
                from: { data: 'leaves' },
                encode: {
                    enter: { stroke: { value: isDark ? '#2a2a2a' : '#fff' }, strokeWidth: { value: 1 } },
                    update: {
                        x: { field: 'x0' },
                        y: { field: 'y0' },
                        x2: { field: 'x1' },
                        y2: { field: 'y1' },
                        fill: { scale: 'color', field: 'group' },
                        tooltip: { signal: `{'${xField}': datum.label, '${yField}': datum.size}` },
                    },
                    hover: { fillOpacity: { value: 0.8 } },
                },
            },
            {
                type: 'text',
                from: { data: 'leaves' },
                interactive: false,
                encode: {
                    enter: {
                        font: { value: 'sans-serif' },
                        align: { value: 'center' },
                        baseline: { value: 'middle' },
                        fill: { value: textColor },
                        fontSize: { value: 11 },
                    },
                    update: {
                        x: { signal: '0.5 * (datum.x0 + datum.x1)' },
                        y: { signal: '0.5 * (datum.y0 + datum.y1)' },
                        text: { signal: '(datum.x1 - datum.x0) > 50 && (datum.y1 - datum.y0) > 14 ? datum.label : ""' },
                    },
                },
            },
        ],
    };
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
        case 'heatmap':
            return {
                mark: { type: 'rect' },
                encoding: {
                    x: { field: xField, type: xIsTime ? 'temporal' : 'nominal' },
                    y: { field: colorField ?? yField, type: 'nominal' },
                    color: { field: yField, type: 'quantitative', scale: { scheme: 'blues' } },
                },
            } as VisualizationSpec;
        case 'treemap':
            // Treemap uses raw Vega spec via buildTreemapVegaSpec — this is a fallback
            return {
                mark: { type: 'bar', cornerRadiusEnd: 3 },
                encoding: {
                    y: { field: xField, type: 'nominal', sort: '-x', axis: { labelLimit: 200 } },
                    x: { field: yField, type: 'quantitative' },
                    ...(colorField ? { color: { field: colorField, type: 'nominal', scale: { range: chartColors } } } : { color: { value: chartColors[0] } }),
                },
            } as VisualizationSpec;
        case 'card': {
            const value = rows[0]?.[yField] ?? rows[0]?.[xField] ?? '';
            const label = yField || xField;
            return {
                data: { values: [{ value: String(value), label }] },
                mark: { type: 'text', fontSize: 48, fontWeight: 'bold', align: 'center', baseline: 'middle' },
                encoding: {
                    text: { field: 'value', type: 'nominal' },
                    color: { value: chartColors[0] },
                },
            } as VisualizationSpec;
        }
        case 'pivot':
            return {
                mark: { type: 'rect' },
                encoding: {
                    x: { field: xField, type: xIsTime ? 'temporal' : 'nominal' },
                    y: { field: colorField ?? columns.find((c) => c !== xField && c !== yField) ?? yField, type: 'nominal' },
                    color: { field: yField, type: 'quantitative', scale: { scheme: 'orangered' } },
                    tooltip: [
                        { field: xField, type: xIsTime ? 'temporal' : 'nominal' },
                        { field: yField, type: 'quantitative' },
                    ],
                },
            } as VisualizationSpec;
        default:
            return { mark: 'bar' } as VisualizationSpec;
    }
}
