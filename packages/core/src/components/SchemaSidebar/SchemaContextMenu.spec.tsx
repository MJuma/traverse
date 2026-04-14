import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { SchemaContextMenu } from './SchemaContextMenu';

vi.mock('@fluentui/react-components', () => ({
    Menu: (p: Record<string, unknown>) => {
        const onOpenChange = p['onOpenChange'] as ((_: unknown, data: { open: boolean }) => void) | undefined;
        return p['open'] ? React.createElement('div', {
            'data-testid': 'menu',
            'data-has-open-change': onOpenChange ? 'true' : 'false',
            onClick: () => onOpenChange?.(null, { open: false }),
        }, p['children'] as React.ReactNode) : null;
    },
    MenuList: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    MenuItem: (p: Record<string, unknown>) => React.createElement('div', { onClick: p['onClick'] as () => void, role: 'menuitem' }, p['children'] as React.ReactNode),
    MenuPopover: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
}));
vi.mock('@fluentui/react-icons', () => ({
    TextAddRegular: () => React.createElement('span', null, 'text-add'),
    TableSearchRegular: () => React.createElement('span', null, 'table-search'),
    NumberSymbolRegular: () => React.createElement('span', null, 'number'),
    TextDescriptionRegular: () => React.createElement('span', null, 'text-desc'),
    CalendarRegular: () => React.createElement('span', null, 'calendar'),
}));

describe('SchemaContextMenu', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        container.remove();
        vi.restoreAllMocks();
    });

    const defaultProps = {
        tableName: 'StormEvents',
        x: 100,
        y: 200,
        insertText: vi.fn(),
        schemaContextRunQuery: vi.fn(),
        setSchemaContextMenu: vi.fn(),
        contextMenuClassName: 'ctx-menu',
        contextMenuItemClassName: 'ctx-item',
    };

    function findMenuItem(c: HTMLElement, label: string): HTMLElement | undefined {
        return Array.from(c.querySelectorAll('[role="menuitem"]')).find(
            (el) => el.textContent?.includes(label),
        ) as HTMLElement | undefined;
    }

    it('renders all five menu items', () => {
        act(() => { root.render(React.createElement(SchemaContextMenu, defaultProps)); });
        expect(container.textContent).toContain('Insert name');
        expect(container.textContent).toContain('Take 100');
        expect(container.textContent).toContain('Count rows');
        expect(container.textContent).toContain('Show schema');
        expect(container.textContent).toContain('Date range');
    });

    it('Insert name calls insertText with table name', () => {
        const insertText = vi.fn();
        const setMenu = vi.fn();
        act(() => { root.render(React.createElement(SchemaContextMenu, { ...defaultProps, insertText, setSchemaContextMenu: setMenu })); });
        const item = findMenuItem(container, 'Insert name');
        act(() => { item!.click(); });
        expect(insertText).toHaveBeenCalledWith('StormEvents');
        expect(setMenu).toHaveBeenCalledWith(null);
    });

    it('Take 100 runs the correct query', () => {
        const runQuery = vi.fn();
        const setMenu = vi.fn();
        act(() => { root.render(React.createElement(SchemaContextMenu, { ...defaultProps, schemaContextRunQuery: runQuery, setSchemaContextMenu: setMenu })); });
        const item = findMenuItem(container, 'Take 100');
        act(() => { item!.click(); });
        expect(runQuery).toHaveBeenCalledWith('StormEvents\n| take 100');
        expect(setMenu).toHaveBeenCalledWith(null);
    });

    it('Count rows runs the correct query', () => {
        const runQuery = vi.fn();
        const setMenu = vi.fn();
        act(() => { root.render(React.createElement(SchemaContextMenu, { ...defaultProps, schemaContextRunQuery: runQuery, setSchemaContextMenu: setMenu })); });
        const item = findMenuItem(container, 'Count rows');
        act(() => { item!.click(); });
        expect(runQuery).toHaveBeenCalledWith('StormEvents\n| count');
        expect(setMenu).toHaveBeenCalledWith(null);
    });

    it('Show schema runs the correct query', () => {
        const runQuery = vi.fn();
        const setMenu = vi.fn();
        act(() => { root.render(React.createElement(SchemaContextMenu, { ...defaultProps, schemaContextRunQuery: runQuery, setSchemaContextMenu: setMenu })); });
        const item = findMenuItem(container, 'Show schema');
        act(() => { item!.click(); });
        expect(runQuery).toHaveBeenCalledWith('StormEvents\n| getschema');
        expect(setMenu).toHaveBeenCalledWith(null);
    });

    it('Date range runs the correct query', () => {
        const runQuery = vi.fn();
        const setMenu = vi.fn();
        act(() => { root.render(React.createElement(SchemaContextMenu, { ...defaultProps, schemaContextRunQuery: runQuery, setSchemaContextMenu: setMenu })); });
        const item = findMenuItem(container, 'Date range');
        act(() => { item!.click(); });
        expect(runQuery).toHaveBeenCalledWith('StormEvents\n| take 1000\n| summarize min(Timestamp), max(Timestamp)');
        expect(setMenu).toHaveBeenCalledWith(null);
    });

    it('onOpenChange with open=false closes the menu', () => {
        const setMenu = vi.fn();
        act(() => { root.render(React.createElement(SchemaContextMenu, { ...defaultProps, setSchemaContextMenu: setMenu })); });
        const menu = container.querySelector('[data-testid="menu"]') as HTMLElement;
        expect(menu).toBeTruthy();
        // Clicking the menu div triggers onOpenChange({ open: false })
        act(() => { menu.click(); });
        expect(setMenu).toHaveBeenCalledWith(null);
    });

    it('onOpenChange with open=true does not close the menu', () => {
        const setMenu = vi.fn();
        act(() => { root.render(React.createElement(SchemaContextMenu, { ...defaultProps, setSchemaContextMenu: setMenu })); });
        // The menu is open — the handleOpenChange only calls setSchemaContextMenu when open=false
        // Since the menu is rendering (open=true), the setMenu should not have been called yet
        expect(setMenu).not.toHaveBeenCalled();
    });

    it('renders with different table name', () => {
        const runQuery = vi.fn();
        const setMenu = vi.fn();
        act(() => { root.render(React.createElement(SchemaContextMenu, { ...defaultProps, tableName: 'MyTable', schemaContextRunQuery: runQuery, setSchemaContextMenu: setMenu })); });
        const item = findMenuItem(container, 'Take 100');
        act(() => { item!.click(); });
        expect(runQuery).toHaveBeenCalledWith('MyTable\n| take 100');
    });
});
