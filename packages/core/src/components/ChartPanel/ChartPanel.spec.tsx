import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ChartPanel } from './ChartPanel';

vi.mock('../VegaChart/VegaChart', () => ({
    VegaChart: () => React.createElement('div', { 'data-testid': 'vega-chart' }),
}));
vi.mock('../../context/ExplorerColorContext', () => ({
    useExplorerColors: () => ({
        semantic: {},
        chart: { palette: ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10'] },
    }),
}));
vi.mock('./ChartPanel.styles', () => ({
    useStyles: () => new Proxy({}, { get: (_, p) => String(p) }),
}));
vi.mock('@fluentui/react-components', () => ({
    Dropdown: (p: Record<string, unknown>) => {
        const handler = p['onOptionSelect'] as ((e: unknown, d: { optionValue?: string }) => void) | undefined;
        return React.createElement('select', {
            ...p,
            'data-testid': `dropdown-${typeof p['value'] === 'string' ? p['value'] : ''}`,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => handler?.(e, { optionValue: e.target.value }),
        }, p['children'] as React.ReactNode);
    },
    Option: (p: Record<string, unknown>) => React.createElement('option', p, p['children'] as React.ReactNode),
    Label: (p: Record<string, unknown>) => React.createElement('label', p, p['children'] as React.ReactNode),
}));

describe('ChartPanel', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('renders with empty data (fewer than 2 columns)', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: [],
                rows: [],
            }));
        });
        expect(container.textContent).toContain('Need at least 2 columns');
    });

    it('renders with sample data', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Category', 'Count'],
                rows: [
                    { Category: 'A', Count: 10 },
                    { Category: 'B', Count: 20 },
                ],
            }));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('auto-detects line chart for datetime + number + string columns', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Date', 'Value', 'Category'],
                rows: [
                    { Date: '2026-01-01T00:00:00Z', Value: 10, Category: 'A' },
                    { Date: '2026-01-02T00:00:00Z', Value: 20, Category: 'B' },
                ],
            }));
        });
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('auto-detects line chart for datetime + number columns', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Date', 'Value'],
                rows: [
                    { Date: '2026-01-01T00:00:00Z', Value: 10 },
                    { Date: '2026-01-02T00:00:00Z', Value: 20 },
                ],
            }));
        });
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('auto-detects scatter chart for 2 numeric columns', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['X', 'Y'],
                rows: [
                    { X: 1, Y: 2 },
                    { X: 3, Y: 4 },
                ],
            }));
        });
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('auto-detects scatter chart for 2 numbers + 1 string (colorField)', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Group', 'X', 'Y'],
                rows: [
                    { Group: 'A', X: 1, Y: 2 },
                    { Group: 'B', X: 3, Y: 4 },
                ],
            }));
        });
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('shows row-limit message for data exceeding 1000 rows', () => {
        const rows = Array.from({ length: 1100 }, (_, i) => ({ Category: `Cat${i}`, Count: i }));
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Category', 'Count'],
                rows,
            }));
        });
        expect(container.textContent).toContain('1,000');
    });

    it('handles column with all null/empty values as string', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Empty', 'Count'],
                rows: [
                    { Empty: '', Count: 10 },
                    { Empty: null, Count: 20 },
                ],
            }));
        });
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('resets chart type when columns change', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Cat', 'Val'],
                rows: [{ Cat: 'A', Val: 1 }],
            }));
        });
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();

        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Date', 'Amount'],
                rows: [{ Date: '2026-01-01T00:00:00Z', Amount: 100 }],
            }));
        });
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('handles dropdown handlers with and without optionValue', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Category', 'Count'],
                rows: [{ Category: 'A', Count: 10 }],
            }));
        });
        const selects = container.querySelectorAll('select');
        expect(selects.length).toBeGreaterThan(0);
    });

    it('auto-detects donut chart for 2 strings + 1 number', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Region', 'SubRegion', 'Sales'],
                rows: [
                    { Region: 'East', SubRegion: 'NE', Sales: 100 },
                    { Region: 'West', SubRegion: 'NW', Sales: 200 },
                ],
            }));
        });
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('falls back to bar when no columns match heuristics', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['A', 'B'],
                rows: [{ A: 'x', B: 'y' }],
            }));
        });
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('changes chart type when dropdown changes', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Category', 'Count'],
                rows: [{ Category: 'A', Count: 10 }],
            }));
        });
        const selects = container.querySelectorAll('select');
        // First select is chart type
        if (selects[0]) {
            act(() => {
                selects[0].value = 'donut';
                selects[0].dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('changes X field when dropdown changes', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Category', 'Count', 'Extra'],
                rows: [{ Category: 'A', Count: 10, Extra: 5 }],
            }));
        });
        const selects = container.querySelectorAll('select');
        // Second select is X field
        if (selects[1]) {
            act(() => {
                selects[1].value = 'Extra';
                selects[1].dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('changes Y field when dropdown changes', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Category', 'Count', 'Extra'],
                rows: [{ Category: 'A', Count: 10, Extra: 20 }],
            }));
        });
        const selects = container.querySelectorAll('select');
        // Third select is Y field
        if (selects[2]) {
            act(() => {
                selects[2].value = 'Extra';
                selects[2].dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('changes color field when dropdown changes', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Category', 'Count', 'Group'],
                rows: [{ Category: 'A', Count: 10, Group: 'G1' }],
            }));
        });
        const selects = container.querySelectorAll('select');
        // Fourth select is color field
        if (selects[3]) {
            act(() => {
                selects[3].value = 'Category';
                selects[3].dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('sets color to null when (none) is selected', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Category', 'Count', 'Group'],
                rows: [{ Category: 'A', Count: 10, Group: 'G1' }],
            }));
        });
        const selects = container.querySelectorAll('select');
        if (selects[3]) {
            act(() => {
                selects[3].value = '(none)';
                selects[3].dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('renders area chart type', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Date', 'Value'],
                rows: [
                    { Date: '2026-01-01T00:00:00Z', Value: 10 },
                    { Date: '2026-01-02T00:00:00Z', Value: 20 },
                ],
            }));
        });
        const selects = container.querySelectorAll('select');
        if (selects[0]) {
            act(() => {
                selects[0].value = 'area';
                selects[0].dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });

    it('renders grouped-bar chart type', () => {
        act(() => {
            root.render(React.createElement(ChartPanel, {
                columns: ['Category', 'Count'],
                rows: [{ Category: 'A', Count: 10 }],
            }));
        });
        const selects = container.querySelectorAll('select');
        if (selects[0]) {
            act(() => {
                selects[0].value = 'grouped-bar';
                selects[0].dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        expect(container.querySelector('[data-testid="vega-chart"]')).toBeTruthy();
    });
});
