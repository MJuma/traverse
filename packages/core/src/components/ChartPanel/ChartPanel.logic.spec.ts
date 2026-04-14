import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    mapRenderType,
    applyVisualizationHints,
    buildTreemapVegaSpec,
    SUPPORTED_RENDER_TYPES,
    buildSpec,
    CHART_TYPES,
} from './ChartPanel.logic';
import type { KustoVisualization } from '../../services/kusto';

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// SUPPORTED_RENDER_TYPES
// ---------------------------------------------------------------------------

describe('SUPPORTED_RENDER_TYPES', () => {
    it('contains all expected render types', () => {
        const expected = [
            'timechart', 'linechart', 'barchart', 'columnchart',
            'piechart', 'areachart', 'stackedareachart', 'scatterchart',
            'treemap', 'card', 'timepivot', 'pivotchart',
        ];
        for (const t of expected) {
            expect(SUPPORTED_RENDER_TYPES.has(t)).toBe(true);
        }
    });

    it('is a Set', () => {
        expect(SUPPORTED_RENDER_TYPES).toBeInstanceOf(Set);
    });
});

// ---------------------------------------------------------------------------
// CHART_TYPES
// ---------------------------------------------------------------------------

describe('CHART_TYPES', () => {
    it('contains all expected chart types with labels', () => {
        const values = CHART_TYPES.map((t) => t.value);
        expect(values).toContain('bar');
        expect(values).toContain('line');
        expect(values).toContain('area');
        expect(values).toContain('donut');
        expect(values).toContain('grouped-bar');
        expect(values).toContain('scatter');
        expect(values).toContain('heatmap');
        expect(values).toContain('treemap');
        expect(values).toContain('card');
        expect(values).toContain('pivot');
    });
});

// ---------------------------------------------------------------------------
// mapRenderType
// ---------------------------------------------------------------------------

describe('mapRenderType', () => {
    it.each([
        ['timechart', 'line'],
        ['linechart', 'line'],
        ['barchart', 'bar'],
        ['columnchart', 'grouped-bar'],
        ['piechart', 'donut'],
        ['areachart', 'area'],
        ['stackedareachart', 'area'],
        ['scatterchart', 'scatter'],
        ['treemap', 'treemap'],
        ['card', 'card'],
        ['timepivot', 'pivot'],
        ['pivotchart', 'pivot'],
    ])('maps "%s" to "%s"', (input, expected) => {
        expect(mapRenderType(input)).toBe(expected);
    });

    it('is case insensitive', () => {
        expect(mapRenderType('TimeChart')).toBe('line');
        expect(mapRenderType('BARCHART')).toBe('bar');
        expect(mapRenderType('PieChart')).toBe('donut');
    });

    it('returns null for unsupported render types', () => {
        expect(mapRenderType('table')).toBeNull();
        expect(mapRenderType('unknown')).toBeNull();
        expect(mapRenderType('')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// applyVisualizationHints
// ---------------------------------------------------------------------------

describe('applyVisualizationHints', () => {
    const columns = ['Timestamp', 'Count', 'Category'];
    const rows = [
        { Timestamp: '2024-01-01T00:00:00Z', Count: 10, Category: 'A' },
        { Timestamp: '2024-01-02T00:00:00Z', Count: 20, Category: 'B' },
    ];

    it('returns null when viz is undefined', () => {
        expect(applyVisualizationHints(undefined, columns, rows)).toBeNull();
    });

    it('returns null when viz type is unsupported', () => {
        const viz: KustoVisualization = { type: 'table' };
        expect(applyVisualizationHints(viz, columns, rows)).toBeNull();
    });

    it('returns null for unknown viz type', () => {
        const viz: KustoVisualization = { type: 'unknown' };
        expect(applyVisualizationHints(viz, columns, rows)).toBeNull();
    });

    it('returns config with mapped chart type for valid viz', () => {
        const viz: KustoVisualization = { type: 'timechart' };
        const result = applyVisualizationHints(viz, columns, rows);
        expect(result).not.toBeNull();
        expect(result!.chartType).toBe('line');
    });

    it('uses xColumn from viz when provided', () => {
        const viz: KustoVisualization = { type: 'barchart', xColumn: 'Category' };
        const result = applyVisualizationHints(viz, columns, rows);
        expect(result!.xField).toBe('Category');
    });

    it('uses yColumns from viz when provided', () => {
        const viz: KustoVisualization = { type: 'barchart', yColumns: ['Count'] };
        const result = applyVisualizationHints(viz, columns, rows);
        expect(result!.yField).toBe('Count');
    });

    it('uses series from viz when provided', () => {
        const viz: KustoVisualization = { type: 'barchart', series: 'Category' };
        const result = applyVisualizationHints(viz, columns, rows);
        expect(result!.colorField).toBe('Category');
    });

    it('falls back to autoDetect fields when viz does not specify columns', () => {
        const viz: KustoVisualization = { type: 'timechart' };
        const result = applyVisualizationHints(viz, columns, rows);
        expect(result).not.toBeNull();
        // autoDetect should pick Timestamp as xField and Count as yField
        expect(result!.xField).toBe('Timestamp');
        expect(result!.yField).toBe('Count');
    });
});

// ---------------------------------------------------------------------------
// buildTreemapVegaSpec
// ---------------------------------------------------------------------------

describe('buildTreemapVegaSpec', () => {
    const rows = [
        { category: 'A', group: 'G1', value: 10 },
        { category: 'B', group: 'G1', value: 20 },
        { category: 'C', group: 'G2', value: 30 },
    ];
    const chartColors = ['#ff0000', '#00ff00', '#0000ff'];

    it('returns a valid Vega spec object', () => {
        const spec = buildTreemapVegaSpec('category', 'value', null, rows, chartColors, false);
        expect(spec["$schema"]).toContain('vega');
        expect(spec["data"]).toBeDefined();
        expect(spec["marks"]).toBeDefined();
        expect(spec["scales"]).toBeDefined();
        expect(spec["signals"]).toBeDefined();
    });

    it('includes padding and autosize', () => {
        const spec = buildTreemapVegaSpec('category', 'value', null, rows, chartColors, false);
        expect(spec["padding"]).toBe(2);
        expect(spec["autosize"]).toBe('none');
    });

    it('creates flat hierarchy without colorField', () => {
        const spec = buildTreemapVegaSpec('category', 'value', null, rows, chartColors, false);
        const treeData = (spec["data"] as { name: string; values: unknown[] }[])[0].values as { id: string; parent: string | null }[];
        // root + 3 leaves
        expect(treeData).toHaveLength(4);
        expect(treeData[0].id).toBe('root');
        expect(treeData[0].parent).toBeNull();
        expect(treeData[1].parent).toBe('root');
    });

    it('creates grouped hierarchy with colorField', () => {
        const spec = buildTreemapVegaSpec('category', 'value', 'group', rows, chartColors, false);
        const treeData = (spec["data"] as { name: string; values: unknown[] }[])[0].values as { id: string; parent: string | null }[];
        // root + 2 groups + 3 leaves
        expect(treeData).toHaveLength(6);
        const groups = treeData.filter((d) => d.id.startsWith('group:'));
        expect(groups).toHaveLength(2);
        const leaves = treeData.filter((d) => d.id.startsWith('leaf:'));
        expect(leaves).toHaveLength(3);
        for (const leaf of leaves) {
            expect(leaf.parent).toMatch(/^group:/);
        }
    });

    it('uses dark mode text color when isDark is true', () => {
        const spec = buildTreemapVegaSpec('category', 'value', null, rows, chartColors, true);
        const textMark = (spec["marks"] as { type: string; encode: { enter: { fill: { value: string } } } }[]).find((m) => m.type === 'text');
        expect(textMark!.encode.enter.fill.value).toBe('#fff');
    });

    it('uses light mode text color when isDark is false', () => {
        const spec = buildTreemapVegaSpec('category', 'value', null, rows, chartColors, false);
        const textMark = (spec["marks"] as { type: string; encode: { enter: { fill: { value: string } } } }[]).find((m) => m.type === 'text');
        expect(textMark!.encode.enter.fill.value).toBe('#222');
    });

    it('uses dark mode stroke color for rects', () => {
        const spec = buildTreemapVegaSpec('category', 'value', null, rows, chartColors, true);
        const rectMark = (spec["marks"] as { type: string; encode: { enter: { stroke: { value: string } } } }[]).find((m) => m.type === 'rect');
        expect(rectMark!.encode.enter.stroke.value).toBe('#2a2a2a');
    });

    it('clamps negative values to 0', () => {
        const negativeRows = [{ category: 'A', value: -5 }];
        const spec = buildTreemapVegaSpec('category', 'value', null, negativeRows, chartColors, false);
        const treeData = (spec["data"] as { name: string; values: { size: number }[] }[])[0].values;
        const leaf = treeData.find((d) => d.size !== undefined && treeData.indexOf(d) > 0);
        expect(leaf!.size).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// buildSpec
// ---------------------------------------------------------------------------

describe('buildSpec', () => {
    const columns = ['Name', 'Value'];
    const rows = [{ Name: 'A', Value: 10 }];
    const chartColors = ['#4285f4', '#ea4335', '#34a853'];

    it('builds a bar spec', () => {
        const spec = buildSpec('bar', 'Name', 'Value', null, columns, rows, chartColors);
        expect((spec as { mark: { type: string } }).mark.type).toBe('bar');
    });

    it('builds a line spec', () => {
        const spec = buildSpec('line', 'Name', 'Value', null, columns, rows, chartColors);
        expect((spec as { mark: { type: string } }).mark.type).toBe('line');
    });

    it('builds an area spec', () => {
        const spec = buildSpec('area', 'Name', 'Value', null, columns, rows, chartColors);
        expect((spec as { mark: { type: string } }).mark.type).toBe('area');
    });

    it('builds a donut spec', () => {
        const spec = buildSpec('donut', 'Name', 'Value', null, columns, rows, chartColors);
        expect((spec as { mark: { type: string; innerRadius: number } }).mark.type).toBe('arc');
        expect((spec as { mark: { innerRadius: number } }).mark.innerRadius).toBe(50);
    });

    it('builds a grouped-bar spec', () => {
        const spec = buildSpec('grouped-bar', 'Name', 'Value', null, columns, rows, chartColors);
        expect((spec as { mark: { type: string } }).mark.type).toBe('bar');
    });

    it('builds a scatter spec', () => {
        const spec = buildSpec('scatter', 'Name', 'Value', null, columns, rows, chartColors);
        expect((spec as { mark: { type: string } }).mark.type).toBe('circle');
    });

    it('builds a heatmap spec', () => {
        const spec = buildSpec('heatmap', 'Name', 'Value', null, columns, rows, chartColors);
        expect((spec as { mark: { type: string } }).mark.type).toBe('rect');
        const encoding = (spec as { encoding: { color: { scale: { scheme: string } } } }).encoding;
        expect(encoding.color.scale.scheme).toBe('blues');
    });

    it('builds a card spec', () => {
        const spec = buildSpec('card', 'Name', 'Value', null, columns, rows, chartColors);
        expect((spec as { mark: { type: string } }).mark.type).toBe('text');
        expect((spec as { mark: { fontSize: number } }).mark.fontSize).toBe(48);
    });

    it('builds a card spec using xField when yField value is missing', () => {
        const cardRows = [{ Name: 'hello' }];
        const spec = buildSpec('card', 'Name', 'Missing', null, ['Name', 'Missing'], cardRows, chartColors);
        expect((spec as { data: { values: { value: string }[] } }).data.values[0].value).toBe('hello');
    });

    it('builds a pivot spec', () => {
        const spec = buildSpec('pivot', 'Name', 'Value', null, columns, rows, chartColors);
        expect((spec as { mark: { type: string } }).mark.type).toBe('rect');
        const encoding = (spec as { encoding: { color: { scale: { scheme: string } } } }).encoding;
        expect(encoding.color.scale.scheme).toBe('orangered');
    });

    it('builds a treemap spec (bar fallback)', () => {
        const spec = buildSpec('treemap', 'Name', 'Value', null, columns, rows, chartColors);
        expect((spec as { mark: { type: string } }).mark.type).toBe('bar');
    });

    it('includes color encoding with colorField when provided', () => {
        const spec = buildSpec('bar', 'Name', 'Value', 'Category', ['Name', 'Value', 'Category'], rows, chartColors);
        const encoding = (spec as { encoding: { color: { field: string } } }).encoding;
        expect(encoding.color.field).toBe('Category');
    });

    it('uses single color value when colorField is null', () => {
        const spec = buildSpec('bar', 'Name', 'Value', null, columns, rows, chartColors);
        const encoding = (spec as { encoding: { color: { value: string } } }).encoding;
        expect(encoding.color.value).toBe(chartColors[0]);
    });

    it('uses temporal xType for datetime columns in line chart', () => {
        const timeColumns = ['Timestamp', 'Value'];
        const timeRows = [{ Timestamp: '2024-01-01T00:00:00Z', Value: 10 }];
        const spec = buildSpec('line', 'Timestamp', 'Value', null, timeColumns, timeRows, chartColors);
        const encoding = (spec as { encoding: { x: { type: string } } }).encoding;
        expect(encoding.x.type).toBe('temporal');
    });

    it('uses nominal xType for non-datetime columns in line chart', () => {
        const spec = buildSpec('line', 'Name', 'Value', null, columns, rows, chartColors);
        const encoding = (spec as { encoding: { x: { type: string } } }).encoding;
        expect(encoding.x.type).toBe('nominal');
    });

    it('heatmap uses colorField for y axis when provided', () => {
        const spec = buildSpec('heatmap', 'Name', 'Value', 'Category', ['Name', 'Value', 'Category'], rows, chartColors);
        const encoding = (spec as { encoding: { y: { field: string } } }).encoding;
        expect(encoding.y.field).toBe('Category');
    });

    it('pivot uses colorField for y axis when provided', () => {
        const spec = buildSpec('pivot', 'Name', 'Value', 'Category', ['Name', 'Value', 'Category'], rows, chartColors);
        const encoding = (spec as { encoding: { y: { field: string } } }).encoding;
        expect(encoding.y.field).toBe('Category');
    });

    it('pivot includes tooltip encoding', () => {
        const spec = buildSpec('pivot', 'Name', 'Value', null, columns, rows, chartColors);
        const encoding = (spec as { encoding: { tooltip: unknown[] } }).encoding;
        expect(encoding.tooltip).toBeDefined();
        expect(encoding.tooltip).toHaveLength(2);
    });

    it('grouped-bar includes xOffset when colorField is present', () => {
        const spec = buildSpec('grouped-bar', 'Name', 'Value', 'Cat', ['Name', 'Value', 'Cat'], rows, chartColors);
        const encoding = (spec as { encoding: { xOffset: { field: string } } }).encoding;
        expect(encoding.xOffset.field).toBe('Cat');
    });

    it('card handles empty rows', () => {
        const spec = buildSpec('card', 'Name', 'Value', null, columns, [], chartColors);
        expect((spec as { data: { values: { value: string }[] } }).data.values[0].value).toBe('');
    });
});
