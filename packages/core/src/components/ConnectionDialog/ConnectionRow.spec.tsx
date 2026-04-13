
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ConnectionRow } from './ConnectionRow';

vi.mock('@fluentui/react-components', () => ({
    Button: (p: Record<string, unknown>) => React.createElement('button', { onClick: p['onClick'] as (() => void) | undefined, 'data-testid': 'btn' }, p['icon'] as React.ReactNode),
    Input: (p: Record<string, unknown>) => {
        const onChange = p['onChange'] as ((e: unknown, d: { value: string }) => void) | undefined;
        return React.createElement('input', { value: p['value'] as string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e, { value: e.target.value }), readOnly: p['readOnly'] as boolean });
    },
    Dropdown: (p: Record<string, unknown>) => {
        const onOpenChange = p['onOpenChange'] as ((e: unknown, d: { open: boolean }) => void) | undefined;
        const onOptionSelect = p['onOptionSelect'] as ((e: unknown, d: { optionValue?: string }) => void) | undefined;
        return React.createElement('select', { 'data-testid': 'dropdown', onFocus: () => onOpenChange?.(null, { open: true }), onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onOptionSelect?.(e, { optionValue: e.target.value }) });
    },
    Option: (p: Record<string, unknown>) => React.createElement('option', { value: p['value'] as string }, p['children'] as string),
    Spinner: () => React.createElement('span', null, 'Loading...'),
    Tooltip: (p: Record<string, unknown>) => React.createElement('span', null, p['children'] as React.ReactNode),
    tokens: new Proxy({}, { get: (_, p) => String(p) }),
}));
vi.mock('@fluentui/react-icons', () => ({
    DeleteRegular: () => React.createElement('span', null, '🗑'),
    ReOrderDotsVerticalRegular: () => React.createElement('span', null, '⋮'),
}));
vi.mock('../ExplorerWorkspace/ExplorerWorkspace.logic', () => ({
    CONNECTION_COLORS: ['#aaa', '#bbb', '#ccc'],
}));

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

const baseConn = { id: 'c1', name: 'Test', clusterUrl: 'https://test.kusto.windows.net', database: 'DB1', color: '#aaa' };
const baseProps = {
    conn: baseConn, idx: 0, canDelete: true, databases: ['DB1', 'DB2'], dbLoading: false, isDragOver: false,
    onUpdate: vi.fn(), onRemove: vi.fn(), onLoadDatabases: vi.fn(), onDragStart: vi.fn(), onDragOver: vi.fn(), onDragEnd: vi.fn(),
};

describe('ConnectionRow', () => {
    it('renders connection name and cluster URL', () => {
        act(() => { root.render(React.createElement(ConnectionRow, baseProps)); });
        const inputs = container.querySelectorAll('input');
        expect(inputs.length).toBeGreaterThanOrEqual(2);
    });

    it('calls onRemove when delete button clicked', () => {
        const onRemove = vi.fn();
        act(() => { root.render(React.createElement(ConnectionRow, { ...baseProps, onRemove })); });
        act(() => { container.querySelector('button[data-testid="btn"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
        expect(onRemove).toHaveBeenCalledWith('c1');
    });

    it('cycles color on dot click', () => {
        const onUpdate = vi.fn();
        act(() => { root.render(React.createElement(ConnectionRow, { ...baseProps, onUpdate })); });
        const dot = container.querySelector('[role="menuitem"]');
        act(() => { dot?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
        expect(onUpdate).toHaveBeenCalledWith('c1', 'color', '#bbb');
    });

    it('cycles color on dot Enter key', () => {
        const onUpdate = vi.fn();
        act(() => { root.render(React.createElement(ConnectionRow, { ...baseProps, onUpdate })); });
        const dot = container.querySelector('[role="menuitem"]');
        act(() => { dot?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
        expect(onUpdate).toHaveBeenCalledWith('c1', 'color', '#bbb');
    });

    it('shows spinner when dbLoading is true', () => {
        act(() => { root.render(React.createElement(ConnectionRow, { ...baseProps, dbLoading: true, databases: [] })); });
        expect(container.textContent).toContain('Loading...');
    });

    it('calls onDragStart on drag handle', () => {
        const onDragStart = vi.fn();
        act(() => { root.render(React.createElement(ConnectionRow, { ...baseProps, onDragStart })); });
        const handle = container.querySelector('[draggable]');
        if (handle) {
            act(() => { handle.dispatchEvent(new Event('dragstart', { bubbles: true })); });
            expect(onDragStart).toHaveBeenCalledWith(0);
        }
    });
});
