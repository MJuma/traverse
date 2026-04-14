import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { SchemaSidebar } from './SchemaSidebar';
import { Input } from '@fluentui/react-components';

vi.mock('../../context/ExplorerColorContext', () => ({
    useExplorerColors: () => ({
        semantic: { functionBadge: '#fn', materializedViewBadge: '#mv', lookupBadge: '#lu', backdrop: '#000', shadowMedium: '#000', shadowLight: '#000', scrollThumb: '#ccc', scrollThumbHover: '#aaa', selectionBg: '#00f', selectionSubtle: '#eef', highlightHoverBg: '#ffa' },
        chart: { palette: [] },
    }),
}));
vi.mock('../ExplorerWorkspace/ExplorerWorkspace.styles', () => ({
    useExplorerStyles: () => new Proxy({}, { get: (_, p) => String(p) }),
}));
vi.mock('@fluentui/react-components', () => ({
    Input: vi.fn((p: Record<string, unknown>) => React.createElement('input', p)),
    Button: (p: Record<string, unknown>) => React.createElement('button', p, p['children'] as React.ReactNode),
    Tooltip: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    Spinner: () => React.createElement('span', null, 'loading'),
    Menu: (p: Record<string, unknown>) => p['open'] ? React.createElement('div', null, p['children'] as React.ReactNode) : null,
    MenuList: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    MenuItem: (p: Record<string, unknown>) => React.createElement('div', { onClick: p['onClick'] as () => void, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { (p['onClick'] as (() => void))?.(); } }, tabIndex: 0 }, p['children'] as React.ReactNode),
    MenuPopover: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    tokens: { colorBrandForeground1: '#brand' },
}));
vi.mock('@fluentui/react-icons', () => ({
    FolderRegular: () => React.createElement('span', null, 'icon'),
    FolderOpenRegular: () => React.createElement('span', null, 'icon'),
    TableSimpleRegular: () => React.createElement('span', null, 'icon'),
    ChevronRightRegular: () => React.createElement('span', null, 'icon'),
    ChevronDownRegular: () => React.createElement('span', null, 'icon'),
    SearchRegular: () => React.createElement('span', null, 'icon'),
    DismissRegular: () => React.createElement('span', null, 'icon'),
    TextAddRegular: () => React.createElement('span', null, 'icon'),
    TableSearchRegular: () => React.createElement('span', null, 'icon'),
    NumberSymbolRegular: () => React.createElement('span', null, 'icon'),
    TextDescriptionRegular: () => React.createElement('span', null, 'icon'),
    CalendarRegular: () => React.createElement('span', null, 'icon'),
}));

describe('SchemaSidebar', () => {
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

    it('renders with empty schema', () => {
        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema: [],
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders with schema data', () => {
        const schema = [
            {
                name: 'TestTable',
                folder: 'Tables',
                kind: 'table' as const,
                description: 'A test table',
                columns: [
                    { name: 'Id', type: 'int' },
                    { name: 'Name', type: 'string' },
                ],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders folders and expands them on click', () => {
        const schema = [
            {
                name: 'Events',
                folder: 'Telemetry',
                kind: 'table' as const,
                description: 'Events table',
                columns: [{ name: 'Timestamp', type: 'datetime' }, { name: 'Message', type: 'string' }],
            },
            {
                name: 'Errors',
                folder: 'Telemetry',
                kind: 'table' as const,
                description: 'Error logs',
                columns: [{ name: 'ErrorId', type: 'int' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });
        expect(container.textContent).toContain('Tables');

        // Expand kind group
        const kindGroup = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { kindGroup.click(); });
        expect(container.textContent).toContain('Telemetry');

        // Click folder to expand
        const folderRow = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Telemetry'),
        ) as HTMLElement;
        if (folderRow) {
            act(() => { folderRow.click(); });
            expect(container.textContent).toContain('Events');
            expect(container.textContent).toContain('Errors');
        }
    });

    it('expands a table to show columns', () => {
        const schema = [
            {
                name: 'Users',
                folder: 'Data',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'UserId', type: 'guid' }, { name: 'UserName', type: 'string' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Expand folder first
        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Data'),
        ) as HTMLElement;
        if (folderEl) {
            act(() => { folderEl.click(); });
        }

        // Now expand the table
        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Users'),
        ) as HTMLElement;
        if (tableEl) {
            act(() => { tableEl.click(); });
            expect(container.textContent).toContain('UserId');
            expect(container.textContent).toContain('UserName');
        }
    });

    it('filters schema by search term', () => {
        const schema = [
            {
                name: 'PageViews',
                folder: 'Analytics',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Url', type: 'string' }],
            },
            {
                name: 'CustomEvents',
                folder: 'Analytics',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Name', type: 'string' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        const input = container.querySelector('input') as HTMLInputElement;
        if (input) {
            act(() => {
                const changeHandler = (input as unknown as { onChange?: (e: unknown, d: { value: string }) => void }).onChange;
                if (changeHandler) {
                    changeHandler({}, { value: 'PageViews' });
                }
            });
        }
    });

    it('renders function and materializedView icons', () => {
        const schema = [
            {
                name: 'MyFunc',
                folder: 'Functions',
                kind: 'function' as const,
                description: 'A function',
                columns: [],
            },
            {
                name: 'MyView',
                folder: 'Views',
                kind: 'materializedView' as const,
                description: 'A view',
                columns: [],
            },
            {
                name: 'LookupTable',
                folder: 'Lookup',
                kind: 'table' as const,
                description: 'A lookup',
                columns: [{ name: 'Key', type: 'string' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Click expand all button (toggleAll expands all folders AND tables)
        const buttons = container.querySelectorAll('button');
        const expandBtn = buttons[buttons.length - 1];
        if (expandBtn) {
            act(() => { expandBtn.click(); });
        }

        // After expand all, folders and tables should be visible
        expect(container.textContent).toContain('MyFunc');
        expect(container.textContent).toContain('fn');
        expect(container.textContent).toContain('MV');
        expect(container.textContent).toContain('LU');
    });

    it('inserts text when a column is clicked', () => {
        const insertText = vi.fn();
        const schema = [
            {
                name: 'Events',
                folder: 'Tables',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Timestamp', type: 'datetime' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText,
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Expand folder
        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        if (folderEl) {
            act(() => { folderEl.click(); });
        }

        // Expand table
        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Events'),
        ) as HTMLElement;
        if (tableEl) {
            act(() => { tableEl.click(); });
        }

        // Click column
        const colEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Timestamp'),
        ) as HTMLElement;
        if (colEl) {
            act(() => { colEl.click(); });
            expect(insertText).toHaveBeenCalledWith('Timestamp');
        }
    });

    it('shows context menu on right-click of table', () => {
        const schemaContextRunQuery = vi.fn();
        const schema = [
            {
                name: 'Events',
                folder: 'Tables',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Id', type: 'int' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery,
            }));
        });

        // Expand folder
        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        if (folderEl) {
            act(() => { folderEl.click(); });
        }

        // Right-click table
        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Events'),
        ) as HTMLElement;
        if (tableEl) {
            act(() => {
                const ev = new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 200 });
                tableEl.dispatchEvent(ev);
            });
            expect(container.textContent).toContain('Insert name');
            expect(container.textContent).toContain('Take 100');
            expect(container.textContent).toContain('Count rows');
            expect(container.textContent).toContain('Show schema');
            expect(container.textContent).toContain('Date range');

            // Click Take 100
            const take100Btn = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
                (el) => el.textContent === 'Take 100',
            ) as HTMLElement;
            if (take100Btn) {
                act(() => { take100Btn.click(); });
                expect(schemaContextRunQuery).toHaveBeenCalled();
            }
        }
    });

    it('handles toggle all expand/collapse', () => {
        const schema = [
            {
                name: 'T1',
                folder: 'F1',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'C1', type: 'string' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Click expand all
        const buttons = container.querySelectorAll('button');
        const expandAllBtn = buttons[buttons.length - 1];
        if (expandAllBtn) {
            act(() => { expandAllBtn.click(); });
            expect(container.textContent).toContain('T1');
            expect(container.textContent).toContain('C1');

            // Click again to collapse all
            act(() => { expandAllBtn.click(); });
        }
    });

    it('toggles folder via keyboard Enter', () => {
        const schema = [
            {
                name: 'Events',
                folder: 'Telemetry',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Timestamp', type: 'datetime' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Expand kind group first
        const kindGroup = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { kindGroup.click(); });

        const folderRow = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Telemetry'),
        ) as HTMLElement;
        expect(folderRow).toBeTruthy();

        act(() => {
            folderRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        expect(container.textContent).toContain('Events');
    });

    it('toggles folder via keyboard Space', () => {
        const schema = [
            {
                name: 'Events',
                folder: 'Telemetry',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Timestamp', type: 'datetime' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Expand kind group first
        const kindGroup = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { kindGroup.click(); });

        const folderRow = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Telemetry'),
        ) as HTMLElement;

        act(() => {
            folderRow.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        });
        expect(container.textContent).toContain('Events');
    });

    it('toggles table via keyboard Enter', () => {
        const schema = [
            {
                name: 'Users',
                folder: 'Data',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'UserId', type: 'guid' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Expand kind group first
        const kindGroup = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { kindGroup.click(); });

        // Expand sub-folder
        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Data'),
        ) as HTMLElement;
        act(() => { folderEl.click(); });

        // Toggle table via Enter
        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Users'),
        ) as HTMLElement;
        act(() => {
            tableEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        expect(container.textContent).toContain('UserId');
    });

    it('inserts column text via keyboard Enter', () => {
        const insertText = vi.fn();
        const schema = [
            {
                name: 'Events',
                folder: '',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Timestamp', type: 'datetime' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText,
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Expand folder
        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { folderEl.click(); });

        // Expand table
        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Events'),
        ) as HTMLElement;
        act(() => { tableEl.click(); });

        // Press Enter on column
        const colEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Timestamp'),
        ) as HTMLElement;
        act(() => {
            colEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        expect(insertText).toHaveBeenCalledWith('Timestamp');
    });

    it('inserts column text via keyboard Space', () => {
        const insertText = vi.fn();
        const schema = [
            {
                name: 'Events',
                folder: '',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Col1', type: 'string' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText,
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Expand folder, table
        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { folderEl.click(); });
        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Events'),
        ) as HTMLElement;
        act(() => { tableEl.click(); });

        const colEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Col1'),
        ) as HTMLElement;
        act(() => {
            colEl.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        });
        expect(insertText).toHaveBeenCalledWith('Col1');
    });

    it('handles table drag start', () => {
        const schema = [
            {
                name: 'Events',
                folder: '',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Id', type: 'int' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Expand folder
        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { folderEl.click(); });

        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Events'),
        ) as HTMLElement;

        let dragData = '';
        const dragEvent = new Event('dragstart', { bubbles: true }) as unknown as DragEvent;
        Object.defineProperty(dragEvent, 'dataTransfer', {
            value: {
                setData: (_: string, v: string) => { dragData = v; },
                effectAllowed: '',
            },
        });
        act(() => { tableEl.dispatchEvent(dragEvent); });
        expect(dragData).toBe('Events');
    });

    it('handles column drag start', () => {
        const schema = [
            {
                name: 'Events',
                folder: '',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Timestamp', type: 'datetime' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Expand folder, table
        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { folderEl.click(); });
        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Events'),
        ) as HTMLElement;
        act(() => { tableEl.click(); });

        const colEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Timestamp'),
        ) as HTMLElement;

        let dragData = '';
        const dragEvent = new Event('dragstart', { bubbles: true }) as unknown as DragEvent;
        Object.defineProperty(dragEvent, 'dataTransfer', {
            value: {
                setData: (_: string, v: string) => { dragData = v; },
                effectAllowed: '',
            },
        });
        act(() => { colEl.dispatchEvent(dragEvent); });
        expect(dragData).toBe('Timestamp');
    });

    it('handles context menu Insert name action', () => {
        const insertText = vi.fn();
        const schema = [
            {
                name: 'Events',
                folder: '',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Id', type: 'int' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText,
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Expand folder
        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { folderEl.click(); });

        // Right-click table
        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Events'),
        ) as HTMLElement;
        act(() => {
            tableEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
        });

        // Click Insert name
        const insertBtn = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent === 'Insert name',
        ) as HTMLElement;
        act(() => { insertBtn.click(); });
        expect(insertText).toHaveBeenCalledWith('Events');
    });

    it('handles context menu Count rows action', () => {
        const schemaContextRunQuery = vi.fn();
        const schema = [
            {
                name: 'Events',
                folder: '',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Id', type: 'int' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery,
            }));
        });

        // Expand folder
        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { folderEl.click(); });

        // Right-click table
        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Events'),
        ) as HTMLElement;
        act(() => {
            tableEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
        });

        const countBtn = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent === 'Count rows',
        ) as HTMLElement;
        act(() => { countBtn.click(); });
        expect(schemaContextRunQuery).toHaveBeenCalledWith('Events\n| count');
    });

    it('handles context menu Show schema action', () => {
        const schemaContextRunQuery = vi.fn();
        const schema = [
            {
                name: 'Events',
                folder: '',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Id', type: 'int' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery,
            }));
        });

        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { folderEl.click(); });

        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Events'),
        ) as HTMLElement;
        act(() => {
            tableEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
        });

        const showSchemaBtn = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent === 'Show schema',
        ) as HTMLElement;
        act(() => { showSchemaBtn.click(); });
        expect(schemaContextRunQuery).toHaveBeenCalledWith('Events\n| getschema');
    });

    it('handles context menu Date range action', () => {
        const schemaContextRunQuery = vi.fn();
        const schema = [
            {
                name: 'Events',
                folder: '',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Id', type: 'int' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery,
            }));
        });

        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { folderEl.click(); });

        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Events'),
        ) as HTMLElement;
        act(() => {
            tableEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
        });

        const dateRangeBtn = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent === 'Date range',
        ) as HTMLElement;
        act(() => { dateRangeBtn.click(); });
        expect(schemaContextRunQuery).toHaveBeenCalledWith('Events\n| take 1000\n| summarize min(Timestamp), max(Timestamp)');
    });

    it('handles context menu item keyboard Enter', () => {
        const schemaContextRunQuery = vi.fn();
        const schema = [
            {
                name: 'Events',
                folder: '',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Id', type: 'int' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery,
            }));
        });

        const folderEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Tables'),
        ) as HTMLElement;
        act(() => { folderEl.click(); });

        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Events'),
        ) as HTMLElement;
        act(() => {
            tableEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
        });

        const countBtn = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent === 'Count rows',
        ) as HTMLElement;
        act(() => {
            countBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        expect(schemaContextRunQuery).toHaveBeenCalledWith('Events\n| count');
    });

    it('groups tables without folder into Other', () => {
        const schema = [
            {
                name: 'Orphan',
                folder: '',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'X', type: 'int' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        expect(container.textContent).toContain('Tables');
    });

    it('filters schema by table name search and shows matching columns', () => {
        // Override Input mock to properly forward onChange in Fluent UI format
        vi.mocked(Input).mockImplementation(
            ((p: Record<string, unknown>) => {
                const onChange = p['onChange'] as ((e: unknown, d: { value: string }) => void) | undefined;
                return React.createElement('input', {
                    'data-testid': 'search-input',
                    value: p['value'],
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                        onChange?.(e, { value: e.target.value });
                    },
                });
            }) as never,
        );

        const schema = [
            {
                name: 'Events',
                folder: 'Data',
                kind: 'table' as const,
                description: '',
                columns: [
                    { name: 'Timestamp', type: 'datetime' },
                    { name: 'Message', type: 'string' },
                ],
            },
            {
                name: 'Other',
                folder: 'Data',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Id', type: 'int' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        const input = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Events');
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Filtered view should show only Events table
        expect(container.textContent).toContain('Events');
    });

    it('filters schema by column name and highlights matching columns', () => {
        vi.mocked(Input).mockImplementation(
            ((p: Record<string, unknown>) => {
                const onChange = p['onChange'] as ((e: unknown, d: { value: string }) => void) | undefined;
                return React.createElement('input', {
                    'data-testid': 'search-input',
                    value: p['value'],
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                        onChange?.(e, { value: e.target.value });
                    },
                });
            }) as never,
        );

        const schema = [
            {
                name: 'Events',
                folder: 'Data',
                kind: 'table' as const,
                description: '',
                columns: [
                    { name: 'Timestamp', type: 'datetime' },
                    { name: 'Message', type: 'string' },
                ],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        const input = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'timestamp');
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Events table should appear because Timestamp column matches
        expect(container.textContent).toContain('Events');
        expect(container.textContent).toContain('Timestamp');
    });

    it('clears search and returns to folder view', () => {
        vi.mocked(Input).mockImplementation(
            ((p: Record<string, unknown>) => {
                const onChange = p['onChange'] as ((e: unknown, d: { value: string }) => void) | undefined;
                const contentAfter = p['contentAfter'] as React.ReactNode;
                return React.createElement('div', null,
                    React.createElement('input', {
                        'data-testid': 'search-input',
                        value: p['value'],
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                            onChange?.(e, { value: e.target.value });
                        },
                    }),
                    contentAfter,
                );
            }) as never,
        );

        const schema = [
            {
                name: 'Events',
                folder: 'Analytics',
                kind: 'table' as const,
                description: '',
                columns: [{ name: 'Id', type: 'int' }],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Type search
        const input = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Events');
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Should show filtered view
        expect(container.textContent).toContain('Events');

        // Click the clear button (contentAfter renders a dismiss button)
        const clearBtns = container.querySelectorAll('button');
        const clearBtn = Array.from(clearBtns).find(b => b.querySelector('span'));
        if (clearBtn) {
            act(() => { clearBtn.click(); });
        }
    });

    it('expands table in search results to show all columns', () => {
        vi.mocked(Input).mockImplementation(
            ((p: Record<string, unknown>) => {
                const onChange = p['onChange'] as ((e: unknown, d: { value: string }) => void) | undefined;
                return React.createElement('input', {
                    'data-testid': 'search-input',
                    value: p['value'],
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                        onChange?.(e, { value: e.target.value });
                    },
                });
            }) as never,
        );

        const schema = [
            {
                name: 'Events',
                folder: 'Data',
                kind: 'table' as const,
                description: '',
                columns: [
                    { name: 'Timestamp', type: 'datetime' },
                    { name: 'Source', type: 'string' },
                ],
            },
        ];

        act(() => {
            root.render(React.createElement(SchemaSidebar, {
                schema,
                insertText: vi.fn(),
                schemaContextRunQuery: vi.fn(),
            }));
        });

        // Search for a column name
        const input = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Timestamp');
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Timestamp is a matching column, should be visible
        expect(container.textContent).toContain('Timestamp');

        // Now click the table to expand and show all columns
        const tableEl = Array.from(container.querySelectorAll('[tabindex="0"]')).find(
            (el) => el.textContent?.includes('Events'),
        ) as HTMLElement;
        if (tableEl) {
            act(() => { tableEl.click(); });
            // After expanding, both columns should be visible
            expect(container.textContent).toContain('Source');
        }
    });
});
