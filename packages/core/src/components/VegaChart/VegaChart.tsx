import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { View as VegaView } from 'vega';
import type { TopLevelSpec } from 'vega-lite';

// Use TopLevelSpec from vega-lite instead of VisualizationSpec from vega-embed
type VisualizationSpec = TopLevelSpec;

const DEFAULT_PALETTE = [
    '#6a8799', '#909d63', '#ebc17a', '#bc5653', '#b06698',
    '#c9dfff', '#7eaac7', '#acbbd0', '#636363', '#d9d9d9',
];

function getVegaThemeColors(isDark: boolean) {
    return {
        text: isDark ? '#c0c0c0' : '#333',
        grid: isDark ? '#3a3a3a' : '#e0e0e0',
        domain: isDark ? '#4a4a4a' : '#ccc',
        arcStroke: isDark ? '#2a2a2a' : '#ffffff',
    };
}

export interface VegaChartProps {
    spec: VisualizationSpec;
    data: { values: unknown[] };
    isDark: boolean;
    onClick?: (datum: Record<string, unknown>) => void;
    height?: number;
    palette?: string[];
    rawVegaSpec?: Record<string, unknown>;
}

export type { VisualizationSpec };

export function VegaChart({ spec, data, isDark, onClick, height, palette, rawVegaSpec }: VegaChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<VegaView | null>(null);
    const [width, setWidth] = useState(0);
    const [renderError, setRenderError] = useState<string | null>(null);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setWidth(entry.contentRect.width);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const config = useMemo(() => {
        const colors = getVegaThemeColors(isDark);
        const chartPalette = palette ?? DEFAULT_PALETTE;
        return {
            background: 'transparent',
            axis: {
                labelColor: colors.text,
                titleColor: colors.text,
                gridColor: colors.grid,
                domainColor: colors.domain,
                tickColor: colors.domain,
            },
            axisY: {
                titleAngle: -90,
                titleAnchor: 'middle',
                titlePadding: 20,
            },
            axisX: {
                titleAlign: 'center',
                titlePadding: 8,
            },
            legend: {
                labelColor: colors.text,
                titleColor: colors.text,
            },
            title: {
                color: colors.text,
            },
            header: {
                labelColor: colors.text,
                titleColor: colors.text,
            },
            view: {
                stroke: 'transparent',
            },
            range: {
                category: chartPalette,
            },
            arc: {
                stroke: colors.arcStroke,
            },
            bar: {
                discreteBandSize: { band: 0.75 },
                continuousBandSize: 15,
            },
            scale: {
                bandPaddingInner: 0.25,
            },
        };
    }, [isDark, palette]);

    const chartHeight = height ?? 250;

    const fullSpec = useMemo(() => {
        const specObj = spec as unknown as Record<string, unknown>;
        const isStepHeight = typeof specObj['height'] === 'object';
        const isStepWidth = typeof specObj['width'] === 'object';

        // For step-based width, drop the step and use container width with autosize: 'fit'
        // Vega-Lite distributes bars evenly across the available space
        let resolvedSpec = { ...specObj };
        if (isStepWidth) {
            const { width: _stepWidth, ...rest } = resolvedSpec;
            resolvedSpec = rest;
        }

        return {
            $schema: 'https://vega.github.io/schema/vega-lite/v6.json' as const,
            ...resolvedSpec,
            ...(!resolvedSpec['width'] ? { width: width > 0 ? width - 40 : undefined } : {}),
            ...(!resolvedSpec['height'] ? { height: chartHeight } : {}),
            ...(isStepHeight ? { autosize: { type: 'none' as const, contains: 'padding' as const } } : { autosize: { type: 'fit' as const, contains: 'padding' as const } }),
            config: {
            ...config,
            axisX: {
                ...config.axisX,
                titleX: (width - 40) / 2,
            },
            axisY: {
                ...config.axisY,
                titleY: chartHeight / 2,
            },
        },
    } as unknown as VisualizationSpec;
    }, [spec, width, chartHeight, config]);

    const embedSpec = useMemo(() => {
        const s = { ...fullSpec } as Record<string, unknown>;
        s['data'] = { values: data.values };
        return s as unknown as VisualizationSpec;
    }, [fullSpec, data.values]);

    // Render chart using vega + vega-lite directly (no vega-embed dependency)
    const chartRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!chartRef.current || width <= 0) {
            return;
        }
        let cancelled = false;
        let view: VegaView | null = null;
        setRenderError(null);

        void (async () => {
            try {
                const [{ compile }, { parse, View }, { default: createTooltipHandler }] = await Promise.all([
                    import('vega-lite'),
                    import('vega'),
                    import('vega-tooltip'),
                ]);
                if (cancelled || !chartRef.current) {
                    return;
                }

                const vegaSpec = rawVegaSpec
                    ? rawVegaSpec
                    : compile(embedSpec).spec;
                const runtime = parse(vegaSpec);
                view = new View(runtime, {
                    renderer: 'canvas',
                    container: chartRef.current,
                    hover: true,
                });

                const handler = createTooltipHandler(view, { theme: isDark ? 'dark' : 'light' });
                view.tooltip(handler.call.bind(handler));

                await view.runAsync();

                viewRef.current = view;
                if (onClick) {
                    view.addEventListener('click', (_event: unknown, item: unknown) => {
                        const typedItem = item as { datum?: Record<string, unknown> } | undefined;
                        if (typedItem?.datum) {
                            onClick(typedItem.datum);
                        }
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : 'Chart render failed';
                    setRenderError(message);
                }
            }
        })();

        return () => {
            cancelled = true;
            if (view) {
                view.finalize();
            }
        };
    }, [embedSpec, rawVegaSpec, onClick, isDark, width]);

    const containerStyle = useMemo((): CSSProperties => ({ width: '100%', minHeight: height ?? 250 }), [height]);
    const errorStyle = useMemo((): CSSProperties => ({
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: height ?? 250, color: '#636363', fontSize: '12px',
        fontStyle: 'italic', padding: '16px', textAlign: 'center',
    }), [height]);

    return (
        <div ref={containerRef} style={containerStyle}>
            {renderError ? (
                <div style={errorStyle}>
                    Chart unavailable: {renderError}
                </div>
            ) : width > 0 ? <div ref={chartRef} /> : null}
        </div>
    );
}
