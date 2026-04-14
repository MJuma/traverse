import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSchema } from '../../services/schema';
import { registerKqlLanguage, setKqlSchemaResolver } from './kqlLanguage';

vi.mock('../../services/schema', () => ({
    getSchema: vi.fn().mockReturnValue([
        {
            name: 'TestTable',
            folder: '',
            description: '',
            kind: 'table',
            columns: [
                { name: 'Col1', type: 'string' },
                { name: 'Col2', type: 'int' },
            ],
        },
        {
            name: 'OtherTable',
            folder: '',
            description: '',
            kind: 'table',
            columns: [
                { name: 'ColA', type: 'string' },
            ],
        },
    ]),
    KQL_FUNCTIONS: ['where', 'project', 'extend', 'summarize', 'take', 'top'],
    KQL_AGGREGATIONS: ['count', 'sum', 'avg', 'min', 'max'],
    KQL_SCALAR_FUNCTIONS: ['ago', 'now', 'bin', 'strlen', 'tostring'],
}));

interface MockMonacoLanguage {
    id: string;
}

function createMockMonaco() {
    const registeredLanguages: MockMonacoLanguage[] = [];
    let monarchProvider: Record<string, unknown> | null = null;
    let completionProvider: { provideCompletionItems: (model: unknown, position: unknown) => unknown } | null = null;

    return {
        languages: {
            getLanguages: () => registeredLanguages,
            register: (lang: MockMonacoLanguage) => { registeredLanguages.push(lang); },
            setMonarchTokensProvider: (_id: string, provider: Record<string, unknown>) => { monarchProvider = provider; },
            registerCompletionItemProvider: (_id: string, provider: { provideCompletionItems: (model: unknown, position: unknown) => unknown }) => { completionProvider = provider; },
            CompletionItemKind: {
                Keyword: 14,
                Function: 1,
                Field: 5,
                Class: 7,
            },
        },
        _getMonarchProvider: () => monarchProvider,
        _getCompletionProvider: () => completionProvider,
    };
}

describe('registerKqlLanguage', () => {
    let mockMonaco: ReturnType<typeof createMockMonaco>;

    beforeEach(() => {
        mockMonaco = createMockMonaco();
        setKqlSchemaResolver(() => getSchema());
    });

    it('registers kql language', () => {
        registerKqlLanguage(mockMonaco as never);
        const langs = mockMonaco.languages.getLanguages();
        expect(langs.some((l) => l.id === 'kql')).toBe(true);
    });

    it('does not register twice', () => {
        registerKqlLanguage(mockMonaco as never);
        registerKqlLanguage(mockMonaco as never);

        const kqlCount = mockMonaco.languages.getLanguages().filter((l) => l.id === 'kql').length;
        expect(kqlCount).toBe(1);
    });

    describe('Monarch tokenizer', () => {
        it('sets up monarch provider with expected structure', () => {
            registerKqlLanguage(mockMonaco as never);
            const provider = mockMonaco._getMonarchProvider();

            expect(provider).not.toBeNull();
            expect(provider?.['ignoreCase']).toBe(true);
            expect(provider?.['keywords']).toEqual(expect.arrayContaining(['where', 'project']));
            expect(provider?.['aggregations']).toEqual(expect.arrayContaining(['count', 'sum']));
            expect(provider?.['scalarFunctions']).toEqual(expect.arrayContaining(['ago', 'now']));
        });

        it('has operators array with comparison operators', () => {
            registerKqlLanguage(mockMonaco as never);
            const provider = mockMonaco._getMonarchProvider();
            const operators = provider?.['operators'] as string[];

            expect(operators).toContain('==');
            expect(operators).toContain('!=');
            expect(operators).toContain('has');
            expect(operators).toContain('contains');
            expect(operators).toContain('and');
            expect(operators).toContain('or');
            expect(operators).toContain('not');
        });

        it('has tokenizer with root rules', () => {
            registerKqlLanguage(mockMonaco as never);
            const provider = mockMonaco._getMonarchProvider();
            const tokenizer = provider?.['tokenizer'] as { root: unknown[] };

            expect(tokenizer).toBeDefined();
            expect(tokenizer.root).toBeInstanceOf(Array);
            expect(tokenizer.root.length).toBeGreaterThan(0);
        });
    });

    describe('Completion provider', () => {
        it('registers a completion provider with trigger characters', () => {
            registerKqlLanguage(mockMonaco as never);
            const provider = mockMonaco._getCompletionProvider();
            expect(provider).not.toBeNull();
        });

        it('provides KQL function suggestions after pipe', () => {
            registerKqlLanguage(mockMonaco as never);
            const provider = mockMonaco._getCompletionProvider()!;

            const model = {
                getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1, word: '' }),
                getLineContent: (line: number) => line === 1 ? '| ' : '',
                getLineCount: () => 1,
            };
            const position = { lineNumber: 1, column: 3 };

            const result = provider.provideCompletionItems(model, position) as { suggestions: { label: string }[] };
            const labels = result.suggestions.map((s) => s.label);
            expect(labels).toContain('where');
            expect(labels).toContain('project');
        });

        it('provides column suggestions after column operator', () => {
            registerKqlLanguage(mockMonaco as never);
            const provider = mockMonaco._getCompletionProvider()!;

            const model = {
                getWordUntilPosition: () => ({ startColumn: 12, endColumn: 12, word: '' }),
                getLineContent: (line: number) => {
                    if (line === 1) {
                        return 'TestTable';
                    }
                    if (line === 2) {
                        return '| where ';
                    }
                    return '';
                },
                getLineCount: () => 2,
            };
            const position = { lineNumber: 2, column: 9 };

            const result = provider.provideCompletionItems(model, position) as { suggestions: { label: string; detail?: string }[] };
            const labels = result.suggestions.map((s) => s.label);
            expect(labels).toContain('Col1');
            expect(labels).toContain('Col2');
        });

        it('provides table suggestions in general context', () => {
            registerKqlLanguage(mockMonaco as never);
            const provider = mockMonaco._getCompletionProvider()!;

            const model = {
                getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1, word: '' }),
                getLineContent: () => '',
                getLineCount: () => 1,
            };
            const position = { lineNumber: 1, column: 1 };

            const result = provider.provideCompletionItems(model, position) as { suggestions: { label: string }[] };
            const labels = result.suggestions.map((s) => s.label);
            expect(labels).toContain('TestTable');
            expect(labels).toContain('OtherTable');
        });

        it('deduplicates suggestions by label', () => {
            registerKqlLanguage(mockMonaco as never);
            const provider = mockMonaco._getCompletionProvider()!;

            const model = {
                getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1, word: '' }),
                getLineContent: () => '',
                getLineCount: () => 1,
            };
            const position = { lineNumber: 1, column: 1 };

            const result = provider.provideCompletionItems(model, position) as { suggestions: { label: string }[] };
            const labels = result.suggestions.map((s) => s.label);
            const uniqueLabels = [...new Set(labels)];
            expect(labels.length).toBe(uniqueLabels.length);
        });

        it('provides suggestions after "by" keyword', () => {
            registerKqlLanguage(mockMonaco as never);
            const provider = mockMonaco._getCompletionProvider()!;

            const model = {
                getWordUntilPosition: () => ({ startColumn: 30, endColumn: 30, word: '' }),
                getLineContent: (line: number) => {
                    if (line === 1) {
                        return 'TestTable';
                    }
                    if (line === 2) {
                        return '| summarize count() by ';
                    }
                    return '';
                },
                getLineCount: () => 2,
            };
            const position = { lineNumber: 2, column: 24 };

            const result = provider.provideCompletionItems(model, position) as { suggestions: { label: string }[] };
            const labels = result.suggestions.map((s) => s.label);
            expect(labels).toContain('Col1');
        });

        it('provides suggestions inside function calls', () => {
            registerKqlLanguage(mockMonaco as never);
            const provider = mockMonaco._getCompletionProvider()!;

            const model = {
                getWordUntilPosition: () => ({ startColumn: 20, endColumn: 20, word: '' }),
                getLineContent: (line: number) => {
                    if (line === 1) {
                        return 'TestTable';
                    }
                    if (line === 2) {
                        return '| where strlen(';
                    }
                    return '';
                },
                getLineCount: () => 2,
            };
            const position = { lineNumber: 2, column: 17 };

            const result = provider.provideCompletionItems(model, position) as { suggestions: { label: string }[] };
            const labels = result.suggestions.map((s) => s.label);
            expect(labels).toContain('Col1');
        });

        it('uses the latest schema resolver for completions after registration', () => {
            registerKqlLanguage(mockMonaco as never);
            const provider = mockMonaco._getCompletionProvider()!;

            setKqlSchemaResolver(() => [{
                name: 'DynamicTable',
                folder: 'Folder',
                description: '',
                kind: 'table',
                columns: [{ name: 'DynamicColumn', type: 'string' }],
            }]);

            const result = provider.provideCompletionItems({
                getWordUntilPosition: () => ({ startColumn: 12, endColumn: 12, word: '' }),
                getLineContent: (line: number) => {
                    if (line === 1) {
                        return 'DynamicTable';
                    }
                    if (line === 2) {
                        return '| where ';
                    }
                    return '';
                },
                getLineCount: () => 2,
            }, { lineNumber: 2, column: 9 }) as { suggestions: { label: string }[] };

            expect(result.suggestions.map((suggestion) => suggestion.label)).toContain('DynamicColumn');
        });
    });
});

describe('kqlLanguage additional branch coverage', () => {
    let mockMonaco: ReturnType<typeof createMockMonaco>;

    beforeEach(() => {
        mockMonaco = createMockMonaco();
        setKqlSchemaResolver(() => getSchema());
    });

    it('suggests columns from statementTable in general context', () => {
        registerKqlLanguage(mockMonaco as never);
        const provider = mockMonaco._getCompletionProvider()!;
        const model = {
            getWordAtPosition: () => null,
            getWordUntilPosition: () => ({ word: '', startColumn: 1, endColumn: 1 }),
            getLineContent: (n: number) => n === 1 ? 'TestTable' : '  ',
            getLineCount: () => 2,
        };
        const position = { lineNumber: 2, column: 3 };

        const result = provider.provideCompletionItems(model, position) as { suggestions: { label: string; detail?: string }[] };
        const colSuggestions = result.suggestions.filter((s) => s.detail?.includes('TestTable'));
        expect(colSuggestions.length).toBeGreaterThan(0);
        expect(colSuggestions.map((s) => s.label)).toContain('Col1');
    });

    it('suggests columns from mentioned tables when no statementTable found', () => {
        registerKqlLanguage(mockMonaco as never);
        const provider = mockMonaco._getCompletionProvider()!;
        const model = {
            getWordAtPosition: () => null,
            getWordUntilPosition: () => ({ word: '', startColumn: 1, endColumn: 1 }),
            getLineContent: (n: number) => n === 1 ? 'let x = OtherTable' : '  ',
            getLineCount: () => 2,
        };
        const position = { lineNumber: 2, column: 3 };

        const result = provider.provideCompletionItems(model, position) as { suggestions: { label: string; detail?: string }[] };
        const colSuggestions = result.suggestions.filter((s) => s.detail?.includes('OtherTable'));
        expect(colSuggestions.length).toBeGreaterThan(0);
        expect(colSuggestions.map((s) => s.label)).toContain('ColA');
    });
});
