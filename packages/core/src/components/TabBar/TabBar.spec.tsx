import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { TabBar } from './TabBar';

vi.mock('../../context/ExplorerStateContext', () => ({
    useExplorerState: () => mockTabBarState(),
    useExplorerDispatch: () => mockTabBarDispatch,
}));
vi.mock('../ExplorerWorkspace/ExplorerWorkspace.styles', () => ({
    useExplorerStyles: () => new Proxy({}, { get: (_, p) => String(p) }),
}));
vi.mock('@fluentui/react-components', () => ({
    Button: (p: Record<string, unknown>) => React.createElement('button', p, p['children'] as React.ReactNode),
    Tooltip: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    Menu: (p: Record<string, unknown>) => p['open'] ? React.createElement('div', null, p['children'] as React.ReactNode) : null,
    MenuList: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    MenuItem: (p: Record<string, unknown>) => React.createElement('div', { onClick: p['onClick'] as (() => void) }, p['children'] as React.ReactNode),
    MenuPopover: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    MenuDivider: () => React.createElement('hr'),
    Dialog: (p: Record<string, unknown>) => p['open'] ? React.createElement('div', null, p['children'] as React.ReactNode) : null,
    DialogSurface: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    DialogBody: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    DialogTitle: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    DialogContent: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    DialogActions: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    DialogTrigger: (p: Record<string, unknown>) => React.createElement('div', null, p['children'] as React.ReactNode),
    tokens: { colorBrandStroke1: '#blue', colorBrandBackground: '#blue', colorPaletteGreenBackground3: '#green' },
}));
vi.mock('@fluentui/react-icons', () => ({
    AddRegular: () => React.createElement('span', null, 'icon'),
    DismissRegular: () => React.createElement('span', null, 'icon'),
    SplitVerticalRegular: () => React.createElement('span', null, 'icon'),
    SplitHorizontalRegular: () => React.createElement('span', null, 'icon'),
    RenameRegular: () => React.createElement('span', null, 'icon'),
    CopyRegular: () => React.createElement('span', null, 'icon'),
    DismissCircleRegular: () => React.createElement('span', null, 'icon'),
}));

const defaultTabBarState = {
    tabs: [{ id: '1', query: '', title: 'Tab 1', kql: '', connectionId: 'test-conn' }],
    activeTabId: '1',
    splitEnabled: false,
    splitDirection: 'vertical' as 'vertical' | 'horizontal',
    splitTabId: null as string | null,
    focusedPane: 'primary' as 'primary' | 'secondary',
    connections: [{ id: 'test-conn', name: 'Test Cluster', clusterUrl: 'https://help.kusto.windows.net', database: 'Telemetry', color: '#909d63' }],
};
const mockTabBarState = vi.fn(() => defaultTabBarState);
const mockTabBarDispatch = vi.fn();


describe('TabBar', () => {
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
        mockTabBarState.mockReturnValue(defaultTabBarState);
        mockTabBarDispatch.mockClear();
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('renders without crashing', () => {
        const dragTabIdRef = { current: null };
        const onSetEditorDropTarget = vi.fn();

        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget }));
        });
        expect(container.innerHTML).not.toBe('');
    });

    it('renders multiple tabs', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
                { id: '3', query: '', title: 'Tab 3', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        expect(container.textContent).toContain('Tab 1');
        expect(container.textContent).toContain('Tab 2');
        expect(container.textContent).toContain('Tab 3');
    });

    it('switches tab on click', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEls = container.querySelectorAll('[tabindex="0"]');
        const tab2 = Array.from(tabEls).find((el) => el.textContent?.includes('Tab 2'));
        if (tab2) {
            act(() => { (tab2 as HTMLElement).click(); });
            expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'SWITCH_TAB', tabId: '2' });
        }
    });

    it('adds a new tab when add button is clicked', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const buttons = container.querySelectorAll('button');
        const addBtn = buttons[0];
        if (addBtn) {
            act(() => { addBtn.click(); });
            expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'ADD_TAB' });
        }
    });

    it('closes a tab when close button is clicked', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        // Close buttons are spans with 'icon' text inside tabs
        const closeSpans = container.querySelectorAll('span');
        const closeBtn = Array.from(closeSpans).filter((s) => s.textContent === 'icon' && s.parentElement?.getAttribute('tabindex') === '0');
        if (closeBtn.length > 0) {
            act(() => { (closeBtn[0] as HTMLElement).click(); });
            expect(mockTabBarDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'CLOSE_TAB' }));
        }
    });

    it('starts rename on double click', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        if (tabEl) {
            act(() => {
                tabEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            });
            // Should show an input for renaming
            const input = container.querySelector('input');
            expect(input).toBeTruthy();
        }
    });

    it('commits rename on Enter', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        if (tabEl) {
            act(() => {
                tabEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            });
            const input = container.querySelector('input') as HTMLInputElement;
            if (input) {
                act(() => {
                    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'New Name');
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });
                act(() => {
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                });
                expect(mockTabBarDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'RENAME_TAB' }));
            }
        }
    });

    it('opens context menu on right click', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        if (tabEl) {
            act(() => {
                const ev = new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 });
                tabEl.dispatchEvent(ev);
            });
            expect(container.textContent).toContain('Rename');
        }
    });

    it('toggles split vertical', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        // Split buttons are the last two regular buttons
        const buttons = container.querySelectorAll('button');
        const splitVertBtn = buttons[buttons.length - 2];
        if (splitVertBtn) {
            act(() => { splitVertBtn.click(); });
            expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_SPLIT', direction: 'vertical' });
        }
    });

    it('toggles split horizontal', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const buttons = container.querySelectorAll('button');
        const splitHorizBtn = buttons[buttons.length - 1];
        if (splitHorizBtn) {
            act(() => { splitHorizBtn.click(); });
            expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_SPLIT', direction: 'horizontal' });
        }
    });

    it('renders with split enabled showing primary/secondary markers', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
            splitEnabled: true,
            splitTabId: '2',
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        expect(container.textContent).toContain('L');
        expect(container.textContent).toContain('R');
    });

    it('handles keyboard navigation on tab', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        if (tabEl) {
            act(() => {
                tabEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            });
            expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'SWITCH_TAB', tabId: '1' });
        }
    });

    it('switches tab on Space keydown', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEls = container.querySelectorAll('[tabindex="0"]');
        const tab2 = Array.from(tabEls).find((el) => el.textContent?.includes('Tab 2')) as HTMLElement;
        expect(tab2).toBeTruthy();
        act(() => {
            tab2.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        });
        expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'SWITCH_TAB', tabId: '2' });
    });

    it('does not switch tab on unrelated key', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        expect(tabEl).toBeTruthy();
        mockTabBarDispatch.mockClear();
        act(() => {
            tabEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        });
        expect(mockTabBarDispatch).not.toHaveBeenCalled();
    });

    it('cancels rename on Escape', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        act(() => {
            tabEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        });
        const input = container.querySelector('input') as HTMLInputElement;
        expect(input).toBeTruthy();
        act(() => {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
        expect(container.querySelector('input')).toBeNull();
        expect(mockTabBarDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RENAME_TAB' }));
    });

    it('commits rename on blur', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        act(() => {
            tabEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        });
        const input = container.querySelector('input') as HTMLInputElement;
        expect(input).toBeTruthy();
        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Blurred Name');
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        act(() => {
            input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        });
        expect(mockTabBarDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'RENAME_TAB', title: 'Blurred Name' }));
    });

    it('does not dispatch rename when value is whitespace only', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        act(() => {
            tabEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        });
        const input = container.querySelector('input') as HTMLInputElement;
        expect(input).toBeTruthy();
        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '   ');
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        act(() => {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        expect(mockTabBarDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RENAME_TAB' }));
    });

    it('clicking the rename input does not switch tab', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        act(() => {
            tabEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        });
        const input = container.querySelector('input') as HTMLInputElement;
        expect(input).toBeTruthy();
        mockTabBarDispatch.mockClear();
        act(() => {
            input.click();
        });
        expect(mockTabBarDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SWITCH_TAB' }));
    });

    it('does not show close button for a single tab', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [{ id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' }],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        expect(tabEl).toBeTruthy();
        const closeSpans = tabEl.querySelectorAll('[tabindex="0"]');
        expect(closeSpans.length).toBe(0);
    });

    it('closes tab via keyboard Enter on close button', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const closeSpan = container.querySelector('.queryTabClose') as HTMLElement;
        expect(closeSpan).toBeTruthy();
        act(() => {
            closeSpan.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        expect(mockTabBarDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'CLOSE_TAB' }));
    });

    it('closes tab via keyboard Space on close button', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const closeSpan = container.querySelector('.queryTabClose') as HTMLElement;
        expect(closeSpan).toBeTruthy();
        act(() => {
            closeSpan.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        });
        expect(mockTabBarDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'CLOSE_TAB' }));
    });

    it('does not close tab on unrelated key on close button', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const closeSpan = container.querySelector('.queryTabClose') as HTMLElement;
        expect(closeSpan).toBeTruthy();
        mockTabBarDispatch.mockClear();
        act(() => {
            closeSpan.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        });
        expect(mockTabBarDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'CLOSE_TAB' }));
    });

    it('handles drag start, drag over, drop, and drag end', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
                { id: '3', query: '', title: 'Tab 3', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef: { current: string | null } = { current: null };
        const onSetEditorDropTarget = vi.fn();
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget }));
        });
        const tabEls = container.querySelectorAll('[tabindex="0"]');
        const tab1 = Array.from(tabEls).find((el) => el.textContent?.includes('Tab 1')) as HTMLElement;
        const tab3 = Array.from(tabEls).find((el) => el.textContent?.includes('Tab 3')) as HTMLElement;
        expect(tab1).toBeTruthy();
        expect(tab3).toBeTruthy();

        // Drag start on first tab
        const dragStartEvent = new Event('dragstart', { bubbles: true });
        (dragStartEvent as unknown as Record<string, unknown>)['dataTransfer'] = { setData: vi.fn(), effectAllowed: '' };
        act(() => {
            tab1.dispatchEvent(dragStartEvent);
        });
        expect(dragTabIdRef.current).toBe('1');

        // Drag over third tab
        const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true });
        (dragOverEvent as unknown as Record<string, unknown>)['dataTransfer'] = { dropEffect: '' };
        act(() => {
            tab3.dispatchEvent(dragOverEvent);
        });

        // Drop on third tab
        act(() => {
            tab3.dispatchEvent(new Event('drop', { bubbles: true }));
        });
        expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'REORDER_TABS', fromIdx: 0, toIdx: 2 });

        // Drag end
        act(() => {
            tab1.dispatchEvent(new Event('dragend', { bubbles: true }));
        });
        expect(dragTabIdRef.current).toBeNull();
        expect(onSetEditorDropTarget).toHaveBeenCalledWith(null);
    });

    it('does not reorder when dropping on same position', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef: { current: string | null } = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEls = container.querySelectorAll('[tabindex="0"]');
        const tab1 = Array.from(tabEls).find((el) => el.textContent?.includes('Tab 1')) as HTMLElement;

        const dragStart = new Event('dragstart', { bubbles: true });
        (dragStart as unknown as Record<string, unknown>)['dataTransfer'] = { setData: vi.fn(), effectAllowed: '' };
        act(() => {
            tab1.dispatchEvent(dragStart);
        });
        mockTabBarDispatch.mockClear();
        act(() => {
            tab1.dispatchEvent(new Event('drop', { bubbles: true }));
        });
        expect(mockTabBarDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'REORDER_TABS' }));
    });

    it('renames from context menu', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        act(() => {
            tabEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
        });
        const renameItem = Array.from(container.querySelectorAll('div')).find((el) => el.textContent === 'Rename') as HTMLElement;
        expect(renameItem).toBeTruthy();
        act(() => {
            renameItem.click();
        });
        const input = container.querySelector('input');
        expect(input).toBeTruthy();
    });

    it('closes from context menu with multiple tabs', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEls = container.querySelectorAll('[tabindex="0"]');
        const tab2 = Array.from(tabEls).find((el) => el.textContent?.includes('Tab 2')) as HTMLElement;
        act(() => {
            tab2.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
        });
        const closeItem = Array.from(container.querySelectorAll('div')).find((el) => el.textContent === 'Close') as HTMLElement;
        expect(closeItem).toBeTruthy();
        act(() => {
            closeItem.click();
        });
        // Tab has no content so it closes directly
        expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'CLOSE_TAB', tabId: '2' });
    });

    it('does not show close in context menu for single tab', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [{ id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' }],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        act(() => {
            tabEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
        });
        const closeItem = Array.from(container.querySelectorAll('div')).find((el) => el.textContent === 'Close');
        expect(closeItem).toBeUndefined();
    });

    it('closes context menu on document click', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        act(() => {
            tabEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
        });
        expect(container.textContent).toContain('Rename');
        act(() => {
            document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        const renameItem = Array.from(container.querySelectorAll('[tabindex="0"]')).find((el) => el.textContent === 'Rename');
        expect(renameItem).toBeUndefined();
    });

    it('tab is not draggable when renaming', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        expect(tabEl.getAttribute('draggable')).toBe('true');
        act(() => {
            tabEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        });
        const tabAfterRename = container.querySelector('[tabindex="0"]') as HTMLElement;
        expect(tabAfterRename.getAttribute('draggable')).toBe('false');
    });

    it('does not show primary marker when split is disabled', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
            splitEnabled: false,
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        expect(container.textContent).not.toContain('\u2460');
        expect(container.textContent).not.toContain('\u2461');
    });

    it('marks secondary pane tab as active when focusedPane is secondary', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
            splitEnabled: true,
            splitTabId: '2',
            focusedPane: 'secondary' as const,
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEls = container.querySelectorAll('[tabindex="0"]');
        const tab2 = Array.from(tabEls).find((el) => el.textContent?.includes('Tab 2')) as HTMLElement;
        expect(tab2).toBeTruthy();
        expect(tab2.className).toBe('queryTabActive');
    });

    it('applies activeFilter class to split vertical button when split is vertical', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            splitEnabled: true,
            splitDirection: 'vertical' as const,
            splitTabId: '1',
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const buttons = container.querySelectorAll('button');
        const splitVertBtn = buttons[buttons.length - 2];
        expect(splitVertBtn.className).toBe('activeFilter');
    });

    it('applies activeFilter class to split horizontal button when split is horizontal', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            splitEnabled: true,
            splitDirection: 'horizontal' as const,
            splitTabId: '1',
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const buttons = container.querySelectorAll('button');
        const splitHorizBtn = buttons[buttons.length - 1];
        expect(splitHorizBtn.className).toBe('activeFilter');
    });

    it('renders zero tabs without crashing', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [],
            activeTabId: '',
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        expect(container.innerHTML).not.toBe('');
        const tabItems = container.querySelectorAll('[draggable]');
        expect(tabItems.length).toBe(0);
    });

    it('does not dispatch close when unrelated key pressed on context menu items', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        act(() => {
            tabEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
        });
        // Fluent UI Menu handles keyboard nav internally; just verify the menu rendered
        const closeItem = Array.from(container.querySelectorAll('div')).find((el) => el.textContent === 'Close');
        expect(closeItem).toBeTruthy();
        mockTabBarDispatch.mockClear();
        // Pressing Tab key should not trigger any dispatch
        act(() => {
            closeItem!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        });
        expect(mockTabBarDispatch).not.toHaveBeenCalled();
    });

    it('duplicates from context menu', () => {
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEl = container.querySelector('[tabindex="0"]') as HTMLElement;
        act(() => {
            tabEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
        });
        const dupItem = Array.from(container.querySelectorAll('div')).find((el) => el.textContent === 'Duplicate') as HTMLElement;
        expect(dupItem).toBeTruthy();
        act(() => {
            dupItem.click();
        });
        expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'DUPLICATE_TAB', tabId: '1' });
    });

    it('shows confirmation dialog when closing tab with content', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: 'StormEvents | take 10' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        // Click close on Tab 1 (has content)
        const closeSpan = container.querySelector('.queryTabClose') as HTMLElement;
        act(() => {
            closeSpan.click();
        });
        // Should show dialog, not dispatch close yet
        expect(container.textContent).toContain('Close tab?');
        expect(mockTabBarDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'CLOSE_TAB' }));
    });

    it('confirms close dialog dispatches CLOSE_TAB', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: 'StormEvents' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const closeSpan = container.querySelector('.queryTabClose') as HTMLElement;
        act(() => {
            closeSpan.click();
        });
        // Click the Close button in the dialog
        const closeBtn = Array.from(container.querySelectorAll('button')).find((el) => el.textContent === 'Close') as HTMLElement;
        expect(closeBtn).toBeTruthy();
        act(() => {
            closeBtn.click();
        });
        expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'CLOSE_TAB', tabId: '1' });
    });

    it('close others shows confirmation when tabs have content', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: 'query1' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: 'query2' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEls = container.querySelectorAll('[tabindex="0"]');
        const tab1 = Array.from(tabEls).find((el) => el.textContent?.includes('Tab 1')) as HTMLElement;
        act(() => {
            tab1.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
        });
        const closeOthersItem = Array.from(container.querySelectorAll('div')).find((el) => el.textContent === 'Close Others') as HTMLElement;
        expect(closeOthersItem).toBeTruthy();
        act(() => {
            closeOthersItem.click();
        });
        expect(container.textContent).toContain('Close other tabs?');
    });

    it('middle-click closes empty tab', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: '' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEls = container.querySelectorAll('[tabindex="0"]');
        const tab2 = Array.from(tabEls).find((el) => el.textContent?.includes('Tab 2')) as HTMLElement;
        act(() => {
            tab2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 1 }));
        });
        expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'CLOSE_TAB', tabId: '2' });
    });

    it('cancel close dialog does not dispatch', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: 'some query' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const closeSpan = container.querySelector('.queryTabClose') as HTMLElement;
        act(() => {
            closeSpan.click();
        });
        expect(container.textContent).toContain('Close tab?');
        const cancelBtn = Array.from(container.querySelectorAll('button')).find((el) => el.textContent === 'Cancel') as HTMLElement;
        act(() => {
            cancelBtn.click();
        });
        expect(mockTabBarDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'CLOSE_TAB' }));
    });

    it('confirm close others dispatches CLOSE_OTHER_TABS', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: 'query1' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: 'query2' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEls = container.querySelectorAll('[tabindex="0"]');
        const tab1 = Array.from(tabEls).find((el) => el.textContent?.includes('Tab 1')) as HTMLElement;
        act(() => {
            tab1.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
        });
        const closeOthersItem = Array.from(container.querySelectorAll('div')).find((el) => el.textContent === 'Close Others') as HTMLElement;
        act(() => {
            closeOthersItem.click();
        });
        const confirmBtn = Array.from(container.querySelectorAll('button')).find((el) => el.textContent === 'Close Others') as HTMLElement;
        expect(confirmBtn).toBeTruthy();
        act(() => {
            confirmBtn.click();
        });
        expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'CLOSE_OTHER_TABS', tabId: '1' });
    });

    it('close others skips dialog when other tabs are empty', () => {
        mockTabBarState.mockReturnValue({
            ...defaultTabBarState,
            tabs: [
                { id: '1', query: '', title: 'Tab 1', connectionId: 'test-conn', kql: 'query1' },
                { id: '2', query: '', title: 'Tab 2', connectionId: 'test-conn', kql: '' },
            ],
        });
        const dragTabIdRef = { current: null };
        act(() => {
            root.render(React.createElement(TabBar, { dragTabIdRef, onSetEditorDropTarget: vi.fn() }));
        });
        const tabEls = container.querySelectorAll('[tabindex="0"]');
        const tab1 = Array.from(tabEls).find((el) => el.textContent?.includes('Tab 1')) as HTMLElement;
        act(() => {
            tab1.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
        });
        const closeOthersItem = Array.from(container.querySelectorAll('div')).find((el) => el.textContent === 'Close Others') as HTMLElement;
        act(() => {
            closeOthersItem.click();
        });
        expect(mockTabBarDispatch).toHaveBeenCalledWith({ type: 'CLOSE_OTHER_TABS', tabId: '1' });
    });
});
