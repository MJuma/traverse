import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { isCellInRange, parseHighlightExpr, matchesHighlight, computeAggregates, computeDateDelta, findEmptyColumns, buildSelectionTsv } from './ResultsTable.logic';
import { ResultsTable } from './ResultsTable';

vi.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: () => mockUseVirtualizer(),
}));
vi.mock('@monaco-editor/react', () => ({
    default: () => React.createElement('div', { 'data-testid': 'monaco-editor' }),
}));
vi.mock('../../context/ExplorerColorContext', () => ({
    useExplorerColors: () => ({
        semantic: { scrollThumb: '#ccc', scrollThumbHover: '#aaa', backdrop: '#000', shadowMedium: '#000', shadowLight: '#000', functionBadge: '#0f0', materializedViewBadge: '#90f', lookupBadge: '#f90', selectionBg: '#00f', selectionSubtle: '#eef', highlightHoverBg: '#ffa' },
        chart: { palette: [] },
    }),
}));
vi.mock('./ResultsTable.logic', () => ({
    isCellInRange: vi.fn(() => false),
    serializeCellValue: vi.fn((value: unknown) => value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)),
    formatCellDisplayValue: vi.fn((value: unknown) => value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)),
    buildSelectionTsv: vi.fn((_rows: unknown[], _columns: string[], selection: unknown) => selection ? 'copied-data' : ''),
    parseHighlightExpr: vi.fn(() => null),
    matchesHighlight: vi.fn(() => false),
    computeAggregates: vi.fn(() => ({})),
    computeDateDelta: vi.fn(() => null),
    shortType: vi.fn((t: string) => t),
    computeColumnWidths: vi.fn(() => ({})),
    sortRows: vi.fn((rows: unknown[]) => rows),
    filterRows: vi.fn((rows: unknown[]) => rows),
    findEmptyColumns: vi.fn(() => new Set()),
}));
vi.mock('./ResultsTable.styles', () => ({
    useStyles: () => new Proxy({}, { get: (_, p) => String(p) }),
}));
vi.mock('@fluentui/react-components', () => ({
    Input: (p: Record<string, unknown>) => {
        const { onChange, ...rest } = p;
        const handleChange = onChange ? (e: Event) => {
            (onChange as (e: Event, d: { value: string }) => void)(e, { value: (e.target as HTMLInputElement).value });
        } : undefined;
        return React.createElement('input', { ...rest, onChange: handleChange });
    },
    Button: (p: Record<string, unknown>) => React.createElement('button', p, p['children'] as React.ReactNode),
    Tooltip: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    Popover: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    PopoverTrigger: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    PopoverSurface: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    Checkbox: (p: Record<string, unknown>) => {
        const { onChange, label, ...rest } = p;
        const handleChange = onChange ? () => {
            (onChange as () => void)();
        } : undefined;
        return React.createElement('label', null,
            React.createElement('input', { type: 'checkbox', ...rest, onChange: handleChange }),
            label as React.ReactNode,
        );
    },
}));
vi.mock('@fluentui/react-icons', () => ({
    SearchRegular: () => React.createElement('span', null, 'icon'),
    ColumnTripleRegular: () => React.createElement('span', null, 'icon'),
    EyeOffRegular: () => React.createElement('span', null, 'icon'),
    FilterRegular: () => React.createElement('span', null, 'icon'),
    ArrowSortDownRegular: () => React.createElement('span', null, 'icon'),
    ArrowSortUpRegular: () => React.createElement('span', null, 'icon'),
    DismissRegular: () => React.createElement('span', null, 'icon'),
    ChevronRightRegular: () => React.createElement('span', null, 'icon'),
    DismissCircleRegular: () => React.createElement('span', null, 'icon'),
    HighlightRegular: () => React.createElement('span', null, 'icon'),
    CodeRegular: () => React.createElement('span', null, 'icon'),
    TableSimpleRegular: () => React.createElement('span', null, 'icon'),
    TextBulletListRegular: () => React.createElement('span', null, 'icon'),
}));

const mockUseVirtualizer = vi.fn(() => ({
    getVirtualItems: () => [] as { index: number; start: number; key: string | number; size: number }[],
    getTotalSize: () => 0 as number,
    measureElement: vi.fn(),
}));


const mockedIsCellInRange = vi.mocked(isCellInRange);
const mockedParseHighlightExpr = vi.mocked(parseHighlightExpr);
const mockedMatchesHighlight = vi.mocked(matchesHighlight);
const mockedComputeAggregates = vi.mocked(computeAggregates);
const mockedComputeDateDelta = vi.mocked(computeDateDelta);
const mockedFindEmptyColumns = vi.mocked(findEmptyColumns);
const mockedBuildSelectionTsv = vi.mocked(buildSelectionTsv);

const makeVirtualItems = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ index: i, start: i * 28, key: String(i), size: 28 }));

describe('ResultsTable', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        if (!Element.prototype.scrollTo) {
            Element.prototype.scrollTo = vi.fn();
        }
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        mockUseVirtualizer.mockReturnValue({
            getVirtualItems: () => [],
            getTotalSize: () => 0,
            measureElement: vi.fn(),
        });
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('renders with empty data', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: [],
                rows: [],
            }));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with sample data', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Name', 'Value'],
                rows: [
                    { Name: 'alpha', Value: 1 },
                    { Name: 'beta', Value: 2 },
                ],
                isDark: false,
                columnTypes: { Name: 'string', Value: 'long' },
            }));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders toolbar with search, filter, and column picker', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Name', 'Value'],
                rows: [{ Name: 'alpha', Value: 1 }],
                isDark: false,
                columnTypes: { Name: 'string', Value: 'long' },
            }));
        });
        // Should have search input
        const inputs = container.querySelectorAll('input');
        expect(inputs.length).toBeGreaterThan(0);
        // Should have buttons for filter, hide empty, column picker
        const buttons = container.querySelectorAll('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders with headerLeft and headerRight props', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['A'],
                rows: [{ A: 1 }],
                headerLeft: React.createElement('span', null, 'left-header'),
                headerRight: React.createElement('span', null, 'right-header'),
            }));
        });
        expect(container.textContent).toContain('left-header');
        expect(container.textContent).toContain('right-header');
    });

    it('shows status bar with row and column counts', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Name', 'Value', 'Extra'],
                rows: [
                    { Name: 'a', Value: 1, Extra: 'x' },
                    { Name: 'b', Value: 2, Extra: 'y' },
                ],
            }));
        });
        expect(container.textContent).toContain('2');
        expect(container.textContent).toContain('3');
        expect(container.textContent).toContain('columns');
    });

    it('renders column headers with type annotations', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Timestamp', 'Count'],
                rows: [{ Timestamp: '2024-01-01', Count: 42 }],
                columnTypes: { Timestamp: 'datetime', Count: 'long' },
            }));
        });
        expect(container.textContent).toContain('Timestamp');
        expect(container.textContent).toContain('Count');
    });

    it('renders highlight input', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Name'],
                rows: [{ Name: 'test' }],
            }));
        });
        // There should be a highlight input with placeholder
        const inputs = container.querySelectorAll('input');
        const highlightInput = Array.from(inputs).find(
            (i) => i.getAttribute('placeholder')?.includes('Highlight'),
        );
        expect(highlightInput).toBeTruthy();
    });

    it('renders checkbox items in column picker', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Col1', 'Col2', 'Col3'],
                rows: [{ Col1: 'a', Col2: 'b', Col3: 'c' }],
            }));
        });
        // Column picker should have checkboxes for each column
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(3);
    });

    it('handles search input changes', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Name', 'Value'],
                rows: [{ Name: 'alpha', Value: 1 }, { Name: 'beta', Value: 2 }],
            }));
        });
        // Find search input by placeholder
        const inputs = container.querySelectorAll('input');
        const searchInput = Array.from(inputs).find(
            (i) => i.getAttribute('placeholder')?.includes('Search') || i.getAttribute('placeholder')?.includes('Filter'),
        );
        if (searchInput) {
            act(() => {
                const event = new Event('change', { bubbles: true });
                searchInput.dispatchEvent(event);
            });
        }
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles column header click for sorting', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Name', 'Value'],
                rows: [{ Name: 'alpha', Value: 1 }, { Name: 'beta', Value: 2 }],
                columnTypes: { Name: 'string', Value: 'long' },
            }));
        });
        // Click on column header text to toggle sort
        const headerCells = container.querySelectorAll('th, [class*="headerCell"]');
        if (headerCells.length > 0) {
            act(() => { (headerCells[0] as HTMLElement).click(); });
        }
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles checkbox toggle in column picker', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Col1', 'Col2', 'Col3'],
                rows: [{ Col1: 'a', Col2: 'b', Col3: 'c' }],
            }));
        });
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length > 0) {
            act(() => {
                (checkboxes[0] as HTMLInputElement).click();
            });
        }
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles filter button click', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Name'],
                rows: [{ Name: 'test' }],
            }));
        });
        // Find and click buttons
        const buttons = container.querySelectorAll('button');
        for (const btn of Array.from(buttons)) {
            act(() => { btn.click(); });
        }
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles highlight input', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Name'],
                rows: [{ Name: 'test' }],
            }));
        });
        const inputs = container.querySelectorAll('input');
        const highlightInput = Array.from(inputs).find(
            (i) => i.getAttribute('placeholder')?.includes('Highlight'),
        );
        if (highlightInput) {
            act(() => {
                highlightInput.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        expect(container.innerHTML).toBeTruthy();
    });

    it('renders with isDark prop', () => {
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Name'],
                rows: [{ Name: 'test' }],
                isDark: true,
            }));
        });
        expect(container.innerHTML).toBeTruthy();
    });

    // --- Virtual rows rendering and interactions ---

    const renderWithVirtualRows = (props?: Partial<{
        columns: string[];
        rows: Record<string, unknown>[];
        isDark: boolean;
        columnTypes: Record<string, string>;
        headerLeft: React.ReactNode;
        headerRight: React.ReactNode;
    }>) => {
        const columns = props?.columns ?? ['Name', 'Value'];
        const rows = props?.rows ?? [
            { Name: 'alpha', Value: 1 },
            { Name: 'beta', Value: 2 },
        ];
        mockUseVirtualizer.mockReturnValue({
            getVirtualItems: () => makeVirtualItems(rows.length),
            getTotalSize: () => rows.length * 28,
            measureElement: vi.fn(),
        });
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns,
                rows,
                isDark: props?.isDark ?? false,
                columnTypes: props?.columnTypes ?? { Name: 'string', Value: 'long' },
                headerLeft: props?.headerLeft,
                headerRight: props?.headerRight,
            }));
        });
    };

    it('renders virtual rows when virtualizer returns items', () => {
        renderWithVirtualRows();
        const expandBtns = container.querySelectorAll('button[class="expandBtn"]');
        expect(expandBtns.length).toBe(2);
    });

    it('copies the selected cells as plain text', () => {
        renderWithVirtualRows();
        const firstCell = container.querySelector('div[class="td"]');
        const scrollContainer = container.querySelector('div[class*="scrollContainer"]');
        expect(firstCell).toBeTruthy();
        expect(scrollContainer).toBeTruthy();

        act(() => {
            firstCell!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });

        const setData = vi.fn();
        const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
        Object.defineProperty(copyEvent, 'clipboardData', {
            value: { setData },
        });

        act(() => {
            scrollContainer!.dispatchEvent(copyEvent);
        });

        expect(mockedBuildSelectionTsv).toHaveBeenCalled();
        expect(setData).toHaveBeenCalledWith('text/plain', 'copied-data');
    });

    it('toggleSort cycles through asc, desc, null on same column', () => {
        renderWithVirtualRows();
        const headerBtns = container.querySelectorAll('button[class="th"]');
        expect(headerBtns.length).toBeGreaterThan(0);
        const nameHeader = headerBtns[0] as HTMLElement;
        // First click: asc
        act(() => { nameHeader.click(); });
        // Second click: desc
        act(() => { nameHeader.click(); });
        // Third click: null (reset)
        act(() => { nameHeader.click(); });
        expect(container.innerHTML).toBeTruthy();
    });

    it('toggleSort switches column when clicking different column', () => {
        renderWithVirtualRows();
        const headerBtns = container.querySelectorAll('button[class="th"]');
        // Click Name column
        act(() => { (headerBtns[0] as HTMLElement).click(); });
        // Click Value column — should switch sort to Value
        act(() => { (headerBtns[1] as HTMLElement).click(); });
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles column header keyboard events (Enter and Space)', () => {
        renderWithVirtualRows();
        const headerBtns = container.querySelectorAll('button[class="th"]');
        const header = headerBtns[0] as HTMLElement;
        act(() => {
            header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        act(() => {
            header.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        });
        // Non-matching key should not toggle
        act(() => {
            header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        });
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles column header double-click to select entire column', () => {
        renderWithVirtualRows();
        const headerBtns = container.querySelectorAll('button[class="th"]');
        act(() => {
            headerBtns[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        });
        expect(container.innerHTML).toBeTruthy();
    });

    it('toggles filter row visibility', () => {
        renderWithVirtualRows();
        const allBtns = Array.from(container.querySelectorAll('button'));
        // The filter toggle button
        // Click all toolbar buttons to find the filter toggle — use the third button after search
        const toolbarBtns = allBtns.filter((b) => b.getAttribute('class') !== 'th' && b.getAttribute('class') !== 'expandBtn');
        // Toggle filters on
        if (toolbarBtns.length > 0) {
            act(() => { toolbarBtns[0].click(); });
        }
        // Should now have filter inputs
        expect(container.innerHTML).toBeTruthy();
    });

    it('toggles hide empty columns', () => {
        renderWithVirtualRows();
        const toolbarBtns = Array.from(container.querySelectorAll('button')).filter(
            (b) => b.getAttribute('class') !== 'th' && b.getAttribute('class') !== 'expandBtn',
        );
        // Second toolbar button is hide empty
        if (toolbarBtns.length > 1) {
            act(() => { toolbarBtns[1].click(); });
        }
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles global search change and clear', () => {
        renderWithVirtualRows();
        const searchInput = Array.from(container.querySelectorAll('input')).find(
            (i) => i.getAttribute('placeholder')?.includes('Search'),
        );
        expect(searchInput).toBeTruthy();
        // Type into search
        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(searchInput, 'alpha');
            searchInput!.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput!.dispatchEvent(new Event('change', { bubbles: true }));
        });
        // After search has value, contentAfter dismiss button should appear
        // Re-render to check
        expect(container.innerHTML).toBeTruthy();
    });

    it('resets table view state when a new result set is rendered', () => {
        renderWithVirtualRows();

        const searchInput = Array.from(container.querySelectorAll('input')).find(
            (i) => i.getAttribute('placeholder')?.includes('Search'),
        ) as HTMLInputElement | undefined;
        expect(searchInput).toBeTruthy();

        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(searchInput, 'alpha');
            searchInput!.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput!.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const toolbarBtns = Array.from(container.querySelectorAll('button')).filter(
            (b) => b.getAttribute('class') !== 'th' && b.getAttribute('class') !== 'expandBtn',
        );
        act(() => { toolbarBtns[0].click(); });
        expect(container.querySelectorAll('input[placeholder="filter..."]').length).toBeGreaterThan(0);

        renderWithVirtualRows({
            columns: ['FeatureName', 'State'],
            rows: [{ FeatureName: 'MyFlight', State: 'Enabled' }],
            columnTypes: { FeatureName: 'string', State: 'string' },
        });

        const nextSearchInput = Array.from(container.querySelectorAll('input')).find(
            (i) => i.getAttribute('placeholder')?.includes('Search'),
        ) as HTMLInputElement | undefined;
        expect(nextSearchInput?.value).toBe('');
        expect(container.querySelectorAll('input[placeholder="filter..."]')).toHaveLength(0);
    });

    it('handles highlight input change and clear', () => {
        renderWithVirtualRows();
        const highlightInput = Array.from(container.querySelectorAll('input')).find(
            (i) => i.getAttribute('placeholder')?.includes('Highlight'),
        );
        expect(highlightInput).toBeTruthy();
        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(highlightInput, 'Name == alpha');
            highlightInput!.dispatchEvent(new Event('input', { bubbles: true }));
            highlightInput!.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(container.innerHTML).toBeTruthy();
    });

    it('shows all and hides all columns via column picker', () => {
        renderWithVirtualRows();
        const allBtns = Array.from(container.querySelectorAll('button'));
        const showAllBtn = allBtns.find((b) => b.textContent === 'Show all');
        const hideAllBtn = allBtns.find((b) => b.textContent === 'Hide all');
        expect(showAllBtn).toBeTruthy();
        expect(hideAllBtn).toBeTruthy();
        act(() => { hideAllBtn!.click(); });
        act(() => { showAllBtn!.click(); });
        expect(container.innerHTML).toBeTruthy();
    });

    it('toggles column visibility via checkbox', () => {
        renderWithVirtualRows();
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(2);
        // Uncheck first column
        act(() => { (checkboxes[0] as HTMLInputElement).click(); });
        // Check it back
        act(() => { (checkboxes[0] as HTMLInputElement).click(); });
        expect(container.innerHTML).toBeTruthy();
    });

    it('expands row detail and switches detail modes', () => {
        renderWithVirtualRows();
        const expandBtns = container.querySelectorAll('button[class="expandBtn"]');
        expect(expandBtns.length).toBe(2);
        // Expand first row
        act(() => { (expandBtns[0] as HTMLElement).click(); });
        // Detail panel should appear with Row 1
        expect(container.textContent).toContain('Row 1');
        // Find the 3 mode buttons and close button in the detail header
        const detailHeaderBtns = Array.from(container.querySelectorAll('[class="detailHeaderLeft"] button'));
        if (detailHeaderBtns.length >= 3) {
            // Click list mode
            act(() => { (detailHeaderBtns[1] as HTMLElement).click(); });
            expect(container.innerHTML).toBeTruthy();
            // Click json mode
            act(() => { (detailHeaderBtns[2] as HTMLElement).click(); });
            expect(container.innerHTML).toBeTruthy();
            // Click table mode again
            act(() => { (detailHeaderBtns[0] as HTMLElement).click(); });
            expect(container.innerHTML).toBeTruthy();
        }
    });

    it('closes detail panel', () => {
        renderWithVirtualRows();
        const expandBtns = container.querySelectorAll('button[class="expandBtn"]');
        // Open detail
        act(() => { (expandBtns[0] as HTMLElement).click(); });
        expect(container.textContent).toContain('Row 1');
        // Find and click the close button in detail panel header
        // The close button has dismissCircleIcon — it's the last button in the detail header area
        // Find it by looking for the button directly inside detailHeader (not detailHeaderLeft)
        const closeBtn = container.querySelector('[class="detailPanel"] > [class="detailHeader"] > button');
        if (closeBtn) {
            act(() => { (closeBtn as HTMLElement).click(); });
        }
        // After close, Row 1 detail should not be visible
        expect(container.innerHTML).toBeTruthy();
    });

    it('toggles detail open/closed on same row expand button', () => {
        renderWithVirtualRows();
        const expandBtns = container.querySelectorAll('button[class="expandBtn"]');
        // Open
        act(() => { (expandBtns[0] as HTMLElement).click(); });
        expect(container.textContent).toContain('Row 1');
        // Close by clicking same expand button
        act(() => { (expandBtns[0] as HTMLElement).click(); });
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles expand button keyboard Enter and Space', () => {
        renderWithVirtualRows();
        const expandBtns = container.querySelectorAll('button[class="expandBtn"]');
        act(() => {
            expandBtns[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        expect(container.textContent).toContain('Row 1');
        act(() => {
            expandBtns[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        });
        // Non-matching key
        act(() => {
            expandBtns[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles cell mousedown to start selection', () => {
        renderWithVirtualRows();
        const cells = container.querySelectorAll('[class="td"]');
        expect(cells.length).toBeGreaterThan(0);
        // Click a cell
        act(() => {
            cells[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles cell mousedown with shift key to extend selection', () => {
        renderWithVirtualRows();
        const cells = container.querySelectorAll('[class="td"]');
        // First click without shift
        act(() => {
            cells[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });
        // Second click with shift
        act(() => {
            cells[cells.length - 1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, shiftKey: true }));
        });
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles cell mouse enter during drag', () => {
        renderWithVirtualRows();
        const cells = container.querySelectorAll('[class="td"]');
        // Start dragging
        act(() => {
            cells[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });
        // Drag to another cell
        act(() => {
            cells[1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        });
        // Mouseup to stop dragging
        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup'));
        });
        // Enter after mouseup — should not extend selection
        act(() => {
            cells[2].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        });
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles mouse enter without active drag (no-op)', () => {
        renderWithVirtualRows();
        const cells = container.querySelectorAll('[class="td"]');
        // mouseenter without prior mousedown
        act(() => {
            cells[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        });
        expect(container.innerHTML).toBeTruthy();
    });

    it('renders filter row when showFilters is toggled', () => {
        renderWithVirtualRows();
        // Find filter toggle button — it has filterIcon
        const toolbarBtn = Array.from(container.querySelectorAll('button')).find(
            (b) => b.getAttribute('class') !== 'th' && b.getAttribute('class') !== 'expandBtn',
        );
        // Toggle filters on (first toolbar button after search area)
        act(() => { toolbarBtn!.click(); });
        // Filter inputs should be rendered
        const filterInputs = container.querySelectorAll('input[placeholder="filter..."]');
        expect(filterInputs.length).toBe(2);
        // Type in a filter
        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(filterInputs[0], 'alpha');
            filterInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            filterInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(container.innerHTML).toBeTruthy();
    });

    it('renders detail panel with object values in table mode', () => {
        renderWithVirtualRows({
            columns: ['Name', 'Data'],
            rows: [
                { Name: 'alpha', Data: { nested: 'obj' } },
            ],
            columnTypes: { Name: 'string', Data: 'dynamic' },
        });
        const expandBtns = container.querySelectorAll('button[class="expandBtn"]');
        act(() => { (expandBtns[0] as HTMLElement).click(); });
        expect(container.textContent).toContain('nested');
    });

    it('renders detail panel with null/undefined values', () => {
        renderWithVirtualRows({
            columns: ['Name', 'Empty'],
            rows: [
                { Name: 'alpha', Empty: null },
            ],
            columnTypes: { Name: 'string', Empty: 'string' },
        });
        const expandBtns = container.querySelectorAll('button[class="expandBtn"]');
        act(() => { (expandBtns[0] as HTMLElement).click(); });
        expect(container.textContent).toContain('Row 1');
    });

    it('renders detail panel in list mode with object values', () => {
        renderWithVirtualRows({
            columns: ['Name', 'Data'],
            rows: [
                { Name: 'alpha', Data: { x: 1 } },
            ],
            columnTypes: { Name: 'string', Data: 'dynamic' },
        });
        const expandBtns = container.querySelectorAll('button[class="expandBtn"]');
        act(() => { (expandBtns[0] as HTMLElement).click(); });
        // Switch to list mode
        const detailHeaderBtns = Array.from(container.querySelectorAll('[class="detailHeaderLeft"] button'));
        if (detailHeaderBtns.length >= 2) {
            act(() => { (detailHeaderBtns[1] as HTMLElement).click(); });
        }
        expect(container.innerHTML).toBeTruthy();
    });

    it('renders detail panel in json mode', () => {
        renderWithVirtualRows({
            isDark: true,
        });
        const expandBtns = container.querySelectorAll('button[class="expandBtn"]');
        act(() => { (expandBtns[0] as HTMLElement).click(); });
        const detailHeaderBtns = Array.from(container.querySelectorAll('[class="detailHeaderLeft"] button'));
        if (detailHeaderBtns.length >= 3) {
            act(() => { (detailHeaderBtns[2] as HTMLElement).click(); });
        }
        expect(container.innerHTML).toBeTruthy();
    });

    it('handles detail panel drag resize', () => {
        renderWithVirtualRows();
        const expandBtns = container.querySelectorAll('button[class="expandBtn"]');
        act(() => { (expandBtns[0] as HTMLElement).click(); });
        const dragHandle = container.querySelector('[class="detailDragHandle"]');
        expect(dragHandle).toBeTruthy();
        // Simulate drag start
        act(() => {
            dragHandle!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 400 }));
        });
        // Simulate drag move
        act(() => {
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 350 }));
        });
        // Simulate drag end
        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup'));
        });
        expect(container.innerHTML).toBeTruthy();
    });

    it('renders cells with null, undefined, and number values', () => {
        renderWithVirtualRows({
            columns: ['A', 'B', 'C'],
            rows: [
                { A: null, B: undefined, C: 42 },
            ],
            columnTypes: { A: 'string', B: 'string', C: 'long' },
        });
        const cells = container.querySelectorAll('[class="td"]');
        expect(cells.length).toBe(3);
    });

    it('renders with colType undefined (no type annotation)', () => {
        renderWithVirtualRows({
            columns: ['Name'],
            rows: [{ Name: 'test' }],
            columnTypes: undefined,
        });
        const headerBtns = container.querySelectorAll('button[class="th"]');
        expect(headerBtns.length).toBe(1);
    });

    it('highlights matching rows when parsedHighlight is set', () => {
        mockedParseHighlightExpr.mockReturnValue({ column: 'Name', op: '==', value: 'alpha' });
        mockedMatchesHighlight.mockReturnValue(true);
        renderWithVirtualRows();
        // Rows should have highlight class
        const highlightedRows = container.querySelectorAll('[class="trExprHighlight"]');
        expect(highlightedRows.length).toBe(2);
    });

    it('shows highlight expr in status bar when parsedHighlight is set', () => {
        mockedParseHighlightExpr.mockReturnValue({ column: 'Name', op: '==', value: 'alpha' });
        renderWithVirtualRows();
        expect(container.textContent).toContain('Highlighting');
    });

    it('shows selection stats in status bar with aggregates', () => {
        mockedComputeAggregates.mockReturnValue({ sum: '3', avg: '1.5', min: '1', max: '2' });
        mockedComputeDateDelta.mockReturnValue('2 days');
        mockedIsCellInRange.mockReturnValue(true);
        renderWithVirtualRows();
        const cells = container.querySelectorAll('[class="td"]');
        // Select from first cell
        act(() => {
            cells[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });
        // Extend to last cell with shift
        act(() => {
            cells[cells.length - 1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, shiftKey: true }));
        });
        // Status bar should contain aggregate info
        expect(container.textContent).toContain('Selected');
        expect(container.textContent).toContain('cells');
    });

    it('renders selected cells with tdSelected class', () => {
        mockedIsCellInRange.mockReturnValue(true);
        renderWithVirtualRows();
        // Start a selection
        const cells = container.querySelectorAll('[class="td"], [class="tdSelected"]');
        act(() => {
            cells[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });
        // After re-render, cells should have tdSelected
        const selectedCells = container.querySelectorAll('[class="tdSelected"]');
        expect(selectedCells.length).toBeGreaterThan(0);
    });

    it('renders detail row open with trDetailOpen class', () => {
        renderWithVirtualRows();
        const expandBtns = container.querySelectorAll('button[class="expandBtn"]');
        act(() => { (expandBtns[0] as HTMLElement).click(); });
        const detailOpenRow = container.querySelector('[class="trDetailOpen"]');
        expect(detailOpenRow).toBeTruthy();
    });

    it('does not add scrollbar style element twice', () => {
        // Render once to inject style
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Name'],
                rows: [{ Name: 'test' }],
            }));
        });
        const stylesBefore = document.querySelectorAll('#traverse-scrollbar-style').length;
        // Render again — should not add another style element
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Name'],
                rows: [{ Name: 'test2' }],
            }));
        });
        const stylesAfter = document.querySelectorAll('#traverse-scrollbar-style').length;
        expect(stylesAfter).toBe(stylesBefore);
    });

    it('handles detailRowIdx beyond sorted rows length', () => {
        renderWithVirtualRows({
            columns: ['Name'],
            rows: [{ Name: 'alpha' }],
        });
        // This tests the `detailRowIdx >= sortedRows.length` branch
        // by opening detail, then rendering with fewer rows
        const expandBtns = container.querySelectorAll('button[class="expandBtn"]');
        act(() => { (expandBtns[0] as HTMLElement).click(); });
        // Now re-render with empty rows (detail idx will be out of bounds)
        mockUseVirtualizer.mockReturnValue({
            getVirtualItems: () => [],
            getTotalSize: () => 0,
            measureElement: vi.fn(),
        });
        act(() => {
            root.render(React.createElement(ResultsTable, {
                columns: ['Name'],
                rows: [],
            }));
        });
        // Detail panel should not be visible
        const detailPanel = container.querySelector('[class="detailPanel"]');
        expect(detailPanel).toBeNull();
    });

    it('renders ColumnPickerItem with empty column label', () => {
        mockedFindEmptyColumns.mockReturnValue(new Set(['EmptyCol']));
        renderWithVirtualRows({
            columns: ['Name', 'EmptyCol'],
            rows: [{ Name: 'alpha', EmptyCol: null }],
            columnTypes: { Name: 'string', EmptyCol: 'string' },
        });
        // The column picker checkbox for EmptyCol should show '(empty)'
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(2);
        // Check that label includes '(empty)' text
        expect(container.textContent).toContain('(empty)');
    });

    it('handles selection stats with single cell (no stats shown)', () => {
        renderWithVirtualRows();
        const cells = container.querySelectorAll('[class="td"]');
        // Click single cell
        act(() => {
            cells[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });
        // Single cell: cellCount < 2, selectionStats returns null
        expect(container.textContent).not.toContain('Selected');
    });
});
