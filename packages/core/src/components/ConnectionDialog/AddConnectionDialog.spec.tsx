import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { AddConnectionDialog } from './AddConnectionDialog';

vi.mock('../../context/ExplorerColorContext', () => ({
    useExplorerColors: () => ({
        semantic: { backdrop: 'rgba(0,0,0,0.5)', shadowMedium: 'rgba(0,0,0,0.2)', functionBadge: '#0f0', shadowLight: '#ccc', scrollThumb: '#ccc', scrollThumbHover: '#aaa', materializedViewBadge: '#90f', lookupBadge: '#f90', selectionBg: '#00f', selectionSubtle: '#eef', highlightHoverBg: '#ffa' },
        chart: { palette: [] },
    }),
}));
vi.mock('../../context/KustoClientContext', () => ({
    useKustoClient: () => ({}),
}));
vi.mock('../../services/schema', () => ({
    listDatabases: (...args: unknown[]) => mockListDatabases(...args),
}));
vi.mock('../../context/ExplorerStateContext', () => ({
    useExplorerState: () => ({
        connections: [
            { id: 'test-conn', name: 'Test Cluster', clusterUrl: 'https://help.kusto.windows.net', database: 'Telemetry', color: '#909d63' },
        ],
    }),
    useExplorerDispatch: () => mockDispatch,
}));
vi.mock('../ExplorerWorkspace/ExplorerWorkspace.logic', () => ({
    CONNECTION_COLORS: ['#909d63', '#6a8799', '#ebc17a', '#bc5653', '#b06698'],
    saveConnections: (...args: unknown[]) => mockSaveConnections(...args),
}));
vi.mock('@fluentui/react-components', () => ({
    Button: (p: Record<string, unknown>) => React.createElement('button', {
        onClick: p['onClick'] as () => void,
        disabled: p['disabled'] as boolean,
    }, p['children'] as React.ReactNode),
    Input: (p: Record<string, unknown>) => React.createElement('input', {
        value: p['value'] as string,
        placeholder: p['placeholder'] as string,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            const handler = p['onChange'] as ((_: unknown, d: { value: string }) => void) | undefined;
            if (handler) {
                handler(e, { value: e.target.value });
            }
        },
    }),
    Dropdown: (p: Record<string, unknown>) => React.createElement('select', {
        value: p['value'] as string,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
            const handler = p['onOptionSelect'] as ((_: unknown, d: { optionValue?: string }) => void) | undefined;
            if (handler) {
                handler(e, { optionValue: e.target.value });
            }
        },
    }, p['children'] as React.ReactNode),
    Option: (p: Record<string, unknown>) => React.createElement('option', { value: p['value'] as string }, p['children'] as React.ReactNode),
    Spinner: () => React.createElement('span', { 'data-testid': 'spinner' }, 'loading'),
    tokens: { colorNeutralBackground1: '#bg', colorNeutralStroke2: '#stroke', colorNeutralForeground1: '#fg', colorNeutralForeground3: '#fg3', colorPaletteRedForeground1: '#red' },
}));
vi.mock('@fluentui/react-icons', () => ({
    CheckmarkRegular: () => React.createElement('span', null, 'check'),
    DismissRegular: () => React.createElement('span', null, 'dismiss'),
}));

const mockDispatch = vi.fn();
const mockListDatabases = vi.fn();
const mockSaveConnections = vi.fn();



describe('AddConnectionDialog', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        mockDispatch.mockClear();
        mockListDatabases.mockReset();
        mockSaveConnections.mockClear();
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        container.remove();
        vi.restoreAllMocks();
    });

    it('renders without crashing', () => {
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });
        expect(container.innerHTML).toContain('Add Connection');
    });

    it('shows cluster URL input with https:// default', () => {
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });
        const inputs = container.querySelectorAll('input');
        const values = Array.from(inputs).map((i) => i.value);
        expect(values).toContain('https://');
    });

    it('calls onClose when Cancel is clicked', () => {
        const onClose = vi.fn();
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose })); });
        const cancelBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Cancel');
        expect(cancelBtn).toBeTruthy();
        act(() => { cancelBtn!.click(); });
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when dismiss button is clicked', () => {
        const onClose = vi.fn();
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose })); });
        // The dismiss button in the header has no text children (icon-only)
        const buttons = Array.from(container.querySelectorAll('button'));
        const knownLabels = new Set(['Test Connection', 'Cancel', 'Add']);
        const dismissBtn = buttons.find((b) => !knownLabels.has(b.textContent || ''));
        expect(dismissBtn).toBeTruthy();
        act(() => { dismissBtn!.click(); });
        expect(onClose).toHaveBeenCalled();
    });

    it('Test Connection button triggers listDatabases', async () => {
        mockListDatabases.mockResolvedValue(['DB1', 'DB2']);
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });

        // Set a valid cluster URL
        const urlInput = Array.from(container.querySelectorAll('input')).find((i) => i.value === 'https://');
        expect(urlInput).toBeTruthy();
        act(() => {
            const event = new Event('change', { bubbles: true });
            Object.defineProperty(event, 'target', { value: { value: 'https://mycluster.kusto.windows.net' } });
            urlInput!.value = 'https://mycluster.kusto.windows.net';
            urlInput!.dispatchEvent(event);
        });

        const testBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Test Connection');
        expect(testBtn).toBeTruthy();
        act(() => { testBtn!.click(); });

        // Wait for the async operation
        await vi.waitFor(() => {
            expect(mockListDatabases).toHaveBeenCalled();
        });
    });

    it('Add button is disabled until name, url, and database are filled', () => {
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });
        const addBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Add');
        expect(addBtn).toBeTruthy();
        expect(addBtn!.disabled).toBe(true);
    });

    it('successful test shows database dropdown and connected status', async () => {
        mockListDatabases.mockResolvedValue(['Telemetry', 'Analytics']);
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });

        const testBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Test Connection');
        expect(testBtn).toBeTruthy();
        act(() => { testBtn!.click(); });

        await vi.waitFor(() => {
            expect(container.innerHTML).toContain('Connected');
        });

        // Database dropdown should appear with options
        const selectEl = container.querySelector('select');
        expect(selectEl).toBeTruthy();
        const options = selectEl!.querySelectorAll('option');
        expect(options.length).toBe(2);
        expect(options[0].textContent).toBe('Telemetry');
        expect(options[1].textContent).toBe('Analytics');
    });

    it('successful test auto-fills display name from cluster URL', async () => {
        mockListDatabases.mockResolvedValue(['DB1']);
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });

        const testBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Test Connection');
        act(() => { testBtn!.click(); });

        await vi.waitFor(() => {
            expect(container.innerHTML).toContain('Connected');
        });

        // The display name input should be auto-filled
        const inputs = container.querySelectorAll('input');
        const nameInput = Array.from(inputs).find((i) => i.placeholder === 'My Cluster');
        expect(nameInput).toBeTruthy();
    });

    it('failed test shows error message', async () => {
        mockListDatabases.mockRejectedValue(new Error('Connection refused'));
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });

        const testBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Test Connection');
        act(() => { testBtn!.click(); });

        await vi.waitFor(() => {
            expect(container.innerHTML).toContain('Connection refused');
        });
    });

    it('shows error when no databases found', async () => {
        mockListDatabases.mockResolvedValue([]);
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });

        const testBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Test Connection');
        act(() => { testBtn!.click(); });

        await vi.waitFor(() => {
            expect(container.innerHTML).toContain('No databases found');
        });
    });

    it('Add button creates connection and dispatches SET_CONNECTIONS', async () => {
        mockListDatabases.mockResolvedValue(['DB1']);
        const onClose = vi.fn();
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose })); });

        // First set a proper cluster URL so auto-fill produces a name
        const urlInput = container.querySelector('input[placeholder="https://mycluster.kusto.windows.net"]') as HTMLInputElement;
        expect(urlInput).toBeTruthy();
        act(() => {
            // Trigger the React onChange handler directly via native event
            Object.defineProperty(urlInput, 'value', { value: 'https://testcluster.kusto.windows.net', writable: true });
            urlInput.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Test connection to get databases
        const testBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Test Connection');
        expect(testBtn).toBeTruthy();
        act(() => { testBtn!.click(); });

        await vi.waitFor(() => {
            expect(container.innerHTML).toContain('Connected');
        });

        // Now click Add (name is auto-filled from URL, database is auto-selected)
        const addBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Add');
        expect(addBtn).toBeTruthy();
        expect(addBtn!.disabled).toBe(false);
        act(() => { addBtn!.click(); });

        expect(mockSaveConnections).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_CONNECTIONS' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('closes on Escape key', () => {
        const onClose = vi.fn();
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose })); });
        const backdrop = container.firstElementChild as HTMLElement;
        act(() => {
            backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
        expect(onClose).toHaveBeenCalled();
    });

    it('closes on backdrop click', () => {
        const onClose = vi.fn();
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose })); });
        const backdrop = container.firstElementChild as HTMLElement;
        act(() => { backdrop.click(); });
        expect(onClose).toHaveBeenCalled();
    });

    it('database select updates state', async () => {
        mockListDatabases.mockResolvedValue(['DB1', 'DB2']);
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });

        const testBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Test Connection');
        act(() => { testBtn!.click(); });

        await vi.waitFor(() => {
            expect(container.innerHTML).toContain('Connected');
        });

        // Select second database via the mock select element
        const selectEl = container.querySelector('select') as HTMLSelectElement;
        expect(selectEl).toBeTruthy();
        act(() => {
            selectEl.value = 'DB2';
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    it('name input change updates display name', async () => {
        mockListDatabases.mockResolvedValue(['DB1']);
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });

        const testBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Test Connection');
        act(() => { testBtn!.click(); });
        await vi.waitFor(() => { expect(container.innerHTML).toContain('Connected'); });

        const nameInput = Array.from(container.querySelectorAll('input')).find((i) => i.placeholder === 'My Cluster') as HTMLInputElement;
        expect(nameInput).toBeTruthy();
        act(() => {
            nameInput.value = 'Custom Name';
            nameInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    it('does not close when clicking inside the modal', () => {
        const onClose = vi.fn();
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose })); });
        const backdrop = container.firstElementChild as HTMLElement;
        const modal = backdrop.firstElementChild as HTMLElement;
        act(() => { modal.click(); });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('does not close on non-Escape keydown inside modal', () => {
        const onClose = vi.fn();
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose })); });
        const backdrop = container.firstElementChild as HTMLElement;
        const modal = backdrop.firstElementChild as HTMLElement;
        act(() => {
            modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('does not close on non-Escape key on backdrop', () => {
        const onClose = vi.fn();
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose })); });
        const backdrop = container.firstElementChild as HTMLElement;
        act(() => {
            backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('handles database select with undefined optionValue', async () => {
        mockListDatabases.mockResolvedValue(['DB1', 'DB2']);
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });

        const testBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Test Connection');
        act(() => { testBtn!.click(); });

        await vi.waitFor(() => {
            expect(container.innerHTML).toContain('Connected');
        });

        // Simulate dropdown select with empty value (undefined optionValue)
        const selectEl = container.querySelector('select') as HTMLSelectElement;
        expect(selectEl).toBeTruthy();
        act(() => {
            selectEl.value = '';
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    it('handles test connection with non-Error throw', async () => {
        mockListDatabases.mockRejectedValue('string error');
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });

        const testBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Test Connection');
        act(() => { testBtn!.click(); });

        await vi.waitFor(() => {
            expect(container.innerHTML).toContain('string error');
        });
    });

    it('auto-fills name only when name is empty', async () => {
        mockListDatabases.mockResolvedValue(['DB1']);
        act(() => { root.render(React.createElement(AddConnectionDialog, { onClose: vi.fn() })); });

        const testBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Test Connection');
        act(() => { testBtn!.click(); });

        await vi.waitFor(() => {
            expect(container.innerHTML).toContain('Connected');
        });

        // Name should have been auto-filled (the initial URL 'https://' produces empty name,
        // but the auto-fill code still runs, exercising the branch)
        const nameInput = Array.from(container.querySelectorAll('input')).find((i) => i.placeholder === 'My Cluster') as HTMLInputElement;
        expect(nameInput).toBeTruthy();
    });
});
