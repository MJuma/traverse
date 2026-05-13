import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as Monaco from 'monaco-editor';

import {
    bootstrapKustoLanguage,
    __resetBootstrapForTests,
} from './bootstrapKustoLanguage';

const setLanguageSettings = vi.fn();
const setMaximumWorkerIdleTime = vi.fn();
const kustoDefaults = { setLanguageSettings, setMaximumWorkerIdleTime };

vi.mock('@kusto/monaco-kusto', () => ({
    get kustoDefaults() {
        return kustoDefaults;
    },
}));

function makeMonaco(languages: { id: string }[] = [{ id: 'kusto' }]): typeof Monaco {
    return {
        languages: {
            getLanguages: vi.fn(() => languages),
        },
    } as unknown as typeof Monaco;
}

beforeEach(() => {
    __resetBootstrapForTests();
    setLanguageSettings.mockReset();
    setMaximumWorkerIdleTime.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('bootstrapKustoLanguage', () => {
    it('imports @kusto/monaco-kusto and applies default settings on first call', async () => {
        const monaco = makeMonaco();

        await bootstrapKustoLanguage(monaco);

        expect(setLanguageSettings).toHaveBeenCalledTimes(1);
        const settings = setLanguageSettings.mock.calls[0][0];
        expect(settings.enableHover).toBe(true);
        expect(settings.enableQueryWarnings).toBe(true);
        expect(settings.enableQuerySuggestions).toBe(true);
        expect(settings.includeControlCommands).toBe(true);
        expect(settings.completionOptions).toEqual({ includeExtendedSyntax: false });
    });

    it('is idempotent — repeated calls return the same promise without re-applying settings', async () => {
        const monaco = makeMonaco();

        const p1 = bootstrapKustoLanguage(monaco);
        const p2 = bootstrapKustoLanguage(monaco);

        expect(p1).toBe(p2);
        await p1;
        await p2;
        expect(setLanguageSettings).toHaveBeenCalledTimes(1);
    });

    it('merges caller-provided settings over defaults', async () => {
        const monaco = makeMonaco();

        await bootstrapKustoLanguage(monaco, {
            languageSettings: {
                enableHover: false,
                disabledDiagnosticCodes: ['KS107'],
            },
        });

        const settings = setLanguageSettings.mock.calls[0][0];
        expect(settings.enableHover).toBe(false);
        expect(settings.enableQueryWarnings).toBe(true);
        expect(settings.disabledDiagnosticCodes).toEqual(['KS107']);
        expect(settings.completionOptions).toEqual({ includeExtendedSyntax: false });
    });

    it('falls back to default completionOptions when caller passes undefined', async () => {
        const monaco = makeMonaco();

        await bootstrapKustoLanguage(monaco, {
            languageSettings: { completionOptions: undefined as never },
        });

        const settings = setLanguageSettings.mock.calls[0][0];
        expect(settings.completionOptions).toEqual({ includeExtendedSyntax: false });
    });

    it('uses caller-provided completionOptions when present', async () => {
        const monaco = makeMonaco();

        await bootstrapKustoLanguage(monaco, {
            languageSettings: { completionOptions: { includeExtendedSyntax: true } },
        });

        const settings = setLanguageSettings.mock.calls[0][0];
        expect(settings.completionOptions).toEqual({ includeExtendedSyntax: true });
    });

    it('applies workerMaxIdleTimeMs when provided', async () => {
        const monaco = makeMonaco();

        await bootstrapKustoLanguage(monaco, { workerMaxIdleTimeMs: 5 * 60_000 });

        expect(setMaximumWorkerIdleTime).toHaveBeenCalledWith(5 * 60_000);
    });

    it('does not call setMaximumWorkerIdleTime when not provided', async () => {
        const monaco = makeMonaco();

        await bootstrapKustoLanguage(monaco);

        expect(setMaximumWorkerIdleTime).not.toHaveBeenCalled();
    });

    it('throws when the Monaco instance has no kusto language after import (two-Monaco)', async () => {
        const monaco = makeMonaco([{ id: 'javascript' }]);

        await expect(bootstrapKustoLanguage(monaco)).rejects.toThrow(/different Monaco instance/);
    });

    it('clears the cached promise on failure so a subsequent call can retry', async () => {
        const monaco = makeMonaco([{ id: 'javascript' }]);

        await expect(bootstrapKustoLanguage(monaco)).rejects.toThrow();

        // After failure, the next call should re-attempt (and re-invoke setLanguageSettings).
        const monaco2 = makeMonaco();
        await bootstrapKustoLanguage(monaco2);

        expect(setLanguageSettings).toHaveBeenCalledTimes(2);
    });

    it('throws a helpful error when @kusto/monaco-kusto did not expose kustoDefaults', async () => {
        const monaco = makeMonaco();
        const broken = kustoDefaults.setLanguageSettings;
        kustoDefaults.setLanguageSettings = undefined as never;

        try {
            await expect(bootstrapKustoLanguage(monaco)).rejects.toThrow(/did not expose kustoDefaults/);
        } finally {
            kustoDefaults.setLanguageSettings = broken;
        }
    });
});
